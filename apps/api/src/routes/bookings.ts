import { Router } from 'express';
import { z } from 'zod';
import { BOOKING_STATUSES } from '@instant-mechanic/shared';
import { asyncHandler } from '../lib/async-handler.js';
import { parseIdParam, parseQuery } from '../middleware/validate.js';
import { ApiError } from '../lib/errors.js';
import { BOOKING_SORT_KEYS } from '../db/queries/bookings.js';
import { getBookingById, listBookings } from '../services/booking-service.js';
import { changeBookingStatus } from '../services/booking-status-service.js';
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

const statusBodySchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  reason: z.string().trim().min(1).max(200).optional(),
});

/**
 * PATCH /api/bookings/:id/status
 *
 * The one write endpoint. It moves a booking one legal step along the
 * lifecycle, records the transition in booking_status_history, keeps the
 * mechanic's availability in step, and pushes the change to every connected
 * dashboard over the WebSocket.
 *
 * PATCH rather than POST because it modifies part of an existing booking rather
 * than creating anything. An illegal move (say, completed -> pending) is a 409,
 * not a 400: the request is well formed, the state just does not allow it.
 *
 * NOTE: this route is unauthenticated, because authentication is a bonus item
 * that is not built. In a real deployment it would sit behind an operations
 * role.
 */
bookingsRouter.patch(
  '/bookings/:id/status',
  asyncHandler(async (req, res) => {
    const id = parseIdParam(req);
    const parsed = statusBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.validation(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.') || 'body',
          message: issue.message,
        })),
        'request body fields'
      );
    }

    const event = await changeBookingStatus({
      bookingId: id,
      toStatus: parsed.data.status,
      changedBy: 'ops-dashboard',
      reason: parsed.data.reason,
    });

    res.json({ data: event });
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
