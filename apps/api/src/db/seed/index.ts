/**
 * Seed the Instant Mechanic database with realistic operations data.
 *
 *   npm run db:seed
 *
 * The script is destructive on purpose: it truncates the six domain tables and
 * rebuilds them from scratch, so the dataset is always in a known state. The
 * random generator is seeded, so the same rows come out every run.
 *
 * Volumes (all above the assignment's minimums):
 *   18 services · 60 customers · ~70 vehicles · 25 mechanics
 *   650 bookings · ~2,900 status-history rows
 */
import type { PoolClient, QueryResultRow } from 'pg';
// The status vocabulary lives in the shared package, so the API and the
// dashboard cannot drift apart on what a booking status is called.
import { BOOKING_LIFECYCLE as LIFECYCLE } from '@instant-mechanic/shared';
import type { BookingStatus } from '@instant-mechanic/shared';
import { env } from '../../config/env.js';
import { startOfDayInZone } from '../../lib/time.js';
import { closePool, withTransaction } from '../pool.js';
import {
  BOOKING_NOTES,
  CANCELLATION_REASONS,
  CITIES,
  FIRST_NAMES,
  LAST_NAMES,
  SERVICES,
  SPECIALIZATIONS,
  VEHICLE_MODELS,
} from './catalog.js';
import {
  DAY,
  HOUR,
  MINUTE,
  chance,
  money,
  pick,
  pickWeighted,
  randFloat,
  randInt,
  shift,
} from './random.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const CUSTOMER_COUNT = 60;
const MECHANIC_COUNT = 30;
const BOOKING_COUNT = 650;
/** How far back the booking history stretches. */
const PAST_HORIZON_DAYS = 90;
/** Jobs spread across today's working day. */
const TODAY_BOOKING_COUNT = 10;
/**
 * Jobs scheduled within a few hours of *now*, whenever "now" happens to be.
 * Without this, seeding at 22:00 leaves every one of today's 08:00-20:00 slots
 * more than six hours in the past, so they all resolve to completed or
 * cancelled and the live dashboard opens with nothing in flight.
 */
const LIVE_BOOKING_COUNT = 16;
/** Jobs booked for the coming week — this is the pending/assigned pipeline. */
const FUTURE_BOOKING_COUNT = 45;

const ACTOR_BY_STATUS: Record<BookingStatus, string> = {
  pending: 'customer-app',
  assigned: 'ops-team',
  on_the_way: 'mechanic-app',
  in_progress: 'mechanic-app',
  completed: 'mechanic-app',
  cancelled: 'ops-team',
};

// ---------------------------------------------------------------------------
// Bulk insert helper
// ---------------------------------------------------------------------------

/**
 * Insert many rows with ONE statement per chunk instead of one per row.
 * Values are always passed as parameters — never interpolated into the SQL.
 *
 * PostgreSQL allows at most 65,535 parameters per statement, so rows are
 * chunked to stay comfortably under that ceiling.
 */
async function insertMany<R extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
  returning?: readonly string[]
): Promise<R[]> {
  if (rows.length === 0) return [];

  const maxRowsPerStatement = Math.max(1, Math.floor(60000 / columns.length));
  const chunkSize = Math.min(500, maxRowsPerStatement);
  const inserted: R[] = [];

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((row, rowIndex) => {
      const placeholders = columns.map(
        (_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`
      );
      params.push(...row);
      return `(${placeholders.join(', ')})`;
    });

    const sql =
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}` +
      (returning ? ` RETURNING ${returning.join(', ')}` : '');

    const result = await client.query<R>(sql, params);
    if (returning) inserted.push(...result.rows);
  }

  return inserted;
}

/**
 * Look up a generated id by its natural key.
 *
 * Rows are matched by name / email / registration number rather than by the
 * order PostgreSQL happened to return them in. Positional matching works today
 * but is not a documented guarantee, and if it ever broke, every foreign key in
 * the dataset would be silently wrong with no error to show for it.
 */
function requireId(index: ReadonlyMap<string, number>, key: string, what: string): number {
  const id = index.get(key);
  if (id === undefined) {
    throw new Error(`Database returned no id for ${what} "${key}"`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function uniqueEmail(name: string, index: number, domain: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
  return `${slug}${index}@${domain}`;
}

function phoneNumber(): string {
  return `+91 ${randInt(7, 9)}${randInt(0, 9)}${randInt(10000000, 99999999)}`;
}

function personName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

/** Nudge a coordinate by up to ~5 km so map pins are not stacked on each other. */
function jitter(coordinate: number): string {
  return (coordinate + randFloat(-0.045, 0.045)).toFixed(6);
}

function registrationNumber(rtoCode: string, used: Set<string>): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const series = `${pick([...letters])}${pick([...letters])}`;
    const digits = String(randInt(1000, 9999));
    const plate = `${rtoCode}${series}${digits}`;
    if (!used.has(plate)) {
      used.add(plate);
      return plate;
    }
  }
  throw new Error(`Could not generate a unique registration number for ${rtoCode}`);
}

/** Keep a date inside [min, max]. Used so no event lands in the future. */
function clamp(date: Date, min: Date, max: Date): Date {
  if (date.getTime() < min.getTime()) return new Date(min.getTime());
  if (date.getTime() > max.getTime()) return new Date(max.getTime());
  return date;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const now = new Date();

  await withTransaction(async (client) => {
    console.log('▸ clearing existing data');
    await client.query(`
      TRUNCATE TABLE booking_status_history, bookings, vehicles, mechanics, customers, services
      RESTART IDENTITY CASCADE
    `);

    // ----------------------------------------------------------------- services
    const serviceRows = SERVICES.map((service) => [
      service.name,
      service.category,
      service.description,
      money(service.basePrice),
      service.durationMinutes,
      true,
    ]);
    const insertedServices = await insertMany<{ id: number; name: string }>(
      client,
      'services',
      ['name', 'category', 'description', 'base_price', 'duration_minutes', 'is_active'],
      serviceRows,
      ['id', 'name']
    );
    const serviceIdByName = new Map(insertedServices.map((row) => [row.name, row.id]));
    const services = SERVICES.map((service) => ({
      ...service,
      id: requireId(serviceIdByName, service.name, 'service'),
    }));
    console.log(`  services   ${services.length}`);

    // ---------------------------------------------------------------- customers
    const customerSeeds = Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
      const city = pick(CITIES);
      const fullName = personName();
      // Spread sign-ups over ~14 months so "new customers this month" is meaningful.
      // The first 15 are founding customers, deliberately older than the whole
      // booking history so the earliest bookings have someone to belong to.
      // The rest are biased towards recent months, so the "new customers"
      // metric is never zero and sign-ups slope upward like a growing business.
      const createdAt =
        index < 15
          ? shift(now, -randFloat(PAST_HORIZON_DAYS + 30, 420) * DAY)
          : shift(now, -(randFloat(0, 1) ** 1.4) * 420 * DAY);
      return {
        fullName,
        email: uniqueEmail(fullName, index + 1, 'example.com'),
        phone: phoneNumber(),
        city: city.name,
        address: `${randInt(1, 240)}, ${pick(['MG Road', 'Sector 21', 'Ring Road', 'Church Street', 'Link Road', 'Park Avenue'])}, ${city.name}`,
        createdAt,
      };
    });

    const insertedCustomers = await insertMany<{ id: number; email: string }>(
      client,
      'customers',
      ['full_name', 'email', 'phone', 'city', 'address', 'created_at', 'updated_at'],
      customerSeeds.map((customer) => [
        customer.fullName,
        customer.email,
        customer.phone,
        customer.city,
        customer.address,
        customer.createdAt,
        customer.createdAt,
      ]),
      ['id', 'email']
    );
    const customerIdByEmail = new Map(insertedCustomers.map((row) => [row.email, row.id]));
    const customers = customerSeeds.map((customer) => ({
      ...customer,
      id: requireId(customerIdByEmail, customer.email, 'customer'),
    }));
    console.log(`  customers  ${customers.length}`);

    // ----------------------------------------------------------------- vehicles
    const usedPlates = new Set<string>();
    const vehicleSeeds: {
      customerId: number;
      make: string;
      model: string;
      year: number;
      registrationNumber: string;
      fuelType: string;
      createdAt: Date;
    }[] = [];

    for (const customer of customers) {
      const city = CITIES.find((entry) => entry.name === customer.city) ?? pick(CITIES);
      const vehicleCount = pickWeighted([
        [1, 70],
        [2, 25],
        [3, 5],
      ]);
      for (let n = 0; n < vehicleCount; n += 1) {
        const model = pick(VEHICLE_MODELS);
        vehicleSeeds.push({
          customerId: customer.id,
          make: model.make,
          model: model.model,
          year: randInt(2014, 2025),
          registrationNumber: registrationNumber(city.rtoCode, usedPlates),
          fuelType: pick(model.fuelTypes),
          createdAt: customer.createdAt,
        });
      }
    }

    const insertedVehicles = await insertMany<{ id: number; registration_number: string }>(
      client,
      'vehicles',
      [
        'customer_id',
        'make',
        'model',
        'year',
        'registration_number',
        'fuel_type',
        'created_at',
        'updated_at',
      ],
      vehicleSeeds.map((vehicle) => [
        vehicle.customerId,
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.registrationNumber,
        vehicle.fuelType,
        vehicle.createdAt,
        vehicle.createdAt,
      ]),
      ['id', 'registration_number']
    );
    const vehicleIdByPlate = new Map(
      insertedVehicles.map((row) => [row.registration_number, row.id])
    );
    const vehicles = vehicleSeeds.map((vehicle) => ({
      ...vehicle,
      id: requireId(vehicleIdByPlate, vehicle.registrationNumber, 'vehicle'),
    }));
    console.log(`  vehicles   ${vehicles.length}`);

    // Fast lookup: which vehicles belong to which customer.
    const vehiclesByCustomer = new Map<number, typeof vehicles>();
    for (const vehicle of vehicles) {
      const list = vehiclesByCustomer.get(vehicle.customerId) ?? [];
      list.push(vehicle);
      vehiclesByCustomer.set(vehicle.customerId, list);
    }

    // ---------------------------------------------------------------- mechanics
    const mechanicSeeds = Array.from({ length: MECHANIC_COUNT }, (_, index) => {
      const city = pick(CITIES);
      const fullName = personName();
      return {
        fullName,
        email: uniqueEmail(fullName, index + 1, 'instantmechanic.in'),
        phone: phoneNumber(),
        specialization: pick(SPECIALIZATIONS),
        // Overwritten below for anyone actually on a live job.
        status: pickWeighted([
          ['available', 55],
          ['on_break', 15],
          ['off_duty', 30],
        ]),
        city: city.name,
        latitude: jitter(city.latitude),
        longitude: jitter(city.longitude),
        hiredAt: shift(now, -randFloat(60, 1500) * DAY),
      };
    });

    const insertedMechanics = await insertMany<{ id: number; email: string }>(
      client,
      'mechanics',
      [
        'full_name',
        'email',
        'phone',
        'specialization',
        'status',
        'city',
        'latitude',
        'longitude',
        'hired_at',
      ],
      mechanicSeeds.map((mechanic) => [
        mechanic.fullName,
        mechanic.email,
        mechanic.phone,
        mechanic.specialization,
        mechanic.status,
        mechanic.city,
        mechanic.latitude,
        mechanic.longitude,
        mechanic.hiredAt,
      ]),
      ['id', 'email']
    );
    const mechanicIdByEmail = new Map(insertedMechanics.map((row) => [row.email, row.id]));
    const mechanics = mechanicSeeds.map((mechanic) => ({
      ...mechanic,
      id: requireId(mechanicIdByEmail, mechanic.email, 'mechanic'),
    }));
    console.log(`  mechanics  ${mechanics.length}`);

    const mechanicsByCity = new Map<string, typeof mechanics>();
    for (const mechanic of mechanics) {
      const list = mechanicsByCity.get(mechanic.city) ?? [];
      list.push(mechanic);
      mechanicsByCity.set(mechanic.city, list);
    }

    /** Mechanics already on a job that is running right now. */
    const busyRightNow = new Set<number>();

    /**
     * Prefer a mechanic in the customer's city; fall back to anyone.
     * `exclusive` is for jobs that are live at this very moment, so the same
     * person never appears on two active jobs on the mechanics page.
     */
    function assignMechanic(city: string, exclusive = false): number {
      const local = mechanicsByCity.get(city);
      const draw = (): number =>
        local && local.length > 0 && chance(0.75) ? pick(local).id : pick(mechanics).id;

      if (!exclusive) return draw();

      for (let attempt = 0; attempt < 25; attempt += 1) {
        const candidate = draw();
        if (!busyRightNow.has(candidate)) {
          busyRightNow.add(candidate);
          return candidate;
        }
      }

      const free = mechanics.find((mechanic) => !busyRightNow.has(mechanic.id));
      if (!free) {
        throw new Error(
          `All ${mechanics.length} mechanics are already on a live job — ` +
            'raise MECHANIC_COUNT or lower the number of concurrent live bookings'
        );
      }
      busyRightNow.add(free.id);
      return free.id;
    }

    // ----------------------------------------------------------------- bookings
    interface BookingRow {
      reference: string;
      customerId: number;
      vehicleId: number;
      serviceId: number;
      mechanicId: number | null;
      status: BookingStatus;
      paymentStatus: 'unpaid' | 'paid' | 'refunded';
      amount: string;
      scheduledAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      cancellationReason: string | null;
      rating: number | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    }

    const bookingRows: BookingRow[] = [];

    /**
     * Build every appointment time up front, then sort them.
     * Sorting means booking reference numbers run oldest to newest, exactly the
     * way a real sequence would.
     */
    const scheduleSlots: Date[] = [];

    const pastBookingCount =
      BOOKING_COUNT - TODAY_BOOKING_COUNT - LIVE_BOOKING_COUNT - FUTURE_BOOKING_COUNT;
    for (let n = 0; n < pastBookingCount; n += 1) {
      // Raising the roll to a power biases towards recent days, so the
      // bookings-over-time chart slopes upward instead of looking flat.
      const roll = randFloat(0, 1) ** 1.35;
      scheduleSlots.push(shift(now, -(roll * PAST_HORIZON_DAYS * DAY + 5 * HOUR)));
    }

    // "Today" means today for the operations team, not for whatever timezone
    // this script happens to run in.
    const startOfToday = startOfDayInZone(now, env.APP_TIMEZONE);
    for (let n = 0; n < TODAY_BOOKING_COUNT; n += 1) {
      // Today's jobs run across an 08:00-20:00 working day.
      scheduleSlots.push(shift(startOfToday, randFloat(8 * HOUR, 20 * HOUR)));
    }

    // The live band: half just finished or still running, half about to start.
    for (let n = 0; n < LIVE_BOOKING_COUNT; n += 1) {
      scheduleSlots.push(shift(now, randFloat(-2.5 * HOUR, 2.5 * HOUR)));
    }

    for (let n = 0; n < FUTURE_BOOKING_COUNT; n += 1) {
      scheduleSlots.push(shift(now, randFloat(12 * HOUR, 7 * DAY)));
    }

    scheduleSlots.sort((a, b) => a.getTime() - b.getTime());

    // Walked forward alongside the sorted slots: at any slot, only customers who
    // had already signed up are eligible. Without this, a booking can be dated
    // months before its customer existed, and the customer detail page shows
    // service history for a car that was registered last week.
    const customersBySignup = [...customers].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    let eligibleCustomerCount = 0;

    for (let index = 0; index < BOOKING_COUNT; index += 1) {
      const scheduledAt = scheduleSlots[index] as Date;
      const hoursFromNow = (scheduledAt.getTime() - now.getTime()) / HOUR;

      // Status must make sense for when the job is scheduled.
      let status: BookingStatus;
      if (hoursFromNow < -6) {
        status = pickWeighted<BookingStatus>([
          ['completed', 88],
          ['cancelled', 12],
        ]);
      } else if (hoursFromNow < 0) {
        status = pickWeighted<BookingStatus>([
          ['completed', 36],
          ['in_progress', 34],
          ['on_the_way', 6],
          ['assigned', 8],
          ['cancelled', 12],
        ]);
      } else if (hoursFromNow < 6) {
        status = pickWeighted<BookingStatus>([
          ['assigned', 32],
          ['on_the_way', 33],
          ['pending', 30],
          ['cancelled', 5],
        ]);
      } else {
        status = pickWeighted<BookingStatus>([
          ['pending', 55],
          ['assigned', 35],
          ['cancelled', 10],
        ]);
      }

      while (eligibleCustomerCount < customersBySignup.length) {
        const next = customersBySignup[eligibleCustomerCount];
        if (!next || next.createdAt.getTime() > scheduledAt.getTime()) break;
        eligibleCustomerCount += 1;
      }

      if (eligibleCustomerCount === 0) {
        throw new Error(
          `No customer had signed up before slot ${scheduledAt.toISOString()} — ` +
            'increase the number of founding customers'
        );
      }
      const customer = customersBySignup[randInt(0, eligibleCustomerCount - 1)];
      if (!customer) {
        throw new Error('Customer lookup returned nothing for an eligible index');
      }

      // The composite foreign key requires the car to belong to this customer.
      const customerVehicles = vehiclesByCustomer.get(customer.id) ?? [];
      if (customerVehicles.length === 0) {
        throw new Error(`Customer ${customer.id} has no vehicle to book against`);
      }
      const vehicle = pick(customerVehicles);
      const service = pick(services);

      // Booked between 2 hours and 6 days before the slot, never in the future,
      // and never before the customer signed up or their car was registered.
      let createdAt = shift(scheduledAt, -randFloat(2 * HOUR, 6 * DAY));
      if (createdAt.getTime() > now.getTime()) {
        createdAt = shift(now, -randFloat(1 * HOUR, 24 * HOUR));
      }
      createdAt = clamp(createdAt, customer.createdAt, scheduledAt);

      let startedAt: Date | null = null;
      let completedAt: Date | null = null;
      let cancelledAt: Date | null = null;
      let cancellationReason: string | null = null;

      if (status === 'in_progress' || status === 'completed') {
        startedAt = clamp(shift(scheduledAt, randFloat(-10 * MINUTE, 45 * MINUTE)), createdAt, now);
      }

      if (status === 'completed' && startedAt) {
        const minimumWorked = 10 * MINUTE;
        const worked = service.durationMinutes * randFloat(0.7, 1.5) * MINUTE;

        // A slot only minutes old leaves no room for the work to have happened.
        // Pull the start time back so at least the minimum fits before now.
        const latestStart = shift(now, -minimumWorked);
        if (startedAt.getTime() > latestStart.getTime()) {
          startedAt = clamp(latestStart, createdAt, now);
        }

        completedAt = clamp(shift(startedAt, worked), shift(startedAt, minimumWorked), now);

        // Last resort: if the day genuinely has no room, the job is still
        // running rather than finished. Better a live job than a booking that
        // finished before it started.
        if (completedAt.getTime() <= startedAt.getTime()) {
          status = 'in_progress';
          completedAt = null;
        }
      }

      if (status === 'cancelled') {
        const latest = scheduledAt.getTime() < now.getTime() ? scheduledAt : now;
        cancelledAt = clamp(
          shift(createdAt, randFloat(30 * MINUTE, 3 * DAY)),
          shift(createdAt, 15 * MINUTE),
          latest
        );
        cancellationReason = pick(CANCELLATION_REASONS);
      }

      // Only pending and cancelled jobs are allowed to have no mechanic.
      let mechanicId: number | null;
      if (status === 'pending') {
        mechanicId = null;
      } else if (status === 'cancelled') {
        mechanicId = chance(0.55) ? assignMechanic(customer.city) : null;
      } else {
        mechanicId = assignMechanic(
          customer.city,
          status === 'on_the_way' || status === 'in_progress'
        );
      }

      const paymentStatus =
        status === 'completed'
          ? pickWeighted<'paid' | 'unpaid'>([
              ['paid', 94],
              ['unpaid', 6],
            ])
          : status === 'cancelled'
            ? pickWeighted<'refunded' | 'unpaid'>([
                ['refunded', 35],
                ['unpaid', 65],
              ])
            : 'unpaid';

      const rating =
        status === 'completed' && chance(0.72)
          ? pickWeighted([
              [5, 45],
              [4, 32],
              [3, 15],
              [2, 5],
              [1, 3],
            ])
          : null;

      const updatedAt = completedAt ?? cancelledAt ?? startedAt ?? createdAt;

      bookingRows.push({
        reference: `IM-${scheduledAt.getFullYear()}-${String(index + 1).padStart(6, '0')}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        serviceId: service.id,
        mechanicId,
        status,
        paymentStatus,
        // Final bill varies from the list price: parts, labour and discounts.
        amount: money(service.basePrice * randFloat(0.9, 1.45)),
        scheduledAt,
        startedAt,
        completedAt,
        cancelledAt,
        cancellationReason,
        rating,
        notes: chance(0.35) ? pick(BOOKING_NOTES) : null,
        createdAt,
        updatedAt,
      });
    }

    const insertedBookings = await insertMany<{ id: number; reference: string }>(
      client,
      'bookings',
      [
        'reference',
        'customer_id',
        'vehicle_id',
        'service_id',
        'mechanic_id',
        'status',
        'payment_status',
        'amount',
        'scheduled_at',
        'started_at',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'rating',
        'notes',
        'created_at',
        'updated_at',
      ],
      bookingRows.map((booking) => [
        booking.reference,
        booking.customerId,
        booking.vehicleId,
        booking.serviceId,
        booking.mechanicId,
        booking.status,
        booking.paymentStatus,
        booking.amount,
        booking.scheduledAt,
        booking.startedAt,
        booking.completedAt,
        booking.cancelledAt,
        booking.cancellationReason,
        booking.rating,
        booking.notes,
        booking.createdAt,
        booking.updatedAt,
      ]),
      ['id', 'reference']
    );
    const bookingIdByReference = new Map(insertedBookings.map((row) => [row.reference, row.id]));
    console.log(`  bookings   ${insertedBookings.length}`);

    // -------------------------------------------------------- status history
    const historyRows: (readonly unknown[])[] = [];

    bookingRows.forEach((booking) => {
      const bookingId = requireId(bookingIdByReference, booking.reference, 'booking');

      // Rebuild the path the booking actually walked.
      let chain: BookingStatus[];
      if (booking.status === 'cancelled') {
        // Cancelled jobs die somewhere along the happy path.
        const depth = pickWeighted([
          [1, 55],
          [2, 30],
          [3, 15],
        ]);
        chain = [...LIFECYCLE.slice(0, depth), 'cancelled'];
      } else {
        const endIndex = LIFECYCLE.indexOf(booking.status);
        chain = [...LIFECYCLE.slice(0, endIndex + 1)];
      }

      const endsAt =
        booking.completedAt ?? booking.cancelledAt ?? booking.startedAt ?? booking.createdAt;
      const span = Math.max(endsAt.getTime() - booking.createdAt.getTime(), 5 * MINUTE);

      chain.forEach((toStatus, step) => {
        const previous = step === 0 ? null : (chain[step - 1] as BookingStatus);
        const changedAt =
          chain.length === 1
            ? booking.createdAt
            : new Date(booking.createdAt.getTime() + (span * step) / (chain.length - 1));

        historyRows.push([
          bookingId,
          previous,
          toStatus,
          changedAt,
          ACTOR_BY_STATUS[toStatus],
          toStatus === 'cancelled' ? booking.cancellationReason : null,
        ]);
      });
    });

    await insertMany(
      client,
      'booking_status_history',
      ['booking_id', 'from_status', 'to_status', 'changed_at', 'changed_by', 'note'],
      historyRows
    );
    console.log(`  history    ${historyRows.length}`);

    // ------------------------------------------------- keep mechanics honest
    // A mechanic is "on_job" only while a job is actually running today.
    // Being assigned to next Tuesday's booking does not make someone busy now,
    // so that case is deliberately excluded.
    // The day window is computed in APP_TIMEZONE and left as a half-open range:
    // scheduled_at::date = CURRENT_DATE would resolve "today" in the database
    // session's zone (UTC on Neon) and would ignore idx_bookings_scheduled_at.
    const busy = await client.query(
      `
      WITH day_window AS (
        SELECT date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1 AS day_start,
               (date_trunc('day', NOW() AT TIME ZONE $1) + INTERVAL '1 day')
                 AT TIME ZONE $1 AS day_end
      )
      UPDATE mechanics
      SET status = 'on_job'
      WHERE id IN (
        SELECT DISTINCT b.mechanic_id
        FROM bookings b, day_window w
        WHERE b.mechanic_id IS NOT NULL
          AND b.status IN ('on_the_way', 'in_progress')
          AND b.scheduled_at >= w.day_start
          AND b.scheduled_at <  w.day_end
      )
      `,
      [env.APP_TIMEZONE]
    );
    console.log(`  mechanics marked on_job: ${busy.rowCount}`);
  });

  // A seeded dataset is only useful if the numbers are plausible — print them.
  console.log('\n▸ seeding complete');
}

seed()
  .then(() => {
    console.log('Run `npm run db:verify` to check the data.');
  })
  .catch((error: unknown) => {
    console.error('\nSeeding failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool().catch(() => undefined);
  });
