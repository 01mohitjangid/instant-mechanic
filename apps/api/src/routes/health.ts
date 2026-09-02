import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { getHealth } from '../services/health-service.js';
import { apiIndex } from './index.js';

export const healthRouter: Router = Router();

/**
 * The bare root. Whoever opens the backend URL — a reviewer, a teammate, future
 * me — should see what this service is, not a 404.
 */
healthRouter.get('/', (_req, res) => {
  res.json({ data: apiIndex });
});

/**
 * Liveness plus a real database round trip.
 *
 * A health check that only proves the process is running is close to useless:
 * this one fails when the database is unreachable, which is the failure that
 * actually takes the dashboard down.
 */
healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getHealth() });
  })
);
