import type { Request } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../lib/errors.js';

/**
 * Parse and validate a request's query string at the edge.
 *
 * Nothing downstream ever touches `req.query` directly, so an unexpected value
 * fails as a clear 422 naming the bad field instead of reaching SQL as
 * `undefined` and surfacing as a confusing 500.
 */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const result = schema.safeParse(req.query);
  if (result.success) return result.data;

  throw ApiError.validation(
    result.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'query',
      message: issue.message,
    }))
  );
}

/** Same, for a numeric `:id` path parameter. */
export function parseIdParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id < 1) {
    throw ApiError.badRequest(`"${name}" must be a positive whole number`);
  }
  return id;
}
