import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../lib/pagination.js';

/** Page and page size, capped so a client cannot ask for the whole table. */
export const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** A free-text search box: trimmed, and treated as absent when empty. */
export const searchSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * `YYYY-MM-DD`, checked for shape AND for being a real calendar date.
 *
 * The round-trip is the point. `Date.parse('2026-02-31')` succeeds — V8 rolls
 * the impossible day over to 3 March — so a parse check lets a nonsense date
 * through to PostgreSQL, which answers with a 500 instead of a 422. Formatting
 * the parsed date back and comparing catches the rollover.
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date')
  .optional();

/**
 * A repeated filter passed as one comma-separated value, e.g.
 * `?status=pending,assigned`.
 *
 * Every part is checked against the allow-list, so an unknown status is a 422
 * naming the bad value rather than a query that silently matches nothing.
 */
export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .optional()
    .transform((raw, ctx): T[number][] | undefined => {
      if (!raw) return undefined;

      const parts = raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length === 0) return undefined;

      const unknown = parts.filter((part) => !values.includes(part));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown value(s): ${unknown.join(', ')}. Allowed: ${values.join(', ')}`,
        });
        return z.NEVER;
      }

      return parts as T[number][];
    });
}
