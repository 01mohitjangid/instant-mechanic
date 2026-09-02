import type { BookingStatus, MechanicStatus } from '@instant-mechanic/shared';
import { query } from '../pool.js';
import { QueryParams } from '../query-params.js';
import { likeTerm } from '../../lib/sql.js';

export interface MechanicRow {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  specialization: string;
  status: MechanicStatus;
  city: string;
  latitude: string | null;
  longitude: string | null;
  hired_at: string;
  jobs_completed: string;
  jobs_cancelled: string;
  active_jobs: string;
  revenue_generated: string;
  average_rating: string | null;
  current_booking_id: number | null;
  current_booking_reference: string | null;
  current_booking_status: BookingStatus | null;
  current_booking_scheduled_at: Date | null;
  current_booking_customer: string | null;
  current_booking_service: string | null;
  total_count: string;
}

const SORT_COLUMNS = {
  name: 'm.full_name',
  status: 'm.status',
  jobsCompleted: 'stats.jobs_completed',
  revenue: 'stats.revenue_generated',
  rating: 'stats.average_rating',
  hiredAt: 'm.hired_at',
} as const;

export type MechanicSortKey = keyof typeof SORT_COLUMNS;
export const MECHANIC_SORT_KEYS = Object.keys(SORT_COLUMNS) as [
  MechanicSortKey,
  ...MechanicSortKey[],
];

export interface MechanicFilters {
  search?: string | undefined;
  statuses?: MechanicStatus[] | undefined;
  city?: string | undefined;
  sortBy: MechanicSortKey;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

/**
 * Mechanics with their workload and the job they are on.
 *
 * Jobs completed, revenue and rating are all derived from `bookings` rather
 * than stored on the mechanic row, so there is one source of truth and the
 * numbers cannot go stale.
 *
 * The current job uses LATERAL: for each mechanic PostgreSQL fetches just the
 * single most relevant booking — a live one if there is one, otherwise the most
 * recent — instead of joining every booking and throwing the rest away.
 */
function buildWhere(
  filters: Pick<MechanicFilters, 'search' | 'statuses' | 'city'>,
  p: QueryParams
): string {
  const conditions: string[] = [];

  if (filters.search) {
    const term = p.add(likeTerm(filters.search));
    conditions.push(
      `(m.full_name ILIKE ${term} OR m.email ILIKE ${term} OR m.specialization ILIKE ${term})`
    );
  }
  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(`m.status = ANY(${p.add(filters.statuses)}::mechanic_status[])`);
  }
  if (filters.city) {
    conditions.push(`m.city = ${p.add(filters.city)}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/** The matching total, for when a page is out of range and carries no rows. */
export async function countMechanics(
  filters: Pick<MechanicFilters, 'search' | 'statuses' | 'city'>
): Promise<number> {
  const p = new QueryParams();
  const where = buildWhere(filters, p);
  const { rows } = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM mechanics m ${where}`,
    p.list
  );
  return Number(rows[0]?.total ?? 0);
}

export async function selectMechanics(filters: MechanicFilters): Promise<MechanicRow[]> {
  const p = new QueryParams();
  const where = buildWhere(filters, p);
  const sortColumn = SORT_COLUMNS[filters.sortBy];
  const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limit = p.add(filters.limit);
  const offset = p.add(filters.offset);

  const { rows } = await query<MechanicRow>(
    `
    SELECT
      m.id, m.full_name, m.email, m.phone, m.specialization, m.status, m.city,
      m.latitude::text, m.longitude::text, m.hired_at::text,
      stats.jobs_completed::text,
      stats.jobs_cancelled::text,
      stats.active_jobs::text,
      stats.revenue_generated::text,
      stats.average_rating::text,
      job.id           AS current_booking_id,
      job.reference    AS current_booking_reference,
      job.status       AS current_booking_status,
      job.scheduled_at AS current_booking_scheduled_at,
      job.customer_name AS current_booking_customer,
      job.service_name  AS current_booking_service,
      COUNT(*) OVER()::text AS total_count
    FROM mechanics m
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE b.status = 'completed')                   AS jobs_completed,
        COUNT(*) FILTER (WHERE b.status = 'cancelled')                   AS jobs_cancelled,
        COUNT(*) FILTER (
          WHERE b.status IN ('assigned', 'on_the_way', 'in_progress')
        )                                                                AS active_jobs,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0)  AS revenue_generated,
        AVG(b.rating)                                                    AS average_rating
      FROM bookings b
      WHERE b.mechanic_id = m.id
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT b.id, b.reference, b.status, b.scheduled_at,
             c.full_name AS customer_name, s.name AS service_name
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN services  s ON s.id = b.service_id
      WHERE b.mechanic_id = m.id
      -- A job in flight wins over history; otherwise show the most recent one.
      ORDER BY (b.status IN ('on_the_way', 'in_progress')) DESC,
               (b.status = 'assigned') DESC,
               b.scheduled_at DESC, b.id DESC
      LIMIT 1
    ) job ON TRUE
    ${where}
    ORDER BY ${sortColumn} ${direction} NULLS LAST, m.id ASC
    LIMIT ${limit} OFFSET ${offset}
    `,
    p.list
  );

  return rows;
}

export async function selectMechanicById(id: number): Promise<MechanicRow | null> {
  // Deliberately not reusing selectMechanics: that query computes the window
  // COUNT over every mechanic, which is wasted work for a single row.
  const p = new QueryParams();
  const { rows: single } = await query<MechanicRow>(
    `
    SELECT
      m.id, m.full_name, m.email, m.phone, m.specialization, m.status, m.city,
      m.latitude::text, m.longitude::text, m.hired_at::text,
      stats.jobs_completed::text, stats.jobs_cancelled::text, stats.active_jobs::text,
      stats.revenue_generated::text, stats.average_rating::text,
      job.id AS current_booking_id, job.reference AS current_booking_reference,
      job.status AS current_booking_status, job.scheduled_at AS current_booking_scheduled_at,
      job.customer_name AS current_booking_customer, job.service_name AS current_booking_service,
      '1'::text AS total_count
    FROM mechanics m
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE b.status = 'completed')                  AS jobs_completed,
        COUNT(*) FILTER (WHERE b.status = 'cancelled')                  AS jobs_cancelled,
        COUNT(*) FILTER (
          WHERE b.status IN ('assigned', 'on_the_way', 'in_progress')
        )                                                               AS active_jobs,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0) AS revenue_generated,
        AVG(b.rating)                                                   AS average_rating
      FROM bookings b WHERE b.mechanic_id = m.id
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT b.id, b.reference, b.status, b.scheduled_at,
             c.full_name AS customer_name, s.name AS service_name
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN services  s ON s.id = b.service_id
      WHERE b.mechanic_id = m.id
      ORDER BY (b.status IN ('on_the_way', 'in_progress')) DESC,
               (b.status = 'assigned') DESC,
               b.scheduled_at DESC, b.id DESC
      LIMIT 1
    ) job ON TRUE
    WHERE m.id = ${p.add(id)}
    `,
    p.list
  );

  return single[0] ?? null;
}
