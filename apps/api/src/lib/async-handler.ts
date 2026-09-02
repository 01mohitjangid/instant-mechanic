import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forward a rejected promise from an async handler to the error middleware.
 *
 * Express 5 already does this, but wrapping is kept deliberately: it states the
 * intent at every route, and it means the handlers keep working unchanged if
 * this app is ever mounted under Express 4, where an unwrapped rejection hangs
 * the request forever instead of returning a 500.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
