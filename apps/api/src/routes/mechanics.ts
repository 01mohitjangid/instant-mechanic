import { Router } from 'express';
import { z } from 'zod';
import { MECHANIC_STATUSES } from '@instant-mechanic/shared';
import { asyncHandler } from '../lib/async-handler.js';
import { parseIdParam, parseQuery } from '../middleware/validate.js';
import { MECHANIC_SORT_KEYS } from '../db/queries/mechanics.js';
import { getMechanicById, listMechanics } from '../services/mechanic-service.js';
import { csvEnum, paginationSchema, searchSchema, sortOrderSchema } from './query-schemas.js';

export const mechanicsRouter: Router = Router();

const listQuerySchema = z.object({
  ...paginationSchema,
  search: searchSchema,
  status: csvEnum(MECHANIC_STATUSES),
  city: z.string().trim().min(1).max(60).optional(),
  sortBy: z.enum(MECHANIC_SORT_KEYS).default('jobsCompleted'),
  sortOrder: sortOrderSchema,
});

/** GET /api/mechanics — roster with workload and the job each one is on. */
mechanicsRouter.get(
  '/mechanics',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, listQuerySchema);
    res.json(
      await listMechanics({
        page: q.page,
        pageSize: q.pageSize,
        search: q.search,
        statuses: q.status,
        city: q.city,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
      })
    );
  })
);

/** GET /api/mechanics/:id */
mechanicsRouter.get(
  '/mechanics/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await getMechanicById(parseIdParam(req)) });
  })
);
