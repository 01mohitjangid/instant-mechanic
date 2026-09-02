import { Router } from 'express';
import { bookingsRouter } from './bookings.js';
import { catalogRouter } from './catalog.js';
import { customersRouter } from './customers.js';
import { dashboardRouter } from './dashboard.js';
import { mechanicsRouter } from './mechanics.js';

/**
 * Everything under /api.
 *
 * Order matters only where paths could shadow each other; these are all
 * distinct prefixes, and `/bookings/:id` is registered after `/bookings` inside
 * its own router.
 */
export const apiRouter: Router = Router();

apiRouter.use(dashboardRouter);
apiRouter.use(bookingsRouter);
apiRouter.use(mechanicsRouter);
apiRouter.use(customersRouter);
apiRouter.use(catalogRouter);

/**
 * A short index, so opening the API in a browser tells you what exists.
 *
 * Exported because it is served at BOTH `/` and `/api`. The bare backend URL is
 * what gets pasted into a submission form or a README, and answering it with a
 * 404 makes a working service look broken.
 */
export const apiIndex = {
  name: 'Instant Mechanic Operations API',
  version: '1.0.0',
  documentation: 'https://github.com/01mohitjangid/instant-mechanic#api',
  endpoints: [
    'GET  /health',
    'GET  /api/dashboard',
    'GET  /api/dashboard/analytics?days=30',
    'GET  /api/bookings?search=&status=&page=&pageSize=&sortBy=&sortOrder=',
    'GET  /api/bookings/:id',
    'PATCH /api/bookings/:id/status',
    'GET  /api/mechanics',
    'GET  /api/mechanics/:id',
    'GET  /api/customers',
    'GET  /api/customers/:id',
    'GET  /api/services',
    'GET  /api/filters',
  ],
} as const;

apiRouter.get('/', (_req, res) => {
  res.json({ data: apiIndex });
});
