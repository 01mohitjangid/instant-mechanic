import { env } from '../config/env.js';

/**
 * A day window in the operations team's timezone, as a reusable SQL fragment.
 *
 * Two things it gets right that `col::date = CURRENT_DATE` gets wrong: the day
 * boundaries land on IST midnight rather than the database session's UTC
 * midnight, and the column stays unwrapped so its index can still be used.
 *
 * `$n` placeholders are numbered by the caller, because a query builds its
 * parameter list in order.
 */
export function dayWindowCte(timezoneParam: string): string {
  return `
    day_window AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE ${timezoneParam})
               AT TIME ZONE ${timezoneParam} AS day_start,
             (date_trunc('day', NOW() AT TIME ZONE ${timezoneParam}) + INTERVAL '1 day')
               AT TIME ZONE ${timezoneParam} AS day_end
    )`;
}

/** The timezone every date calculation in this API is anchored to. */
export const APP_TIMEZONE = env.APP_TIMEZONE;

/**
 * Wrap a search term for ILIKE, escaping the wildcards first.
 *
 * Without this, searching for "%" matches every row and a registration number
 * containing "_" cannot be searched literally. The value is still bound as a
 * parameter — this is about correctness, not injection.
 */
export function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * PostgreSQL NUMERIC arrives from node-postgres as a string, which is exactly
 * what we want to keep — but it can also be null from an outer join or an empty
 * aggregate. Normalise to a decimal string with two places.
 */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

/** COUNT(*) comes back as a string too, because BIGINT does not fit a JS number. */
export function count(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A NUMERIC average, rounded for display, or null when there is nothing to average. */
export function ratio(value: string | number | null | undefined, decimals = 2): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

/** A TIMESTAMPTZ column, as an ISO string the browser can parse. */
export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Same, for a column the schema guarantees is NOT NULL. */
export function isoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
