-- ---------------------------------------------------------------------------
-- 001_init.sql — Instant Mechanic operations schema
--
-- Data model, in one line each:
--   services            catalogue of jobs the company sells
--   customers           people who book those jobs
--   vehicles            cars owned by customers (a customer may own several)
--   mechanics           field staff who perform the jobs
--   bookings            the central fact table: who / what car / what job / who fixed it
--   booking_status_history  every status transition, for the live timeline
--
-- Design notes:
--   * Money is NUMERIC(10,2) — never float, because float loses paise.
--   * Timestamps are TIMESTAMPTZ so the dashboard is timezone-correct.
--   * "Jobs completed" and "mechanic rating" are NOT stored on mechanics.
--     They are derived from bookings, so there is a single source of truth.
--   * Statuses are native ENUM types so bad values cannot be inserted at all.
-- ---------------------------------------------------------------------------

-- Trigram index support, used later for fast fuzzy search on names / plates.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

-- The live operations lifecycle from the assignment:
-- pending -> assigned -> on_the_way -> in_progress -> completed
-- (cancelled can happen from any state before completed)
CREATE TYPE booking_status AS ENUM (
  'pending',
  'assigned',
  'on_the_way',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE mechanic_status AS ENUM (
  'available',
  'on_job',
  'on_break',
  'off_duty'
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'paid',
  'refunded'
);

-- --------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest without the app having to remember
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- services
-- --------------------------------------------------------------------------

CREATE TABLE services (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  category         TEXT NOT NULL,
  description      TEXT,
  base_price       NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_category ON services (category);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- customers
-- --------------------------------------------------------------------------

CREATE TABLE customers (
  id         SERIAL PRIMARY KEY,
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      TEXT NOT NULL,
  city       TEXT NOT NULL,
  address    TEXT,
  -- created_at drives the "new customers" metric on the dashboard
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_created_at ON customers (created_at DESC);
CREATE INDEX idx_customers_city ON customers (city);
CREATE INDEX idx_customers_name_trgm ON customers USING GIN (full_name gin_trgm_ops);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- vehicles
-- --------------------------------------------------------------------------

CREATE TABLE vehicles (
  id                  SERIAL PRIMARY KEY,
  -- CASCADE only ever fires for a customer with no bookings at all, because
  -- bookings.customer_id is RESTRICT. That is the intended behaviour: deleting
  -- a customer who never booked should take their cars with them.
  customer_id         INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  make                TEXT NOT NULL,
  model               TEXT NOT NULL,
  year                INTEGER NOT NULL CHECK (year BETWEEN 1980 AND 2100),
  registration_number TEXT NOT NULL UNIQUE,
  fuel_type           TEXT NOT NULL CHECK (fuel_type IN ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lets bookings reference (vehicle_id, customer_id) as a pair, which is what
-- makes "this booking's car belongs to this booking's customer" impossible to
-- get wrong. Doubles as the customer_id lookup index.
CREATE UNIQUE INDEX uq_vehicles_id_customer ON vehicles (id, customer_id);
CREATE INDEX idx_vehicles_customer_id ON vehicles (customer_id);
CREATE INDEX idx_vehicles_reg_trgm ON vehicles USING GIN (registration_number gin_trgm_ops);

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- mechanics
-- --------------------------------------------------------------------------

CREATE TABLE mechanics (
  id             SERIAL PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT NOT NULL,
  specialization TEXT NOT NULL,
  status         mechanic_status NOT NULL DEFAULT 'available',
  city           TEXT NOT NULL,
  -- Coordinates exist so a "mechanic map" bonus feature stays possible later.
  latitude       NUMERIC(9, 6),
  longitude      NUMERIC(9, 6),
  hired_at       DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mechanics_status ON mechanics (status);
CREATE INDEX idx_mechanics_city ON mechanics (city);
CREATE INDEX idx_mechanics_name_trgm ON mechanics USING GIN (full_name gin_trgm_ops);

CREATE TRIGGER trg_mechanics_updated_at
  BEFORE UPDATE ON mechanics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- bookings  (the central fact table)
-- --------------------------------------------------------------------------

CREATE TABLE bookings (
  id                  SERIAL PRIMARY KEY,
  -- Human-facing id shown in the dashboard, e.g. IM-2026-000123
  reference           TEXT NOT NULL UNIQUE,

  customer_id         INTEGER NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  vehicle_id          INTEGER NOT NULL REFERENCES vehicles (id) ON DELETE RESTRICT,
  service_id          INTEGER NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  -- NULL while the job is still unassigned (status = 'pending').
  -- RESTRICT, not SET NULL: nulling would break chk_mechanic_required below,
  -- and a mechanic with history should be marked off_duty, never deleted.
  mechanic_id         INTEGER REFERENCES mechanics (id) ON DELETE RESTRICT,

  status              booking_status NOT NULL DEFAULT 'pending',
  payment_status      payment_status NOT NULL DEFAULT 'unpaid',
  amount              NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),

  scheduled_at        TIMESTAMPTZ NOT NULL,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Customer feedback; mechanic rating is averaged from this column.
  rating              SMALLINT CHECK (rating BETWEEN 1 AND 5),
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Integrity rules the database enforces, so bad rows cannot exist:
  -- One-directional on purpose. A completed job that is later cancelled and
  -- refunded is a normal ops event, and it must keep its completed_at rather
  -- than erase history to satisfy a constraint.
  CONSTRAINT chk_completed_has_timestamp CHECK (
    status <> 'completed' OR completed_at IS NOT NULL
  ),
  CONSTRAINT chk_cancelled_has_timestamp CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  ),
  -- A job that never finished cannot carry finishing timestamps.
  CONSTRAINT chk_unfinished_has_no_timestamps CHECK (
    status IN ('completed', 'cancelled')
    OR (completed_at IS NULL AND cancelled_at IS NULL)
  ),
  -- Any live or finished job must have a mechanic; only pending/cancelled may not.
  CONSTRAINT chk_mechanic_required CHECK (
    status IN ('pending', 'cancelled') OR mechanic_id IS NOT NULL
  ),
  -- Feedback belongs to work that was actually finished. Tying it to
  -- completed_at rather than to status means a later cancellation or refund
  -- does not silently wipe the customer's rating.
  CONSTRAINT chk_rating_needs_completed_work CHECK (
    rating IS NULL OR completed_at IS NOT NULL
  ),

  -- The booking's vehicle must belong to the booking's customer. Enforced by
  -- the database so no future API route can get this pairing wrong.
  CONSTRAINT fk_booking_vehicle_customer
    FOREIGN KEY (vehicle_id, customer_id) REFERENCES vehicles (id, customer_id)
    ON DELETE RESTRICT
);

-- Indexes chosen for the actual dashboard queries:
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_created_at ON bookings (created_at DESC);
-- Queries must use a half-open range (scheduled_at >= day AND < day + 1) to
-- use this index. Wrapping the column in scheduled_at::date defeats it.
CREATE INDEX idx_bookings_scheduled_at ON bookings (scheduled_at DESC);
CREATE INDEX idx_bookings_mechanic_id ON bookings (mechanic_id);
CREATE INDEX idx_bookings_customer_id ON bookings (customer_id);
CREATE INDEX idx_bookings_service_id ON bookings (service_id);
-- Composite: "show me pending jobs, newest first" is the most common ops filter.
CREATE INDEX idx_bookings_status_scheduled ON bookings (status, scheduled_at DESC);
-- Revenue-over-time only ever scans completed rows.
CREATE INDEX idx_bookings_completed_at ON bookings (completed_at DESC) WHERE status = 'completed';
CREATE INDEX idx_bookings_reference_trgm ON bookings USING GIN (reference gin_trgm_ops);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- booking_status_history  (append-only audit trail / live timeline)
-- --------------------------------------------------------------------------

CREATE TABLE booking_status_history (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  from_status booking_status,
  to_status   booking_status NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by  TEXT NOT NULL DEFAULT 'system',
  note        TEXT
);

CREATE INDEX idx_status_history_booking_id ON booking_status_history (booking_id, changed_at);
CREATE INDEX idx_status_history_changed_at ON booking_status_history (changed_at DESC);
