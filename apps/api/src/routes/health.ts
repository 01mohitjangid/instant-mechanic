import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { getHealth } from '../services/health-service.js';

export const healthRouter: Router = Router();

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
