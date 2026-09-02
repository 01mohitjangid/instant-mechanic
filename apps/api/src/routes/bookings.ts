import { Router } from 'express';
import { z } from 'zod';
import { BOOKING_STATUSES } from '@instant-mechanic/shared';
import { asyncHandler } from '../lib/async-handler.js';
import { parseIdParam, parseQuery } from '../middleware/validate.js';
import { BOOKING_SORT_KEYS } from '../db/queries/bookings.js';
import { getBookingById, listBookings } from '../services/booking-service.js';
import {
  csvEnum,
  dateSchema,
  paginationSchema,
  searchSchema,
  sortOrderSchema,
} from './query-schemas.js';

export const bookingsRouter: Router = Router();

const listQuerySchema = z
  .object({
    ...paginationSchema,
    search: searchSchema,
    status: csvEnum(BOOKING_STATUSES),
    serviceId: z.coerce.number().int().positive().optional(),
    mechanicId: z.coerce.number().int().positive().optional(),
    customerId: z.coerce.number().int().positive().optional(),
    category: z.string().trim().min(1).max(60).optional(),
    city: z.string().trim().min(1).max(60).optional(),
    from: dateSchema,
    to: dateSchema,
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
    sortBy: z.enum(BOOKING_SORT_KEYS).default('scheduledAt'),
    sortOrder: sortOrderSchema,
  })
  // Caught here rather than in SQL, so the client gets a clear 422 instead of
  // an empty page it has to work out the reason for.
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"from" must not be after "to"',
    path: ['from'],
  })
  .refine(
    (q) => q.minAmount === undefined || q.maxAmount === undefined || q.minAmount <= q.maxAmount,
    {
      message: '"minAmount" must not be greater than "maxAmount"',
      path: ['minAmount'],
    }
  );

/**
 * GET /api/bookings
 * Search, filter, sort and paginate the booking table.
 */
bookingsRouter.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, listQuerySchema);
    res.json(
      await listBookings({
        page: q.page,
        pageSize: q.pageSize,
        search: q.search,
        statuses: q.status,
        serviceId: q.serviceId,
        mechanicId: q.mechanicId,
        customerId: q.customerId,
        category: q.category,
        city: q.city,
        from: q.from,
        to: q.to,
        minAmount: q.minAmount,
        maxAmount: q.maxAmount,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
      })
    );
  })
);

/** GET /api/bookings/:id — one booking with its full status timeline. */
bookingsRouter.get(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const id = parseIdParam(req);
    res.json({ data: await getBookingById(id) });
  })
);
