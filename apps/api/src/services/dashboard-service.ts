import {
  BOOKING_STATUS_LABELS,
  isBookingStatus,
  type DashboardAnalytics,
  type DashboardOverview,
  type ServiceBreakdownEntry,
  type StatusBreakdownEntry,
  type TimeSeriesPoint,
} from '@instant-mechanic/shared';
import {
  selectOverview,
  selectServiceBreakdown,
  selectStatusBreakdown,
  selectTimeSeries,
} from '../db/queries/dashboard.js';
import { APP_TIMEZONE, count, money, ratio } from '../lib/sql.js';

export async function getOverview(): Promise<DashboardOverview> {
  const row = await selectOverview(APP_TIMEZONE);

  return {
    totalBookings: count(row.total_bookings),
    todaysBookings: count(row.todays_bookings),
    completedBookings: count(row.completed_bookings),
    pendingBookings: count(row.pending_bookings),
    cancelledBookings: count(row.cancelled_bookings),
    activeJobs: count(row.active_jobs),
    totalRevenue: money(row.total_revenue),
    todaysRevenue: money(row.todays_revenue),
    activeMechanics: count(row.active_mechanics),
    totalMechanics: count(row.total_mechanics),
    newCustomers: count(row.new_customers),
    totalCustomers: count(row.total_customers),
    averageRating: ratio(row.average_rating),
    averageTicket: money(row.average_ticket),
    timezone: APP_TIMEZONE,
  };
}

export async function getAnalytics(days: number): Promise<DashboardAnalytics> {
  // Three independent aggregates: issued together so the round trips overlap.
  const [seriesRows, statusRows, categoryRows] = await Promise.all([
    selectTimeSeries(APP_TIMEZONE, days),
    selectStatusBreakdown(),
    selectServiceBreakdown(),
  ]);

  const series: TimeSeriesPoint[] = seriesRows.map((row) => ({
    date: row.date,
    bookings: count(row.bookings),
    completed: count(row.completed),
    cancelled: count(row.cancelled),
    revenue: money(row.revenue),
  }));

  const statusBreakdown: StatusBreakdownEntry[] = statusRows
    // enum_range guarantees only real statuses, but narrow anyway so the
    // response type is honest rather than asserted.
    .filter((row) => isBookingStatus(row.status))
    .map((row) => {
      const status = row.status as StatusBreakdownEntry['status'];
      return {
        status,
        label: BOOKING_STATUS_LABELS[status],
        bookings: count(row.bookings),
        value: money(row.value),
      };
    });

  const serviceBreakdown: ServiceBreakdownEntry[] = categoryRows.map((row) => ({
    category: row.category,
    bookings: count(row.bookings),
    revenue: money(row.revenue),
  }));

  return { rangeDays: days, timezone: APP_TIMEZONE, series, statusBreakdown, serviceBreakdown };
}
