import {
  BOOKING_STATUS_LABELS,
  type BookingDetail,
  type BookingListItem,
  type BookingStatusEvent,
  type PaginatedResponse,
  type PaymentStatus,
} from '@instant-mechanic/shared';
import {
  countBookings,
  selectBookingById,
  selectBookingHistory,
  selectBookings,
  type BookingDetailRow,
  type BookingFilters,
  type BookingRow,
} from '../db/queries/bookings.js';
import { buildPaginationMeta, toLimitOffset } from '../lib/pagination.js';
import { ApiError } from '../lib/errors.js';
import { count, iso, isoRequired, money } from '../lib/sql.js';

/** "2021 Hyundai Creta" — one readable label for the table's Vehicle column. */
function vehicleLabel(row: { year: number; make: string; model: string }): string {
  return `${row.year} ${row.make} ${row.model}`;
}

function toListItem(row: BookingRow | Omit<BookingDetailRow, never>): BookingListItem {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    statusLabel: BOOKING_STATUS_LABELS[row.status],
    paymentStatus: row.payment_status as PaymentStatus,
    amount: money(row.amount),
    scheduledAt: isoRequired(row.scheduled_at),
    createdAt: isoRequired(row.created_at),
    completedAt: iso(row.completed_at),
    rating: row.rating,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      phone: row.customer_phone,
      city: row.customer_city,
    },
    vehicle: {
      id: row.vehicle_id,
      label: vehicleLabel(row),
      registrationNumber: row.registration_number,
    },
    service: { id: row.service_id, name: row.service_name, category: row.service_category },
    mechanic:
      row.mechanic_id !== null && row.mechanic_name !== null
        ? { id: row.mechanic_id, name: row.mechanic_name }
        : null,
  };
}

export interface ListBookingsInput extends Omit<BookingFilters, 'limit' | 'offset'> {
  page: number;
  pageSize: number;
}

export async function listBookings(
  input: ListBookingsInput
): Promise<PaginatedResponse<BookingListItem>> {
  const { page, pageSize, ...filters } = input;
  const { limit, offset } = toLimitOffset(page, pageSize);

  const rows = await selectBookings({ ...filters, limit, offset });

  // COUNT(*) OVER() rides along on every row, so the total is free while there
  // ARE rows. An out-of-range page has none to carry it — asking for page 100
  // of a 6-page result would otherwise report "0 matches" and collapse the
  // pager while 519 rows actually matched. Only then is a count query worth it.
  const totalItems =
    rows.length > 0 ? count(rows[0]?.total_count) : page > 1 ? await countBookings(filters) : 0;

  return {
    data: rows.map(toListItem),
    meta: buildPaginationMeta(page, pageSize, totalItems),
  };
}

export async function getBookingById(id: number): Promise<BookingDetail> {
  const row = await selectBookingById(id);
  if (!row) throw ApiError.notFound('Booking', id);

  const history = await selectBookingHistory(id);
  const base = toListItem(row);

  const events: BookingStatusEvent[] = history.map((event) => ({
    id: event.id,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    changedAt: isoRequired(event.changed_at),
    changedBy: event.changed_by,
    note: event.note,
  }));

  return {
    ...base,
    startedAt: iso(row.started_at),
    cancelledAt: iso(row.cancelled_at),
    cancellationReason: row.cancellation_reason,
    notes: row.notes,
    updatedAt: isoRequired(row.updated_at),
    customerEmail: row.customer_email,
    vehicle: {
      ...base.vehicle,
      make: row.make,
      model: row.model,
      year: row.year,
      fuelType: row.fuel_type,
    },
    service: {
      ...base.service,
      durationMinutes: row.duration_minutes,
      basePrice: money(row.base_price),
    },
    mechanic:
      base.mechanic && row.mechanic_phone !== null && row.mechanic_specialization !== null
        ? {
            ...base.mechanic,
            phone: row.mechanic_phone,
            specialization: row.mechanic_specialization,
          }
        : null,
    history: events,
  };
}
