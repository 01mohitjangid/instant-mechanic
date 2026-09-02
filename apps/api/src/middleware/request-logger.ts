import type { RequestHandler } from 'express';

/**
 * One line per request, with the status and how long it took.
 * Small on purpose: enough to debug a slow endpoint, not a logging framework.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
};
