import type { BookingUpdatedEvent } from '@instant-mechanic/shared';
import { pool, withTransaction } from '../db/pool.js';
import {
  countOpenBookings,
  insertNewBooking,
  insertStatusHistory,
  selectEventContext,
  selectSimulatorCandidate,
} from '../db/queries/booking-status.js';
import { changeBookingStatus, nextStatusFor } from '../services/booking-status-service.js';
import { emitBookingUpdated } from '../realtime/server.js';
import { ApiError } from '../lib/errors.js';
import { env, simulatorEnabled } from '../config/env.js';

/**
 * Keeps the operations board moving.
 *
 * Why it exists: there is no mechanic app sending updates, so without it the
 * live dashboard would have nothing to be live about. It is deliberately NOT a
 * fake event generator — it calls the same `changeBookingStatus` service the
 * API route calls, so every move is a real database write with a real history
 * row. Turning it off changes how often the board moves, not how it works.
 *
 * It both takes new work and finishes old work, and the balance matters in both
 * directions. Advancing alone drains the backlog and the board freezes for good
 * a quarter of an hour after a seed. Creating too eagerly is the mirror image:
 * the queue grows for ever and "pending" climbs all day. So creation is capped
 * at both ends by the backlog itself.
 */

/**
 * The workable queue this aims to hold — the same set the picker draws from, so
 * the ceiling bounds the thing that actually grows and the floor guarantees
 * there is always something live on the board.
 */
const MIN_OPEN_QUEUE = 12;
const MAX_OPEN_QUEUE = 40;
/**
 * Between the two, this is the chance of taking a new booking instead of
 * advancing one. A booking needs roughly 3.5 advances to reach a terminal
 * status, so a rate much above 1-in-5 creates faster than it retires.
 */
const NEW_BOOKING_CHANCE = 0.2;
/** Roughly one advanced booking in twelve gets cancelled instead. */
const CANCEL_CHANCE = 0.08;

const CANCELLATION_REASONS = [
  'Customer rescheduled to a later date',
  'Customer was not reachable',
  'Spare part out of stock',
  'Vehicle already repaired elsewhere',
];

let timer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;

/** Take a new booking, with the same `null -> pending` history row a real one gets. */
async function takeNewBooking(): Promise<void> {
  const event = await withTransaction(async (client): Promise<BookingUpdatedEvent | null> => {
    const booking = await insertNewBooking(client, env.APP_TIMEZONE);
    if (!booking) return null;

    const history = await insertStatusHistory(client, {
      bookingId: booking.id,
      fromStatus: null,
      toStatus: 'pending',
      changedBy: 'customer-app',
      note: null,
    });

    const context = await selectEventContext(client, booking.id);
    if (!context) return null;

    return {
      bookingId: booking.id,
      reference: booking.reference,
      fromStatus: null,
      toStatus: 'pending',
      changedAt: history.changed_at.toISOString(),
      changedBy: 'customer-app',
      customerName: context.customer_name,
      serviceName: context.service_name,
      mechanicName: context.mechanic_name,
      amount: context.amount,
    };
  });

  if (!event) return;

  // "A new job just came in" is the event a live operations board most wants to
  // see. Without this, a new booking stayed invisible until some later change
  // happened to trigger a refresh.
  emitBookingUpdated(event);
  console.log(`[simulator] new booking ${event.reference} (${event.customerName})`);
}

async function advanceOneBooking(): Promise<void> {
  // Held only long enough to choose a booking. changeBookingStatus opens its
  // own transaction, so keeping this one would tie up two of the pool's ten
  // connections for the whole write.
  const client = await pool.connect();
  let candidate;
  try {
    candidate = await selectSimulatorCandidate(client, env.APP_TIMEZONE);
  } finally {
    client.release();
  }

  if (!candidate) {
    console.log('[simulator] nothing moveable this tick');
    return;
  }

  const forward = nextStatusFor(candidate.status);
  if (!forward) {
    console.log(`[simulator] booking ${candidate.id} is already ${candidate.status}, nothing next`);
    return;
  }

  const cancel = Math.random() < CANCEL_CHANCE;
  const toStatus = cancel ? 'cancelled' : forward;
  const reason = cancel
    ? CANCELLATION_REASONS[Math.floor(Math.random() * CANCELLATION_REASONS.length)]
    : undefined;

  // The candidate was chosen outside this transaction, so it may already have
  // moved. changeBookingStatus re-reads it under FOR UPDATE and refuses an
  // illegal move with a 409, which the caller below treats as a normal skip.
  const event = await changeBookingStatus({
    bookingId: candidate.id,
    toStatus,
    changedBy: 'simulator',
    reason,
  });

  console.log(`[simulator] ${event.reference}: ${event.fromStatus} -> ${event.toStatus}`);
}

async function tick(): Promise<void> {
  try {
    const client = await pool.connect();
    let openQueue: number;
    try {
      openQueue = await countOpenBookings(client);
    } finally {
      client.release();
    }

    const shouldCreate =
      openQueue < MIN_OPEN_QUEUE ||
      (openQueue < MAX_OPEN_QUEUE && Math.random() < NEW_BOOKING_CHANCE);

    if (shouldCreate) {
      await takeNewBooking();
      return;
    }

    await advanceOneBooking();
  } catch (error) {
    // Losing a race — someone advanced the same booking first, or the mechanic
    // went live elsewhere — is expected and must not kill the loop.
    if (error instanceof ApiError && (error.statusCode === 409 || error.statusCode === 404)) {
      console.log(`[simulator] skipped: ${error.message}`);
    } else {
      console.error('[simulator] tick failed:', error instanceof Error ? error.message : error);
    }
  }
}

export function startSimulator(): void {
  if (!simulatorEnabled) {
    console.log('[simulator] disabled (SIMULATOR_ENABLED=false)');
    return;
  }
  if (timer) return;

  console.log(`[simulator] running every ${env.SIMULATOR_INTERVAL_MS}ms`);
  timer = setInterval(() => {
    // Skip this beat rather than queue up: a slow database must not build a
    // backlog of overlapping ticks. Keeping the promise also lets shutdown wait
    // for a tick that is already in the middle of a write.
    if (inFlight) return;
    inFlight = tick().finally(() => {
      inFlight = null;
    });
  }, env.SIMULATOR_INTERVAL_MS);

  // Do not hold the process open on its own account; shutdown should not wait
  // for a timer that exists only to make a demo move.
  timer.unref();
}

/**
 * Stop the loop and wait for any tick already running.
 *
 * The wait matters: the tick holds no pool client between choosing a booking
 * and writing it, so without this `closePool()` can finish first and the tick
 * then dies with "Cannot use a pool after calling end on the pool".
 */
export async function stopSimulator(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (inFlight) await inFlight;
}
