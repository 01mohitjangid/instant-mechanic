import { query } from '../pool.js';

export interface ServiceRow {
  id: number;
  name: string;
  category: string;
  description: string | null;
  base_price: string;
  duration_minutes: number;
  is_active: boolean;
  total_bookings: string;
}

export async function selectServices(): Promise<ServiceRow[]> {
  const { rows } = await query<ServiceRow>(`
    SELECT
      s.id, s.name, s.category, s.description, s.base_price::text,
      s.duration_minutes, s.is_active,
      COUNT(b.id)::text AS total_bookings
    FROM services s
    LEFT JOIN bookings b ON b.service_id = s.id
    GROUP BY s.id
    ORDER BY s.category, s.name
  `);
  return rows;
}

export interface FilterOptionRows {
  services: { id: number; name: string; category: string }[];
  categories: string[];
  mechanics: { id: number; name: string }[];
  cities: string[];
}

/**
 * Everything the dashboard's filter bar needs, in one request.
 *
 * Four small independent lookups are issued together rather than sequentially,
 * so the round trips overlap instead of stacking up.
 */
export async function selectFilterOptions(): Promise<FilterOptionRows> {
  const [services, categories, mechanics, cities] = await Promise.all([
    query<{ id: number; name: string; category: string }>(
      `SELECT id, name, category FROM services WHERE is_active ORDER BY category, name`
    ),
    query<{ category: string }>(`SELECT DISTINCT category FROM services ORDER BY category`),
    query<{ id: number; name: string }>(
      `SELECT id, full_name AS name FROM mechanics ORDER BY full_name`
    ),
    query<{ city: string }>(`SELECT DISTINCT city FROM customers ORDER BY city`),
  ]);

  return {
    services: services.rows,
    categories: categories.rows.map((row) => row.category),
    mechanics: mechanics.rows,
    cities: cities.rows.map((row) => row.city),
  };
}
