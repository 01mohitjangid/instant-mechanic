import { query } from '../pool.js';
import { QueryParams } from '../query-params.js';

export interface OverviewRow {
  total_bookings: string;
  todays_bookings: string;
  completed_bookings: string;
  pending_bookings: string;
  cancelled_bookings: string;
  active_jobs: string;
  total_revenue: string;
  todays_revenue: string;
  average_rating: string | null;
  average_ticket: string | null;
  active_mechanics: string;
  total_mechanics: string;
  new_customers: string;
  total_customers: string;
}

/**
 * Every headline number in one round trip.
 *
 * FILTER clauses mean the whole bookings table is scanned once instead of once
 * per tile. "Today" and "new customers" are resolved in the operations
 * timezone, not the database session's UTC.
 */
export async function selectOverview(timezone: string): Promise<OverviewRow> {
  const p = new QueryParams();
  const tz = p.add(timezone);

  const { rows } = await query<OverviewRow>(
    `
    WITH day_window AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz} AS day_start,
             (date_trunc('day', NOW() AT TIME ZONE ${tz}) + INTERVAL '1 day')
               AT TIME ZONE ${tz} AS day_end
    ),
    booking_totals AS (
      SELECT
        COUNT(*)                                                        AS total_bookings,
        COUNT(*) FILTER (
          WHERE b.scheduled_at >= w.day_start AND b.scheduled_at < w.day_end
        )                                                               AS todays_bookings,
        COUNT(*) FILTER (WHERE b.status = 'completed')                  AS completed_bookings,
        COUNT(*) FILTER (WHERE b.status = 'pending')                    AS pending_bookings,
        COUNT(*) FILTER (WHERE b.status = 'cancelled')                  AS cancelled_bookings,
        COUNT(*) FILTER (
          WHERE b.status IN ('assigned', 'on_the_way', 'in_progress')
        )                                                               AS active_jobs,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0) AS total_revenue,
          -- Keyed on completed_at: money is earned when the job finishes, not
        -- when it was scheduled. The analytics series deliberately keys on the
        -- scheduled day instead, so bookings and revenue share one x-axis.
        COALESCE(SUM(b.amount) FILTER (
          WHERE b.status = 'completed'
            AND b.completed_at >= w.day_start AND b.completed_at < w.day_end
        ), 0)                                                           AS todays_revenue,
        AVG(b.rating)                                                   AS average_rating,
        AVG(b.amount) FILTER (WHERE b.status = 'completed')             AS average_ticket
      FROM bookings b CROSS JOIN day_window w
    )
    SELECT
      t.total_bookings::text,
      t.todays_bookings::text,
      t.completed_bookings::text,
      t.pending_bookings::text,
      t.cancelled_bookings::text,
      t.active_jobs::text,
      t.total_revenue::text,
      t.todays_revenue::text,
      t.average_rating::text,
      t.average_ticket::text,
      (SELECT COUNT(*) FROM mechanics WHERE status <> 'off_duty')::text AS active_mechanics,
      (SELECT COUNT(*) FROM mechanics)::text                            AS total_mechanics,
      (SELECT COUNT(*) FROM customers
        WHERE created_at >= NOW() - INTERVAL '30 days')::text           AS new_customers,
      (SELECT COUNT(*) FROM customers)::text                            AS total_customers
    FROM booking_totals t
    `,
    p.list
  );

  const row = rows[0];
  if (!row) throw new Error('Overview query returned no row');
  return row;
}

export interface SeriesRow {
  date: string;
  bookings: string;
  completed: string;
  cancelled: string;
  revenue: string;
}

/**
 * One row per day for the last `days` days, including days with no bookings.
 *
 * `generate_series` supplies the calendar, so a quiet Sunday shows as a zero
 * instead of vanishing and making the chart lie about its x-axis.
 *
 * Bookings and revenue are both keyed on the scheduled day, so the two lines
 * share one axis. Revenue counts only bookings that actually completed.
 */
export async function selectTimeSeries(timezone: string, days: number): Promise<SeriesRow[]> {
  const p = new QueryParams();
  const tz = p.add(timezone);
  const span = p.add(days);

  const { rows } = await query<SeriesRow>(
    `
    WITH bounds AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE ${tz})
               - make_interval(days => (${span}::int - 1)) AS first_day,
             date_trunc('day', NOW() AT TIME ZONE ${tz})   AS last_day
    ),
    calendar AS (
      SELECT generate_series(first_day, last_day, INTERVAL '1 day')::date AS day FROM bounds
    ),
    scoped AS (
      SELECT (b.scheduled_at AT TIME ZONE ${tz})::date AS day, b.status, b.amount
      FROM bookings b CROSS JOIN bounds
      WHERE b.scheduled_at >= bounds.first_day AT TIME ZONE ${tz}
        AND b.scheduled_at <  (bounds.last_day + INTERVAL '1 day') AT TIME ZONE ${tz}
    )
    SELECT
      c.day::text                                                        AS date,
      COUNT(s.day)::text                                                 AS bookings,
      COUNT(s.day) FILTER (WHERE s.status = 'completed')::text           AS completed,
      COUNT(s.day) FILTER (WHERE s.status = 'cancelled')::text           AS cancelled,
      COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'completed'), 0)::text AS revenue
    FROM calendar c
    LEFT JOIN scoped s ON s.day = c.day
    GROUP BY c.day
    ORDER BY c.day
    `,
    p.list
  );

  return rows;
}

export interface StatusRow {
  status: string;
  bookings: string;
  value: string;
}

/**
 * Every status appears, including ones with no bookings, so the chart legend is
 * stable between refreshes.
 *
 * `value` is the total amount of the bookings sitting in that status, not
 * earned revenue. For `completed` the two are the same; for `pending` it is the
 * pipeline waiting to be worked, which is the number an operations team
 * actually wants. Earned revenue is the overview's `totalRevenue`.
 */
export async function selectStatusBreakdown(): Promise<StatusRow[]> {
  const { rows } = await query<StatusRow>(`
    SELECT
      s.status::text                       AS status,
      COUNT(b.id)::text                    AS bookings,
      COALESCE(SUM(b.amount), 0)::text     AS value
    FROM unnest(enum_range(NULL::booking_status)) AS s(status)
    LEFT JOIN bookings b ON b.status = s.status
    GROUP BY s.status
    ORDER BY COUNT(b.id) DESC, s.status
  `);
  return rows;
}

export interface CategoryRow {
  category: string;
  bookings: string;
  revenue: string;
}

export async function selectServiceBreakdown(): Promise<CategoryRow[]> {
  const { rows } = await query<CategoryRow>(`
    SELECT
      s.category,
      COUNT(b.id)::text                                                    AS bookings,
      COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0)::text AS revenue
    FROM services s
    LEFT JOIN bookings b ON b.service_id = s.id
    GROUP BY s.category
    ORDER BY COUNT(b.id) DESC, s.category
  `);
  return rows;
}
