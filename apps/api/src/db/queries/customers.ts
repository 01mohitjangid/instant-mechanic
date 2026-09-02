import { query } from '../pool.js';
import { QueryParams } from '../query-params.js';
import { likeTerm } from '../../lib/sql.js';

export interface CustomerRow {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  created_at: Date;
  vehicle_count: string;
  total_bookings: string;
  completed_bookings: string;
  cancelled_bookings: string;
  lifetime_value: string;
  last_booking_at: Date | null;
  total_count: string;
}

const SORT_COLUMNS = {
  name: 'c.full_name',
  createdAt: 'c.created_at',
  totalBookings: 'stats.total_bookings',
  lifetimeValue: 'stats.lifetime_value',
  lastBooking: 'stats.last_booking_at',
} as const;

export type CustomerSortKey = keyof typeof SORT_COLUMNS;
export const CUSTOMER_SORT_KEYS = Object.keys(SORT_COLUMNS) as [
  CustomerSortKey,
  ...CustomerSortKey[],
];

export interface CustomerFilters {
  search?: string | undefined;
  city?: string | undefined;
  sortBy: CustomerSortKey;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

/**
 * Customers with their booking history summarised.
 *
 * Lifetime value counts completed bookings only — money that was actually
 * earned, not money that was quoted and then cancelled.
 */
function buildWhere(filters: Pick<CustomerFilters, 'search' | 'city'>, p: QueryParams): string {
  const conditions: string[] = [];

  if (filters.search) {
    const term = p.add(likeTerm(filters.search));
    conditions.push(
      `(c.full_name ILIKE ${term} OR c.email ILIKE ${term} OR c.phone ILIKE ${term})`
    );
  }
  if (filters.city) {
    conditions.push(`c.city = ${p.add(filters.city)}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/** The matching total, for when a page is out of range and carries no rows. */
export async function countCustomers(
  filters: Pick<CustomerFilters, 'search' | 'city'>
): Promise<number> {
  const p = new QueryParams();
  const where = buildWhere(filters, p);
  const { rows } = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM customers c ${where}`,
    p.list
  );
  return Number(rows[0]?.total ?? 0);
}

export async function selectCustomers(filters: CustomerFilters): Promise<CustomerRow[]> {
  const p = new QueryParams();
  const where = buildWhere(filters, p);
  const sortColumn = SORT_COLUMNS[filters.sortBy];
  const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limit = p.add(filters.limit);
  const offset = p.add(filters.offset);

  const { rows } = await query<CustomerRow>(
    `
    SELECT
      c.id, c.full_name, c.email, c.phone, c.city, c.created_at,
      (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id)::text AS vehicle_count,
      stats.total_bookings::text,
      stats.completed_bookings::text,
      stats.cancelled_bookings::text,
      stats.lifetime_value::text,
      stats.last_booking_at,
      COUNT(*) OVER()::text AS total_count
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)                                                        AS total_bookings,
        COUNT(*) FILTER (WHERE b.status = 'completed')                  AS completed_bookings,
        COUNT(*) FILTER (WHERE b.status = 'cancelled')                  AS cancelled_bookings,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0) AS lifetime_value,
        MAX(b.scheduled_at)                                             AS last_booking_at
      FROM bookings b
      WHERE b.customer_id = c.id
    ) stats ON TRUE
    ${where}
    ORDER BY ${sortColumn} ${direction} NULLS LAST, c.id ASC
    LIMIT ${limit} OFFSET ${offset}
    `,
    p.list
  );

  return rows;
}

export async function selectCustomerById(id: number): Promise<CustomerRow | null> {
  const p = new QueryParams();
  const { rows } = await query<CustomerRow>(
    `
    SELECT
      c.id, c.full_name, c.email, c.phone, c.city, c.created_at,
      (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id)::text AS vehicle_count,
      stats.total_bookings::text, stats.completed_bookings::text,
      stats.cancelled_bookings::text, stats.lifetime_value::text, stats.last_booking_at,
      '1'::text AS total_count
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)                                                        AS total_bookings,
        COUNT(*) FILTER (WHERE b.status = 'completed')                  AS completed_bookings,
        COUNT(*) FILTER (WHERE b.status = 'cancelled')                  AS cancelled_bookings,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0) AS lifetime_value,
        MAX(b.scheduled_at)                                             AS last_booking_at
      FROM bookings b WHERE b.customer_id = c.id
    ) stats ON TRUE
    WHERE c.id = ${p.add(id)}
    `,
    p.list
  );
  return rows[0] ?? null;
}
