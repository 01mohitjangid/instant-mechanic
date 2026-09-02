/**
 * The real-time contract.
 *
 * The server emits these events and the dashboard listens for them. Both sides
 * import the same definitions, so a renamed field breaks the build instead of
 * quietly delivering `undefined` to a live screen.
 */
import type { BookingStatus } from './booking.js';

/** Event names, as constants — a typo in a string literal is otherwise silent. */
export const REALTIME_EVENTS = {
  bookingUpdated: 'booking:updated',
  /** Sent once on connect, so a client knows the stream is genuinely alive. */
  connected: 'realtime:connected',
} as const;

/** A booking moved from one status to the next. */
export interface BookingUpdatedEvent {
  bookingId: number;
  reference: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedAt: string;
  changedBy: string;
  /** Enough context to write a useful notification without another API call. */
  customerName: string;
  serviceName: string;
  mechanicName: string | null;
  amount: string;
}

export interface RealtimeConnectedEvent {
  serverTime: string;
  /** How many dashboards are currently watching. */
  viewers: number;
}

/** Typed event map, so `socket.on(...)` knows its own payload on both sides. */
export interface ServerToClientEvents {
  'booking:updated': (event: BookingUpdatedEvent) => void;
  'realtime:connected': (event: RealtimeConnectedEvent) => void;
}

/** The dashboard is a viewer; it never pushes anything back. */
export type ClientToServerEvents = Record<string, never>;
