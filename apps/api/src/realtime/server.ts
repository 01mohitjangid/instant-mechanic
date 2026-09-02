import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  REALTIME_EVENTS,
  type BookingUpdatedEvent,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@instant-mechanic/shared';
import { corsOrigins } from '../config/env.js';

/**
 * The real-time channel.
 *
 * Socket.IO rides on the SAME HTTP server as Express, so there is one port, one
 * TLS certificate and one CORS story to get right instead of two.
 *
 * Socket.IO rather than a bare WebSocket for two practical reasons: it
 * reconnects on its own when a laptop wakes up or a network blips, and it falls
 * back to long-polling on the corporate networks that block WebSocket upgrades.
 * A dashboard that silently stops updating is worse than one that never claimed
 * to be live.
 */

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function createRealtimeServer(
  httpServer: HttpServer
): Server<ClientToServerEvents, ServerToClientEvents> {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    // Its own CORS config: the Express middleware does not cover the handshake.
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
    // Drop a client we have not heard from in 25s, so a laptop that closed its
    // lid stops counting as a viewer.
    pingInterval: 10_000,
    pingTimeout: 25_000,
  });

  io.on('connection', (socket) => {
    const viewers = io?.engine.clientsCount ?? 1;
    console.log(`[realtime] dashboard connected (${socket.id}), ${viewers} watching`);

    // A handshake is not proof the stream works. This first message is, and it
    // gives the client something to show its "Live" indicator from.
    socket.emit(REALTIME_EVENTS.connected, {
      serverTime: new Date().toISOString(),
      viewers,
    });

    socket.on('disconnect', (reason) => {
      console.log(`[realtime] dashboard disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

/**
 * Tell every connected dashboard that a booking moved.
 *
 * Deliberately safe when real-time is not running: the migration and seed
 * scripts import the same services, and they must not crash because no socket
 * server exists.
 */
export function emitBookingUpdated(event: BookingUpdatedEvent): void {
  io?.emit(REALTIME_EVENTS.bookingUpdated, event);
}

export function realtimeViewerCount(): number {
  return io?.engine.clientsCount ?? 0;
}

/**
 * Tell every dashboard to go away, without tearing anything down yet.
 *
 * Separate from `closeRealtimeServer` because the ORDER matters during
 * shutdown: `io.close()` closes the underlying HTTP server and waits for its
 * connections, so the clients have to be gone first or it waits on them.
 * A client disconnected politely reconnects cleanly; one dropped by a dying
 * process retries against a closed port and shows an error first.
 */
export function disconnectRealtimeClients(): void {
  io?.disconnectSockets(true);
}

export async function closeRealtimeServer(): Promise<void> {
  if (!io) return;
  const server = io;
  io = null;

  try {
    await server.close();
  } catch (error) {
    // io.close() also closes the HTTP server it was attached to. Shutdown
    // closes that first (so in-flight requests get a grace period), which makes
    // this a harmless "not running" — anything else is worth seeing.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ERR_SERVER_NOT_RUNNING') throw error;
  }
}
