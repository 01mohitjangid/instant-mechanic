import type { BookingStatus, BookingUpdatedEvent } from '@instant-mechanic/shared';
import { withTransaction } from '../db/pool.js';
import {
  applyStatusChange,
  countOtherLiveJobs,
  findFreeMechanic,
  insertStatusHistory,
  lockBooking,
  lockMechanic,
  refreshMechanicAvailability,
  selectEventContext,
} from '../db/queries/booking-status.js';
import { emitBookingUpdated } from '../realtime/server.js';
import { ApiError } from '../lib/errors.js';
import { isoRequired, money } from '../lib/sql.js';

/**
 * The booking lifecycle, as business rules rather than as a database
 * constraint. The schema stops impossible ROWS; this stops impossible MOVES.
 */
const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  pending: 'assigned',
  assigned: 'on_the_way',
  on_the_way: 'in_progress',
  in_progress: 'completed',
};

const TERMINAL: readonly BookingStatus[] = ['completed', 'cancelled'];

/** Statuses that mean the mechanic is physically on this job right now. */
const LIVE: readonly BookingStatus[] = ['on_the_way', 'in_progress'];

export function nextStatusFor(status: BookingStatus): BookingStatus | null {
  return NEXT_STATUS[status] ?? null;
}

/** A move is legal if it is the next step forward, or a cancellation. */
export function isLegalTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (TERMINAL.includes(from)) return false;
  if (to === 'cancelled') return true;
  return NEXT_STATUS[from] === to;
}

export interface ChangeStatusInput {
  bookingId: number;
  toStatus: BookingStatus;
  changedBy: string;
  reason?: string | undefined;
}

/**
 * Move one booking to a new status, then tell every watching dashboard.
 *
 * The database work is one transaction: the booking row, its history entry and
 * the mechanic's availability all commit together or not at all. The socket
 * event is emitted only AFTER the commit — announcing a change that then rolled
 * back would leave every dashboard showing something that never happened.
 */
export async function changeBookingStatus(input: ChangeStatusInput): Promise<BookingUpdatedEvent> {
  const event = await withTransaction(async (client) => {
    const booking = await lockBooking(client, input.bookingId);
    if (!booking) throw ApiError.notFound('Booking', input.bookingId);

    if (!isLegalTransition(booking.status, input.toStatus)) {
      throw new ApiError(
        409,
        'ILLEGAL_TRANSITION',
        `A booking cannot move from "${booking.status}" to "${input.toStatus}". ` +
          `From "${booking.status}" the allowed moves are: ` +
          (TERMINAL.includes(booking.status)
            ? 'none, it is already finished'
            : [NEXT_STATUS[booking.status], 'cancelled'].filter(Boolean).join(', '))
      );
    }

    // Anything past "pending" needs a mechanic — the schema's
    // chk_mechanic_required enforces it, so find one before we try to write.
    let mechanicId = booking.mechanic_id;
    if (mechanicId === null && input.toStatus !== 'cancelled') {
      mechanicId = await findFreeMechanic(client, booking.customer_city);
      if (mechanicId === null) {
        throw new ApiError(
          409,
          'NO_MECHANIC_AVAILABLE',
          'Every mechanic is already on a live job, so this booking cannot be assigned yet'
        );
      }
    }

    // One mechanic, one live job. The schema cannot enforce this — a CHECK
    // constraint sees one row, and "already out on another job" is a fact about
    // a different row — so it is enforced here, on the write path every caller
    // goes through. The mechanic is locked first so two simultaneous requests
    // cannot both pass this check.
    if (mechanicId !== null && LIVE.includes(input.toStatus)) {
      await lockMechanic(client, mechanicId);
      const otherLiveJobs = await countOtherLiveJobs(client, mechanicId, booking.id);
      if (otherLiveJobs > 0) {
        throw new ApiError(
          409,
          'MECHANIC_ALREADY_ON_JOB',
          'That mechanic is already out on another job, so this booking cannot go live yet'
        );
      }
    }

    await applyStatusChange(client, {
      bookingId: booking.id,
      toStatus: input.toStatus,
      mechanicId,
      cancellationReason:
        input.toStatus === 'cancelled' ? (input.reason ?? 'Cancelled by operations') : null,
    });

    const history = await insertStatusHistory(client, {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: input.toStatus,
      changedBy: input.changedBy,
      note: input.toStatus === 'cancelled' ? (input.reason ?? null) : null,
    });

    // Keep the mechanics page honest in the same breath as the booking change.
    if (mechanicId !== null) {
      await refreshMechanicAvailability(client, mechanicId);
    }

    const context = await selectEventContext(client, booking.id);
    if (!context) throw new Error(`Booking ${booking.id} vanished mid-transaction`);

    return {
      bookingId: booking.id,
      reference: context.reference,
      fromStatus: booking.status,
      toStatus: input.toStatus,
      changedAt: isoRequired(history.changed_at),
      changedBy: input.changedBy,
      customerName: context.customer_name,
      serviceName: context.service_name,
      mechanicName: context.mechanic_name,
      amount: money(context.amount),
    } satisfies BookingUpdatedEvent;
  });

  emitBookingUpdated(event);
  return event;
}
