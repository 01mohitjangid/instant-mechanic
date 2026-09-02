import express, { type Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { corsOrigins, env, trustProxy } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

/**
 * The Express application, assembled but not listening.
 *
 * Kept separate from `server.ts` so the app can be imported and exercised
 * without opening a port.
 *
 * Middleware order is deliberate and load-bearing:
 *   security headers → CORS → compression → body parsing → logging
 *   → rate limit → routes → 404 → error handler
 * The 404 must come after every route or it swallows them, and the error
 * handler must be last or errors never reach it.
 */
export function createApp(): Express {
  const app = express();

  // Behind AWS's load balancer the real client IP arrives in X-Forwarded-For,
  // and without this the rate limiter would see one IP for the whole internet.
  // Off by default though: trusting that header with no proxy in front lets
  // anyone bypass the limiter by rotating it.
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      // PATCH is here for the one write route, /api/bookings/:id/status.
      methods: ['GET', 'PATCH', 'OPTIONS'],
      maxAge: 86400,
    })
  );
  app.use(compression());
  // Small on purpose: the only body this API accepts is a status change, and an
  // unbounded body on a public endpoint is a free denial-of-service.
  app.use(express.json({ limit: '16kb' }));
  app.use(requestLogger);

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // The dashboard polls, so the health check is exempt: an uptime monitor
      // must never be the thing that trips the limiter.
      skip: (req) => req.path === '/health',
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' },
      },
    })
  );

  app.use(healthRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
