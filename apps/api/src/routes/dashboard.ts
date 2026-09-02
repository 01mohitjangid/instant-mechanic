import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { parseQuery } from '../middleware/validate.js';
import { getAnalytics, getOverview } from '../services/dashboard-service.js';

export const dashboardRouter: Router = Router();

const analyticsQuerySchema = z.object({
  // 7 to 365 days. Capped, because generate_series over an unbounded range is
  // a cheap way for a client to make the database do a lot of work.
  days: z.coerce.number().int().min(7).max(365).default(30),
});

/** GET /api/dashboard — every headline tile in one call. */
dashboardRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getOverview() });
  })
);

/** GET /api/dashboard/analytics?days=30 — all four charts in one call. */
dashboardRouter.get(
  '/dashboard/analytics',
  asyncHandler(async (req, res) => {
    const { days } = parseQuery(req, analyticsQuerySchema);
    res.json({ data: await getAnalytics(days) });
  })
);
