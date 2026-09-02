import type { BookingStatus, MechanicStatus } from '@instant-mechanic/shared';

/**
 * One place that decides what a status looks like.
 *
 * A "pending" badge and a "pending" chart slice read from the same token, so
 * the two can never disagree, and every colour has a dark-mode counterpart
 * because the tokens are redefined under `.dark` in globals.css.
 */

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  assigned: 'bg-status-assigned/15 text-status-assigned border-status-assigned/30',
  on_the_way: 'bg-status-on-the-way/15 text-status-on-the-way border-status-on-the-way/30',
  in_progress: 'bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30',
  completed: 'bg-status-completed/15 text-status-completed border-status-completed/30',
  cancelled: 'bg-status-cancelled/15 text-status-cancelled border-status-cancelled/30',
};

/** Hex-free chart fill: the CSS variable resolves per theme at paint time. */
export const BOOKING_STATUS_FILL: Record<BookingStatus, string> = {
  pending: 'var(--status-pending)',
  assigned: 'var(--status-assigned)',
  on_the_way: 'var(--status-on-the-way)',
  in_progress: 'var(--status-in-progress)',
  completed: 'var(--status-completed)',
  cancelled: 'var(--status-cancelled)',
};

export const MECHANIC_STATUS_STYLES: Record<MechanicStatus, string> = {
  available: 'bg-status-completed/15 text-status-completed border-status-completed/30',
  on_job: 'bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30',
  on_break: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  off_duty: 'bg-muted text-muted-foreground border-border',
};

export const MECHANIC_STATUS_LABELS: Record<MechanicStatus, string> = {
  available: 'Available',
  on_job: 'On Job',
  on_break: 'On Break',
  off_duty: 'Off Duty',
};
