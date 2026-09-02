import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { getFilterOptions, listServices } from '../services/catalog-service.js';

export const catalogRouter: Router = Router();

/** GET /api/services — the service catalogue with how often each is booked. */
catalogRouter.get(
  '/services',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listServices() });
  })
);

/**
 * GET /api/filters
 * Everything the dashboard's filter bar needs, so it does not have to make
 * four separate calls just to render a set of dropdowns.
 */
catalogRouter.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getFilterOptions() });
  })
);
