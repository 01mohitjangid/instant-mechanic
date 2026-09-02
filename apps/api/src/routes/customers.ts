import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { parseIdParam, parseQuery } from '../middleware/validate.js';
import { CUSTOMER_SORT_KEYS } from '../db/queries/customers.js';
import { getCustomerById, listCustomers } from '../services/customer-service.js';
import { paginationSchema, searchSchema, sortOrderSchema } from './query-schemas.js';

export const customersRouter: Router = Router();

const listQuerySchema = z.object({
  ...paginationSchema,
  search: searchSchema,
  city: z.string().trim().min(1).max(60).optional(),
  sortBy: z.enum(CUSTOMER_SORT_KEYS).default('lastBooking'),
  sortOrder: sortOrderSchema,
});

/** GET /api/customers — customers with booking counts and lifetime value. */
customersRouter.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, listQuerySchema);
    res.json(
      await listCustomers({
        page: q.page,
        pageSize: q.pageSize,
        search: q.search,
        city: q.city,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
      })
    );
  })
);

/** GET /api/customers/:id */
customersRouter.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await getCustomerById(parseIdParam(req)) });
  })
);
