/**
 * Read-only sanity check on the seeded database.
 *
 *   npm run db:verify
 *
 * It prints the row counts and the exact numbers the dashboard will show, and
 * fails with a non-zero exit code if any integrity rule is broken. This is how
 * "the data is good" gets proven instead of assumed.
 */
import { env } from '../config/env.js';
import { closePool, query } from './pool.js';

interface Check {
  label: string;
  sql: string;
  /** Bound to $1, $2, … in `sql`. A placeholder may be reused any number of times. */
  params?: readonly unknown[];
  /** A check passes when it returns zero rows — each row is a violation. */
  expectEmpty: true;
}

const INTEGRITY_CHECKS: readonly Check[] = [
  {
    label: 'every non-pending, non-cancelled booking has a mechanic',
    sql: `SELECT id FROM bookings
          WHERE status NOT IN ('pending', 'cancelled') AND mechanic_id IS NULL`,
    expectEmpty: true,
  },
  {
    label: 'completed bookings have a completed_at',
    sql: `SELECT id FROM bookings WHERE status = 'completed' AND completed_at IS NULL`,
    expectEmpty: true,
  },
  {
    label: 'cancelled bookings have a cancelled_at',
    sql: `SELECT id FROM bookings WHERE status = 'cancelled' AND cancelled_at IS NULL`,
    expectEmpty: true,
  },
  {
    label: 'unfinished bookings carry no finishing timestamps',
    sql: `SELECT id FROM bookings
          WHERE status IN ('pending', 'assigned', 'on_the_way', 'in_progress')
            AND (completed_at IS NOT NULL OR cancelled_at IS NOT NULL)`,
    expectEmpty: true,
  },
  {
    // started_at IS NULL is checked explicitly: comparing against NULL yields
    // NULL, not TRUE, so a completed booking with no start time would slip past
    // a bare `completed_at <= started_at`.
    label: 'no booking was completed before it started',
    sql: `SELECT id FROM bookings
          WHERE completed_at IS NOT NULL
            AND (started_at IS NULL OR completed_at <= started_at)`,
    expectEmpty: true,
  },
  {
    label: 'no booking pre-dates its customer signing up',
    sql: `SELECT b.id FROM bookings b
          JOIN customers c ON c.id = b.customer_id
          WHERE b.created_at < c.created_at`,
    expectEmpty: true,
  },
  {
    label: 'no booking pre-dates the vehicle it is for',
    sql: `SELECT b.id FROM bookings b
          JOIN vehicles v ON v.id = b.vehicle_id
          WHERE b.created_at < v.created_at`,
    expectEmpty: true,
  },
  {
    label: 'no mechanic is on two live jobs at once',
    sql: `SELECT mechanic_id FROM bookings
          WHERE status IN ('on_the_way', 'in_progress') AND mechanic_id IS NOT NULL
          GROUP BY mechanic_id HAVING COUNT(*) > 1`,
    expectEmpty: true,
  },
  {
    label: 'no event happens before the booking was created',
    sql: `SELECT id FROM bookings
          WHERE scheduled_at < created_at
             OR (started_at IS NOT NULL AND started_at < created_at)
             OR (cancelled_at IS NOT NULL AND cancelled_at < created_at)`,
    expectEmpty: true,
  },
  {
    label: 'no completed or cancelled event is dated in the future',
    sql: `SELECT id FROM bookings
          WHERE completed_at > NOW() OR cancelled_at > NOW() OR started_at > NOW()`,
    expectEmpty: true,
  },
  {
    label: 'every booking has at least one status-history row',
    sql: `SELECT b.id FROM bookings b
          LEFT JOIN booking_status_history h ON h.booking_id = b.id
          WHERE h.id IS NULL`,
    expectEmpty: true,
  },
  {
    label: "every booking's last history row matches its current status",
    sql: `SELECT b.id
          FROM bookings b
          JOIN LATERAL (
            SELECT to_status FROM booking_status_history h
            WHERE h.booking_id = b.id
            ORDER BY h.changed_at DESC, h.id DESC
            LIMIT 1
          ) last ON TRUE
          WHERE last.to_status <> b.status`,
    expectEmpty: true,
  },
  {
    label: 'every vehicle on a booking belongs to that booking’s customer',
    sql: `SELECT b.id FROM bookings b
          JOIN vehicles v ON v.id = b.vehicle_id
          WHERE v.customer_id <> b.customer_id`,
    expectEmpty: true,
  },
  {
    // Guards a bug this seeder actually had: with today's slots pinned to a
    // fixed working day, seeding in the evening left nothing in flight at all.
    label: 'at least one job is live right now',
    sql: `SELECT 1 WHERE NOT EXISTS (
            SELECT 1 FROM bookings WHERE status IN ('on_the_way', 'in_progress')
          )`,
    expectEmpty: true,
  },
  {
    // The same rule the live service applies, so a simulated status change can
    // never put the data into a state this check calls broken.
    label: 'mechanics marked on_job are exactly those on a live job',
    sql: `WITH live AS (
            SELECT DISTINCT mechanic_id AS id
            FROM bookings
            WHERE mechanic_id IS NOT NULL AND status IN ('on_the_way', 'in_progress')
          )
          SELECT id FROM live
          EXCEPT SELECT id FROM mechanics WHERE status = 'on_job'
          UNION ALL
          SELECT id FROM mechanics WHERE status = 'on_job'
          EXCEPT SELECT id FROM live`,
    expectEmpty: true,
  },
  {
    label: 'ratings only exist on work that was actually completed',
    sql: `SELECT id FROM bookings WHERE rating IS NOT NULL AND completed_at IS NULL`,
    expectEmpty: true,
  },
];

function inr(value: string | number | null): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

async function main(): Promise<void> {
  // ------------------------------------------------------------- row counts
  const counts = await query<{ table_name: string; total: string }>(`
    SELECT 'services' AS table_name, COUNT(*)::text AS total FROM services
    UNION ALL SELECT 'customers', COUNT(*)::text FROM customers
    UNION ALL SELECT 'vehicles', COUNT(*)::text FROM vehicles
    UNION ALL SELECT 'mechanics', COUNT(*)::text FROM mechanics
    UNION ALL SELECT 'bookings', COUNT(*)::text FROM bookings
    UNION ALL SELECT 'booking_status_history', COUNT(*)::text FROM booking_status_history
  `);

  console.log('▸ row counts');
  for (const row of counts.rows) {
    console.log(`  ${row.table_name.padEnd(24)} ${row.total.padStart(6)}`);
  }

  // -------------------------------------------------- the dashboard numbers
  // Two things this pattern gets right, and one it does not:
  //   * the day boundaries are computed in APP_TIMEZONE, so "today" means today
  //     for the ops team even though the API runs on a UTC server;
  //   * the half-open range leaves scheduled_at unwrapped, so a real WHERE on it
  //     can use idx_bookings_scheduled_at. (This particular query is a
  //     COUNT(*) FILTER aggregate over the whole table, so it seq-scans anyway —
  //     the shape matters for the /api/bookings route that comes later.)
  const overview = await query<Record<string, string>>(
    `
    WITH day_window AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1 AS day_start,
             (date_trunc('day', NOW() AT TIME ZONE $1) + INTERVAL '1 day') AT TIME ZONE $1 AS day_end
    )
    SELECT
      COUNT(*)::text                                                          AS total_bookings,
      COUNT(*) FILTER (
        WHERE scheduled_at >= (SELECT day_start FROM day_window)
          AND scheduled_at <  (SELECT day_end FROM day_window)
      )::text                                                                 AS todays_bookings,
      COUNT(*) FILTER (WHERE status = 'completed')::text                      AS completed,
      COUNT(*) FILTER (WHERE status = 'pending')::text                        AS pending,
      COUNT(*) FILTER (WHERE status = 'assigned')::text                       AS assigned,
      COUNT(*) FILTER (WHERE status = 'on_the_way')::text                     AS on_the_way,
      COUNT(*) FILTER (WHERE status = 'in_progress')::text                    AS in_progress,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text                      AS cancelled,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::text      AS revenue
    FROM bookings
  `,
    [env.APP_TIMEZONE]
  );
  const staff = await query<{ active_mechanics: string; new_customers: string }>(`
    SELECT
      (SELECT COUNT(*) FROM mechanics WHERE status <> 'off_duty')::text AS active_mechanics,
      (SELECT COUNT(*) FROM customers
        WHERE created_at >= NOW() - INTERVAL '30 days')::text            AS new_customers
  `);

  const o = overview.rows[0] ?? {};
  const s = staff.rows[0];

  console.log('\n▸ dashboard preview');
  console.log(`  total bookings     ${o['total_bookings']}`);
  console.log(`  today's bookings   ${o['todays_bookings']}`);
  console.log(`  completed          ${o['completed']}`);
  console.log(`  pending            ${o['pending']}`);
  console.log(`  assigned           ${o['assigned']}`);
  console.log(`  on the way         ${o['on_the_way']}`);
  console.log(`  in progress        ${o['in_progress']}`);
  console.log(`  cancelled          ${o['cancelled']}`);
  console.log(`  total revenue      ${inr(o['revenue'] ?? 0)}`);
  console.log(`  active mechanics   ${s?.active_mechanics ?? '0'}`);
  console.log(`  new customers      ${s?.new_customers ?? '0'} (last 30 days)`);
  console.log(`  ("today" resolved in ${env.APP_TIMEZONE})`);

  // --------------------------------------------------------------- spread
  const categories = await query<{ category: string; bookings: string; revenue: string }>(`
    SELECT s.category,
           COUNT(*)::text AS bookings,
           COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'), 0)::text AS revenue
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    GROUP BY s.category
    ORDER BY COUNT(*) DESC
  `);
  console.log('\n▸ service categories');
  for (const row of categories.rows) {
    console.log(
      `  ${row.category.padEnd(24)} ${row.bookings.padStart(4)} bookings   ${inr(row.revenue)}`
    );
  }

  const range = await query<{ first_day: string; last_day: string; days: string }>(`
    SELECT MIN(scheduled_at)::date::text AS first_day,
           MAX(scheduled_at)::date::text AS last_day,
           COUNT(DISTINCT scheduled_at::date)::text AS days
    FROM bookings
  `);
  const r = range.rows[0];
  console.log(`\n▸ date range        ${r?.first_day} → ${r?.last_day} (${r?.days} distinct days)`);

  // ---------------------------------------------------------- integrity
  console.log('\n▸ integrity checks');
  let failures = 0;
  for (const check of INTEGRITY_CHECKS) {
    const { rows } = await query(check.sql, check.params);
    if (rows.length === 0) {
      console.log(`  PASS  ${check.label}`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${check.label} — ${rows.length} bad row(s)`);
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error('\nVerification failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool().catch(() => undefined);
  });
