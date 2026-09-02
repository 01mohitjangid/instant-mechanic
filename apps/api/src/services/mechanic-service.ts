import {
  BOOKING_STATUS_LABELS,
  LIVE_STATUSES,
  type MechanicSummary,
  type PaginatedResponse,
} from '@instant-mechanic/shared';
import {
  countMechanics,
  selectMechanicById,
  selectMechanics,
  type MechanicFilters,
  type MechanicRow,
} from '../db/queries/mechanics.js';
import { buildPaginationMeta, toLimitOffset } from '../lib/pagination.js';
import { ApiError } from '../lib/errors.js';
import { count, isoRequired, money, ratio } from '../lib/sql.js';

function toSummary(row: MechanicRow): MechanicSummary {
  const status = row.current_booking_status;

  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    specialization: row.specialization,
    status: row.status,
    city: row.city,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    hiredAt: row.hired_at,
    jobsCompleted: count(row.jobs_completed),
    jobsCancelled: count(row.jobs_cancelled),
    activeJobs: count(row.active_jobs),
    revenueGenerated: money(row.revenue_generated),
    averageRating: ratio(row.average_rating, 1),
    currentBooking:
      row.current_booking_id !== null && status !== null && row.current_booking_scheduled_at
        ? {
            id: row.current_booking_id,
            reference: row.current_booking_reference ?? '',
            status,
            statusLabel: BOOKING_STATUS_LABELS[status],
            scheduledAt: isoRequired(row.current_booking_scheduled_at),
            customerName: row.current_booking_customer ?? '',
            serviceName: row.current_booking_service ?? '',
            // "Live" means the mechanic is physically on it right now, which is
            // narrower than "not finished" — an assigned job for tomorrow is not.
            isLive: (LIVE_STATUSES as readonly string[]).includes(status),
          }
        : null,
  };
}

export interface ListMechanicsInput extends Omit<MechanicFilters, 'limit' | 'offset'> {
  page: number;
  pageSize: number;
}

export async function listMechanics(
  input: ListMechanicsInput
): Promise<PaginatedResponse<MechanicSummary>> {
  const { page, pageSize, ...filters } = input;
  const { limit, offset } = toLimitOffset(page, pageSize);

  const rows = await selectMechanics({ ...filters, limit, offset });
  // See listBookings: an out-of-range page carries no COUNT(*) OVER() to read.
  const totalItems =
    rows.length > 0 ? count(rows[0]?.total_count) : page > 1 ? await countMechanics(filters) : 0;

  return { data: rows.map(toSummary), meta: buildPaginationMeta(page, pageSize, totalItems) };
}

export async function getMechanicById(id: number): Promise<MechanicSummary> {
  const row = await selectMechanicById(id);
  if (!row) throw ApiError.notFound('Mechanic', id);
  return toSummary(row);
}
