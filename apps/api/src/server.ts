/**
 * Process entry point: start the HTTP server and shut it down cleanly.
 *
 *   npm run dev    watch mode
 *   npm start      compiled output
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, query } from './db/pool.js';

const app = createApp();

async function start(): Promise<void> {
  // Fail fast and loudly. A server that accepts traffic it cannot serve is
  // worse than one that refuses to start.
  await query('SELECT 1');

  const server = app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[api] operations timezone: ${env.APP_TIMEZONE}`);
  });

  /**
   * Stop accepting new connections, let in-flight requests finish, then close
   * the database pool. Without this, a deploy cuts live requests mid-query.
   */
  const shutdown = (signal: string): void => {
    console.log(`[api] ${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      console.error('[api] shutdown timed out, exiting anyway');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void closePool()
        .catch((error: unknown) => {
          console.error('[api] error closing the database pool:', error);
        })
        .finally(() => {
          console.log('[api] shutdown complete');
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
