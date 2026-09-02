/**
 * Process entry point: start the HTTP server and shut it down cleanly.
 *
 *   npm run dev    watch mode
 *   npm start      compiled output
 */
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, query } from './db/pool.js';
import {
  closeRealtimeServer,
  createRealtimeServer,
  disconnectRealtimeClients,
} from './realtime/server.js';
import { startSimulator, stopSimulator } from './simulator/index.js';

const app = createApp();

/**
 * Express and Socket.IO share ONE HTTP server, so the whole API lives behind a
 * single port and a single origin. Two servers would mean two ports to open on
 * AWS, two CORS configurations, and a second URL for the dashboard to get
 * wrong.
 */
const httpServer = createServer(app);

async function start(): Promise<void> {
  // Registered BEFORE the first await. A SIGTERM arriving during boot — a
  // `docker stop` or a rollout cancelling mid-deploy — would otherwise hit
  // Node's default handler and kill the process with 143.
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Fail fast and loudly. A server that accepts traffic it cannot serve is
  // worse than one that refuses to start.
  await query('SELECT 1');

  createRealtimeServer(httpServer);

  // A failed bind arrives as an 'error' event, not a thrown exception. Without
  // this handler Node re-throws it as an unhandled 'error' and the message
  // ("EADDRINUSE") is buried in a stack trace.
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[api] port ${env.PORT} is already in use. Another API is probably running — ` +
          `stop it, or start this one with a different PORT.`
      );
    } else {
      console.error('[api] server error:', error.message);
    }
    void stopSimulator().finally(() => process.exit(1));
  });

  const server = httpServer.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[api] websocket ready on ws://localhost:${env.PORT}/socket.io`);
    console.log(`[api] operations timezone: ${env.APP_TIMEZONE}`);

    // Started INSIDE the callback, so it only runs once the server is really
    // accepting traffic. Starting it beside listen() meant a failed bind still
    // left a simulator writing to the database from a process that was about
    // to exit.
    startSimulator();
  });

  /**
   * Shut down in the only order that actually terminates.
   *
   * Every step here was learned by breaking it:
   *
   *  - Sockets go FIRST. Socket.IO shares this HTTP server, `server.close()`
   *    waits for open connections, and an upgraded WebSocket never ends on its
   *    own — so closing the server before disconnecting clients deadlocks.
   *  - Waiting for the simulator is CAPPED. A bare await on an in-flight tick
   *    makes the whole teardown hostage to one database round trip; a tick
   *    blocked on a row lock meant the pool was never drained and the process
   *    died on the watchdog with exit 1.
   *  - Idle connections are dropped before active ones, so an in-flight
   *    response is not cut off mid-write unless it overstays the grace period.
   */
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    // A second Ctrl-C used to re-run every step and hit pg's "Called end on
    // pool more than once", turning a clean stop into exit 1.
    if (shuttingDown) {
      console.log(`[api] ${signal} received, already shutting down`);
      return;
    }
    shuttingDown = true;
    console.log(`[api] ${signal} received, shutting down`);

    // Deliberately NOT unref'd: a watchdog that cannot hold the event loop open
    // can only fire when something else already is, which is the case it exists
    // to catch. The success path calls process.exit() and takes it with it.
    // Comfortably above the sum of every step's cap below (1+3+5+2+3 = 14s),
    // so a legitimately slow shutdown finishes rather than being killed by its
    // own safety net. In practice every step completes in milliseconds; the
    // caps only bite when something is genuinely stuck.
    setTimeout(() => {
      console.error('[api] shutdown timed out, exiting anyway');
      process.exit(1);
    }, 20_000);

    const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    /** Run a step, but never let it hold the shutdown open indefinitely. */
    const step = async (name: string, work: () => void | Promise<void>, capMs = 3000) => {
      const startedAt = Date.now();
      const finished = await Promise.race([
        Promise.resolve(work()).then(() => true),
        delay(capMs).then(() => false),
      ]);
      const took = Date.now() - startedAt;
      console.log(`[api]   ${name} (${took}ms)${finished ? '' : ' — timed out, moving on'}`);
    };

    void (async () => {
      try {
        // 1. Release the dashboards immediately. Nothing below should make a
        //    connected browser wait.
        await step('dashboards disconnected', disconnectRealtimeClients, 1000);

        // 2. Best-effort wait for a tick that is already writing, so the pool is
        //    not pulled out from under a half-finished transaction. Capped: the
        //    transaction rolls back safely if we give up on it.
        await step('simulator stopped', stopSimulator);

        // 3. Idle keep-alive sockets hold the server open as effectively as a
        //    live one. Active requests get a grace period before being cut.
        await step(
          'http server closed',
          async () => {
            server.closeIdleConnections();
            const closed = new Promise<void>((resolve) => server.close(() => resolve()));
            // Long enough for the slowest real request this API serves — a
            // 365-day analytics scan runs about two seconds against Neon, and
            // cutting it would hand the client a socket hang-up for work the
            // server had already done.
            const drained = await Promise.race([
              closed.then(() => true),
              delay(3000).then(() => false),
            ]);
            if (!drained) {
              console.warn('[api]   requests still in flight, closing them');
              server.closeAllConnections();
              await closed;
            }
          },
          5000
        );

        await step('realtime server closed', closeRealtimeServer, 2000);
        await step('database pool drained', closePool, 3000);

        console.log('[api] shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('[api] error during shutdown:', error);
        process.exit(1);
      }
    })();
  };
}

start().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
