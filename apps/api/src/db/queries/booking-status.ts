import type { PoolClient } from 'pg';
import type { BookingStatus } from '@instant-mechanic/shared';
import { QueryParams } from '../query-params.js';

/**
 * The write path.
 *
 * Everything here runs inside one transaction opened by the service, so a
 * booking, its history row and the mechanic's availability can never end up
 * disagreeing with each other.
 */

export interface LockedBookingRow {
  id: number;
  reference: string;
  status: BookingStatus;
  mechanic_id: number | null;
  customer_city: string;
  started_at: Date | null;
}

/**
 * Read the booking and hold the row until the transaction ends.
 *
 * FOR UPDATE is the point: without it, two simultaneous requests could both
 * read "assigned" and both write "on_the_way", producing two history rows for
 * one real transition.
 */
export async function lockBooking(
  client: PoolClient,
  id: number
): Promise<LockedBookingRow | null> {
  const p = new QueryParams();
  const { rows } = await client.query<LockedBookingRow>(
    `SELECT b.id, b.reference, b.status, b.mechanic_id, b.started_at, c.city AS customer_city
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     WHERE b.id = ${p.add(id)}
     FOR UPDATE OF b`,
    p.list
  );
  return rows[0] ?? null;
}

/**
 * An available mechanic who is not already on a live job.
 *
 * Prefers the customer's own city, because sending someone across town is not
 * what a dispatcher would do.
 */
export async function findFreeMechanic(client: PoolClient, city: string): Promise<number | null> {
  const p = new QueryParams();
  const { rows } = await client.query<{ id: number }>(
    `SELECT m.id
     FROM mechanics m
     WHERE m.status <> 'off_duty'
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.mechanic_id = m.id AND b.status IN ('on_the_way', 'in_progress')
       )
     ORDER BY (m.city = ${p.add(city)}) DESC, random()
     LIMIT 1
     -- Without the lock, two transactions running at the same instant both see
     -- the same free mechanic and both take them. SKIP LOCKED makes the second
     -- caller step over the row the first has already claimed and pick someone
     -- else, instead of blocking or double-booking.
     FOR UPDATE OF m SKIP LOCKED`,
    p.list
  );
  return rows[0]?.id ?? null;
}

/**
 * Take the mechanic's row lock before reading or writing their availability.
 *
 * Under READ COMMITTED each statement gets its own snapshot, so two
 * transactions can both decide a mechanic is free and both put them on a job.
 * Locking first serialises that decision: the second transaction waits, then
 * re-reads and sees the truth.
 */
export async function lockMechanic(client: PoolClient, mechanicId: number): Promise<void> {
  const p = new QueryParams();
  await client.query(`SELECT id FROM mechanics WHERE id = ${p.add(mechanicId)} FOR UPDATE`, p.list);
}

/**
 * How many OTHER bookings this mechanic is live on right now.
 *
 * The one rule the schema cannot express: a CHECK constraint sees a single row,
 * and "this person is already out on another job" is a fact about a different
 * row. Call `lockMechanic` first or the answer can go stale before it is used.
 */
export async function countOtherLiveJobs(
  client: PoolClient,
  mechanicId: number,
  exceptBookingId: number
): Promise<number> {
  const p = new QueryParams();
  const { rows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM bookings
     WHERE mechanic_id = ${p.add(mechanicId)}
       AND id <> ${p.add(exceptBookingId)}
       AND status IN ('on_the_way', 'in_progress')`,
    p.list
  );
  return Number(rows[0]?.total ?? 0);
}

export interface StatusChangeInput {
  bookingId: number;
  toStatus: BookingStatus;
  mechanicId: number | null;
  cancellationReason: string | null;
}

/**
 * Move the booking, setting exactly the timestamps its new status requires.
 *
 * The schema's CHECK constraints enforce these pairings, so getting one wrong
 * fails loudly here rather than leaving a half-valid row behind.
 */
export async function applyStatusChange(
  client: PoolClient,
  input: StatusChangeInput
): Promise<void> {
  const p = new QueryParams();
  const id = p.add(input.bookingId);
  const status = p.add(input.toStatus);
  const mechanic = p.add(input.mechanicId);
  const reason = p.add(input.cancellationReason);

  await client.query(
    `UPDATE bookings
     SET status       = ${status}::booking_status,
         mechanic_id  = COALESCE(${mechanic}, mechanic_id),
         started_at   = CASE
                          WHEN ${status}::booking_status IN ('in_progress', 'completed')
                            THEN COALESCE(started_at, NOW())
                          ELSE started_at
                        END,
         -- Only the status being written decides its own timestamp. The schema
         -- would allow a completed-then-cancelled booking to keep its
         -- completed_at, but isLegalTransition() refuses every move out of a
         -- terminal status, so that row can never be written from here. A
         -- branch that cannot run is a claim about behaviour that isn't true.
         completed_at = CASE
                          WHEN ${status}::booking_status = 'completed' THEN NOW()
                          ELSE NULL
                        END,
         cancelled_at = CASE
                          WHEN ${status}::booking_status = 'cancelled' THEN NOW()
                          ELSE NULL
                        END,
         cancellation_reason = CASE
                          WHEN ${status}::booking_status = 'cancelled' THEN ${reason}
                          ELSE NULL
                        END,
         payment_status = CASE
                          WHEN ${status}::booking_status = 'completed' THEN 'paid'::payment_status
                          ELSE payment_status
                        END
     WHERE id = ${id}`,
    p.list
  );
}

export async function insertStatusHistory(
  client: PoolClient,
  entry: {
    bookingId: number;
    /** Null for the very first row, when the booking is created as pending. */
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus;
    changedBy: string;
    note: string | null;
  }
): Promise<{ id: number; changed_at: Date }> {
  const p = new QueryParams();
  const { rows } = await client.query<{ id: number; changed_at: Date }>(
    `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, note)
     VALUES (${p.add(entry.bookingId)}, ${p.add(entry.fromStatus)}::booking_status,
             ${p.add(entry.toStatus)}::booking_status, ${p.add(entry.changedBy)}, ${p.add(entry.note)})
     RETURNING id, changed_at`,
    p.list
  );
  const row = rows[0];
  if (!row) throw new Error('Status history insert returned no row');
  return row;
}

/**
 * Recompute one mechanic's availability from their bookings.
 *
 * Derived, never guessed: "on_job" means they really do have a live booking
 * right now, so the mechanics page cannot drift away from the truth.
 */
export async function refreshMechanicAvailability(
  client: PoolClient,
  mechanicId: number
): Promise<void> {
  // Lock first. The EXISTS below runs on this statement's snapshot, so without
  // the lock a transaction finishing one job can overwrite "on_job" that
  // another transaction just wrote for a different job.
  await lockMechanic(client, mechanicId);

  const p = new QueryParams();
  const id = p.add(mechanicId);
  await client.query(
    `UPDATE mechanics m
     SET status = CASE
       WHEN EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.mechanic_id = m.id AND b.status IN ('on_the_way', 'in_progress')
       ) THEN 'on_job'::mechanic_status
       -- Only wake someone who was marked busy; an off-duty mechanic stays off
       -- duty, and someone on a break keeps their break.
       WHEN m.status = 'on_job' THEN 'available'::mechanic_status
       ELSE m.status
     END
     WHERE m.id = ${id}`,
    p.list
  );
}

export interface EventContextRow {
  reference: string;
  amount: string;
  customer_name: string;
  service_name: string;
  mechanic_name: string | null;
}

/** Everything the real-time event needs, so the client needs no follow-up call. */
export async function selectEventContext(
  client: PoolClient,
  bookingId: number
): Promise<EventContextRow | null> {
  const p = new QueryParams();
  const { rows } = await client.query<EventContextRow>(
    `SELECT b.reference, b.amount::text,
            c.full_name AS customer_name,
            s.name      AS service_name,
            m.full_name AS mechanic_name
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN services  s ON s.id = b.service_id
     LEFT JOIN mechanics m ON m.id = b.mechanic_id
     WHERE b.id = ${p.add(bookingId)}`,
    p.list
  );
  return rows[0] ?? null;
}

/**
 * What "moveable" means, in ONE place.
 *
 * The fuel gauge and the picker MUST agree. When they were written separately
 * they silently diverged — the count said 73 while exactly one booking could
 * actually be chosen, so the low-backlog guard never fired and most ticks spent
 * a round trip finding nothing.
 *
 * Assumes the bookings table is aliased `b`.
 */
const ADVANCEABLE = `
  b.status IN ('pending', 'assigned', 'on_the_way', 'in_progress')
  -- Nobody drives to a job that has not come round yet. This applies ONLY to
  -- 'assigned': dispatch can assign days ahead, and a job already on the way or
  -- under way is happening now whatever its scheduled time says.
  AND (b.status <> 'assigned' OR b.scheduled_at <= NOW() + INTERVAL '1 hour')
  -- Keeps "one live job per mechanic": without it, sending an assigned booking
  -- on its way could put a mechanic on two jobs at the same moment.
  AND (
    b.status <> 'assigned'
    OR NOT EXISTS (
      SELECT 1 FROM bookings other
      WHERE other.mechanic_id = b.mechanic_id
        AND other.id <> b.id
        AND other.status IN ('on_the_way', 'in_progress')
    )
  )
`;

/**
 * Pick the next booking the simulator should move along.
 *
 * Today's jobs come first, because that is where a watching operations team is
 * looking.
 */
export async function selectSimulatorCandidate(
  client: PoolClient,
  timezone: string
): Promise<{ id: number; status: BookingStatus } | null> {
  const p = new QueryParams();
  const tz = p.add(timezone);

  const { rows } = await client.query<{ id: number; status: BookingStatus }>(
    `WITH day_window AS (
       SELECT date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz} AS day_start,
              (date_trunc('day', NOW() AT TIME ZONE ${tz}) + INTERVAL '1 day')
                AT TIME ZONE ${tz} AS day_end
     )
     SELECT b.id, b.status
     FROM bookings b CROSS JOIN day_window w
     WHERE ${ADVANCEABLE}
     ORDER BY (b.scheduled_at >= w.day_start AND b.scheduled_at < w.day_end) DESC, random()
     LIMIT 1`,
    p.list
  );
  return rows[0] ?? null;
}

/**
 * How much workable queue there is right now.
 *
 * The gauge and the picker must agree on the HORIZON, not just on the status
 * set. Counting every open booking looked safer but counted ~140 seeded jobs
 * scheduled days out that the picker will not touch, so the ceiling was already
 * reached at boot: the simulator could neither create (queue "full") nor
 * advance (nothing due), and the board sat empty. Same predicate, same answer.
 */
export async function countOpenBookings(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM bookings b WHERE ${ADVANCEABLE}`
  );
  return Number(rows[0]?.total ?? 0);
}

export interface NewBookingRow {
  id: number;
  reference: string;
}

/**
 * Create a brand new pending booking for a random existing customer.
 *
 * Real operations receive new work all day. Without this the simulator would
 * only ever push the seeded backlog towards "completed", and roughly seventeen
 * minutes after a seed the board would be permanently still.
 *
 * The id comes from `nextval` inside the statement and is used for BOTH the
 * primary key and the human reference, so the two can never disagree and two
 * concurrent inserts cannot generate the same reference.
 */
export async function insertNewBooking(
  client: PoolClient,
  timezone: string
): Promise<NewBookingRow | null> {
  const p = new QueryParams();
  const tz = p.add(timezone);

  const { rows } = await client.query<NewBookingRow>(
    `WITH new_id AS (
       SELECT nextval(pg_get_serial_sequence('bookings', 'id')) AS id
     ),
     picked AS (
       SELECT v.id AS vehicle_id, v.customer_id,
              (SELECT id FROM services WHERE is_active ORDER BY random() LIMIT 1) AS service_id
       FROM vehicles v
       ORDER BY random()
       LIMIT 1
     )
     INSERT INTO bookings (
       id, reference, customer_id, vehicle_id, service_id,
       status, payment_status, amount, scheduled_at, created_at, updated_at
     )
     SELECT
       n.id,
       'IM-' || to_char(NOW() AT TIME ZONE ${tz}, 'YYYY') || '-' || lpad(n.id::text, 6, '0'),
       p2.customer_id, p2.vehicle_id, p2.service_id,
       'pending', 'unpaid',
       -- The ::numeric cast is load-bearing: random() is double precision, so
       -- without it the whole expression becomes a float and PostgreSQL has no
       -- round(double precision, integer) to call.
       ROUND((s.base_price * (0.90 + random() * 0.55))::numeric, 2),
       -- Inside the hour the picker works to, so a new booking is workable
       -- almost immediately. Scheduling it four hours out meant three quarters
       -- of new work parked outside the window and the board starved.
       NOW() + make_interval(mins => (random() * 45)::int),
       NOW(), NOW()
     FROM new_id n
     CROSS JOIN picked p2
     JOIN services s ON s.id = p2.service_id
     RETURNING id, reference`,
    p.list
  );

  return rows[0] ?? null;
}
