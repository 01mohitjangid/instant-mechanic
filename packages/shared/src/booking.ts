/**
 * Booking vocabulary shared by the API and the dashboard.
 *
 * These values mirror the PostgreSQL enums in `001_init.sql` exactly. Keeping
 * one definition means a status rename breaks the build on both sides instead
 * of silently drifting until someone notices a blank column in production.
 */

/** Matches the `booking_status` enum. Order is the real lifecycle order. */
export const BOOKING_STATUSES = [
  'pending',
  'assigned',
  'on_the_way',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** The happy path. Every non-cancelled status is a prefix of this sequence. */
export const BOOKING_LIFECYCLE = [
  'pending',
  'assigned',
  'on_the_way',
  'in_progress',
  'completed',
] as const satisfies readonly BookingStatus[];

/** A job nobody is working yet, or will ever work again. */
export const TERMINAL_STATUSES = [
  'completed',
  'cancelled',
] as const satisfies readonly BookingStatus[];

/** A job that is happening right now, so its mechanic is unavailable. */
export const LIVE_STATUSES = [
  'on_the_way',
  'in_progress',
] as const satisfies readonly BookingStatus[];

/** Matches the `mechanic_status` enum. */
export const MECHANIC_STATUSES = ['available', 'on_job', 'on_break', 'off_duty'] as const;
export type MechanicStatus = (typeof MECHANIC_STATUSES)[number];

/** Matches the `payment_status` enum. */
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Labels for the dashboard, so both sides spell a status the same way. */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  on_the_way: 'Mechanic On The Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Narrows an unknown string coming off the wire or out of the database. */
export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && (BOOKING_STATUSES as readonly string[]).includes(value);
}
