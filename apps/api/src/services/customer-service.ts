import type { CustomerSummary, PaginatedResponse } from '@instant-mechanic/shared';
import {
  countCustomers,
  selectCustomerById,
  selectCustomers,
  type CustomerFilters,
  type CustomerRow,
} from '../db/queries/customers.js';
import { buildPaginationMeta, toLimitOffset } from '../lib/pagination.js';
import { ApiError } from '../lib/errors.js';
import { count, iso, isoRequired, money } from '../lib/sql.js';

function toSummary(row: CustomerRow): CustomerSummary {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    createdAt: isoRequired(row.created_at),
    vehicleCount: count(row.vehicle_count),
    totalBookings: count(row.total_bookings),
    completedBookings: count(row.completed_bookings),
    cancelledBookings: count(row.cancelled_bookings),
    lifetimeValue: money(row.lifetime_value),
    lastBookingAt: iso(row.last_booking_at),
  };
}

export interface ListCustomersInput extends Omit<CustomerFilters, 'limit' | 'offset'> {
  page: number;
  pageSize: number;
}

export async function listCustomers(
  input: ListCustomersInput
): Promise<PaginatedResponse<CustomerSummary>> {
  const { page, pageSize, ...filters } = input;
  const { limit, offset } = toLimitOffset(page, pageSize);

  const rows = await selectCustomers({ ...filters, limit, offset });
  // See listBookings: an out-of-range page carries no COUNT(*) OVER() to read.
  const totalItems =
    rows.length > 0 ? count(rows[0]?.total_count) : page > 1 ? await countCustomers(filters) : 0;

  return { data: rows.map(toSummary), meta: buildPaginationMeta(page, pageSize, totalItems) };
}

export async function getCustomerById(id: number): Promise<CustomerSummary> {
  const row = await selectCustomerById(id);
  if (!row) throw ApiError.notFound('Customer', id);
  return toSummary(row);
}
