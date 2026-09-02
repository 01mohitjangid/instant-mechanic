import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorResponse } from '@instant-mechanic/shared';
import { ApiError } from '../lib/errors.js';
import { isProduction } from '../config/env.js';

/**
 * Last route in the stack: anything that reached here matched nothing.
 * It must be registered AFTER every real route, or it swallows them.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
    },
  };
  res.status(404).json(body);
};

/**
 * The only place an error becomes a response.
 *
 * A deliberate `ApiError` keeps its own status and message. Anything else is an
 * unexpected bug: it is logged in full on the server and reduced to a bare 500
 * for the client, because a stack trace or a database message in a response
 * body tells an attacker how the system is built.
 *
 * Must be registered after the routes, and it must keep all four parameters —
 * Express identifies error middleware by arity alone.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  // express.json() rejects a malformed or oversized body with a plain Error
  // carrying an HTTP status. Without this it fell through to the bare 500 and
  // the client was told the server had broken, not their request.
  const status = (error as { status?: number; statusCode?: number } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const body: ApiErrorResponse = {
      error: {
        code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'MALFORMED_BODY',
        message:
          status === 413
            ? 'The request body is too large'
            : 'The request body could not be parsed as JSON',
      },
    };
    res.status(status).json(body);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api] unhandled error on ${req.method} ${req.originalUrl}:`, error);

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong on our side' : message,
    },
  };
  res.status(500).json(body);
};
