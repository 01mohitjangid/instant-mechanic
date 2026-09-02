import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  type FilterOptions,
  type ServiceSummary,
} from '@instant-mechanic/shared';
import { selectFilterOptions, selectServices } from '../db/queries/services.js';
import { count, money } from '../lib/sql.js';

export async function listServices(): Promise<ServiceSummary[]> {
  const rows = await selectServices();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    basePrice: money(row.base_price),
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    totalBookings: count(row.total_bookings),
  }));
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const options = await selectFilterOptions();
  return {
    // Statuses come from the shared constant, not the database, so the filter
    // bar lists a status even when no booking currently has it.
    statuses: BOOKING_STATUSES.map((status) => ({
      value: status,
      label: BOOKING_STATUS_LABELS[status],
    })),
    services: options.services,
    categories: options.categories,
    mechanics: options.mechanics,
    cities: options.cities,
  };
}
