import type { BookingStatus } from '@instant-mechanic/shared';
import { query } from '../pool.js';
import { QueryParams } from '../query-params.js';
import { APP_TIMEZONE, likeTerm } from '../../lib/sql.js';

export interface BookingRow {
  id: number;
  reference: string;
  status: BookingStatus;
  payment_status: string;
  amount: string;
  scheduled_at: Date;
  created_at: Date;
  completed_at: Date | null;
  rating: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  vehicle_id: number;
  make: string;
  model: string;
  year: number;
  registration_number: string;
  service_id: number;
  service_name: string;
  service_category: string;
  mechanic_id: number | null;
  mechanic_name: string | null;
  total_count: string;
}

export interface BookingDetailRow extends Omit<BookingRow, 'total_count'> {
  started_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  notes: string | null;
  updated_at: Date;
  customer_email: string;
  fuel_type: string;
  duration_minutes: number;
  base_price: string;
  mechanic_phone: string | null;
  mechanic_specialization: string | null;
}

export interface BookingFilters {
  search?: string | undefined;
  statuses?: BookingStatus[] | undefined;
  serviceId?: number | undefined;
  mechanicId?: number | undefined;
  customerId?: number | undefined;
  category?: string | undefined;
  city?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  minAmount?: number | undefined;
  maxAmount?: number | undefined;
  sortBy: BookingSortKey;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

/**
 * The only sort columns this endpoint will ever accept.
 *
 * A sort key cannot be a bind parameter — it is part of the SQL text — so it is
 * matched against this fixed map instead. A value that is not a key here never
 * reaches the query.
 */
const SORT_COLUMNS = {
  scheduledAt: 'b.scheduled_at',
  createdAt: 'b.created_at',
  amount: 'b.amount',
  status: 'b.status',
  reference: 'b.reference',
  customer: 'c.full_name',
  service: 's.name',
  mechanic: 'm.full_name',
} as const;

export type BookingSortKey = keyof typeof SORT_COLUMNS;
export const BOOKING_SORT_KEYS = Object.keys(SORT_COLUMNS) as [BookingSortKey, ...BookingSortKey[]];

const LIST_JOINS = `
  FROM bookings b
  JOIN customers c ON c.id = b.customer_id
  JOIN vehicles  v ON v.id = b.vehicle_id
  JOIN services  s ON s.id = b.service_id
  LEFT JOIN mechanics m ON m.id = b.mechanic_id
`;

function buildWhere(filters: BookingFilters, p: QueryParams): string {
  const conditions: string[] = [];

  if (filters.search) {
    // Wrapped in %…% and matched against the GIN trigram indexes on reference,
    // customer name and registration number.
    const term = p.add(likeTerm(filters.search));
    conditions.push(`(
      b.reference ILIKE ${term}
      OR c.full_name ILIKE ${term}
      OR c.phone ILIKE ${term}
      OR v.registration_number ILIKE ${term}
      OR s.name ILIKE ${term}
      OR m.full_name ILIKE ${term}
    )`);
  }

  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(`b.status = ANY(${p.add(filters.statuses)}::booking_status[])`);
  }
  if (filters.serviceId !== undefined) {
    conditions.push(`b.service_id = ${p.add(filters.serviceId)}`);
  }
  if (filters.mechanicId !== undefined) {
    conditions.push(`b.mechanic_id = ${p.add(filters.mechanicId)}`);
  }
  if (filters.customerId !== undefined) {
    conditions.push(`b.customer_id = ${p.add(filters.customerId)}`);
  }
  if (filters.category) {
    conditions.push(`s.category = ${p.add(filters.category)}`);
  }
  if (filters.city) {
    conditions.push(`c.city = ${p.add(filters.city)}`);
  }
  // Half-open range, so the column stays unwrapped and its index stays usable.
  //
  // The AT TIME ZONE conversion is essential: casting a bare "2026-08-20" with
  // ::timestamptz resolves it in the DATABASE session's timezone, which is UTC
  // on Neon. A booking at 00:15 IST on the 20th is 18:45 UTC on the 19th, so it
  // would silently drop out of a 20th-to-20th filter while still counting
  // towards the IST-anchored dashboard tile. Every date boundary in this API is
  // resolved in APP_TIMEZONE, and this one is no exception.
  if (filters.from) {
    const day = p.add(filters.from);
    const tz = p.add(APP_TIMEZONE);
    conditions.push(`b.scheduled_at >= (${day}::date) AT TIME ZONE ${tz}`);
  }
  if (filters.to) {
    const day = p.add(filters.to);
    const tz = p.add(APP_TIMEZONE);
    conditions.push(`b.scheduled_at < ((${day}::date) + INTERVAL '1 day') AT TIME ZONE ${tz}`);
  }
  if (filters.minAmount !== undefined) {
    conditions.push(`b.amount >= ${p.add(filters.minAmount)}`);
  }
  if (filters.maxAmount !== undefined) {
    conditions.push(`b.amount <= ${p.add(filters.maxAmount)}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * How many rows the filter matches, ignoring paging.
 *
 * Only used when a page comes back empty. COUNT(*) OVER() rides along on the
 * rows, so it costs nothing while there ARE rows — but an out-of-range page has
 * no rows to carry it, and reporting 0 there would collapse the pager and tell
 * the user "no results" when hundreds matched.
 */
export async function countBookings(
  filters: Omit<BookingFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>
): Promise<number> {
  const p = new QueryParams();
  const where = buildWhere(
    { ...filters, sortBy: 'scheduledAt', sortOrder: 'desc', limit: 0, offset: 0 },
    p
  );
  const { rows } = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total ${LIST_JOINS} ${where}`,
    p.list
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * One page of bookings, plus the total that matched.
 *
 * `COUNT(*) OVER()` returns the unpaginated total on every row, so the table
 * gets its rows and its page count from a single trip to the database instead
 * of running the filter twice.
 */
export async function selectBookings(filters: BookingFilters): Promise<BookingRow[]> {
  const p = new QueryParams();
  const where = buildWhere(filters, p);
  const sortColumn = SORT_COLUMNS[filters.sortBy];
  const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limit = p.add(filters.limit);
  const offset = p.add(filters.offset);

  const { rows } = await query<BookingRow>(
    `
    SELECT
      b.id, b.reference, b.status, b.payment_status, b.amount,
      b.scheduled_at, b.created_at, b.completed_at, b.rating,
      c.id AS customer_id, c.full_name AS customer_name,
      c.phone AS customer_phone, c.city AS customer_city,
      v.id AS vehicle_id, v.make, v.model, v.year, v.registration_number,
      s.id AS service_id, s.name AS service_name, s.category AS service_category,
      m.id AS mechanic_id, m.full_name AS mechanic_name,
      COUNT(*) OVER()::text AS total_count
    ${LIST_JOINS}
    ${where}
    -- b.id is the tiebreaker: without it, two rows with the same sort value can
    -- swap places between pages and an item is shown twice or skipped.
    ORDER BY ${sortColumn} ${direction} NULLS LAST, b.id DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    p.list
  );

  return rows;
}

export async function selectBookingById(id: number): Promise<BookingDetailRow | null> {
  const p = new QueryParams();
  const { rows } = await query<BookingDetailRow>(
    `
    SELECT
      b.id, b.reference, b.status, b.payment_status, b.amount,
      b.scheduled_at, b.created_at, b.started_at, b.completed_at,
      b.cancelled_at, b.cancellation_reason, b.rating, b.notes, b.updated_at,
      c.id AS customer_id, c.full_name AS customer_name, c.email AS customer_email,
      c.phone AS customer_phone, c.city AS customer_city,
      v.id AS vehicle_id, v.make, v.model, v.year, v.registration_number, v.fuel_type,
      s.id AS service_id, s.name AS service_name, s.category AS service_category,
      s.duration_minutes, s.base_price,
      m.id AS mechanic_id, m.full_name AS mechanic_name, m.phone AS mechanic_phone,
      m.specialization AS mechanic_specialization
    ${LIST_JOINS}
    WHERE b.id = ${p.add(id)}
    `,
    p.list
  );

  return rows[0] ?? null;
}

export interface StatusHistoryRow {
  id: number;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  changed_at: Date;
  changed_by: string;
  note: string | null;
}

export async function selectBookingHistory(bookingId: number): Promise<StatusHistoryRow[]> {
  const p = new QueryParams();
  const { rows } = await query<StatusHistoryRow>(
    `
    SELECT id, from_status, to_status, changed_at, changed_by, note
    FROM booking_status_history
    WHERE booking_id = ${p.add(bookingId)}
    ORDER BY changed_at ASC, id ASC
    `,
    p.list
  );
  return rows;
}
