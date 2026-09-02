import type {
  ApiErrorResponse,
  ApiResponse,
  BookingDetail,
  BookingListItem,
  CustomerSummary,
  DashboardAnalytics,
  DashboardOverview,
  FilterOptions,
  MechanicSummary,
  PaginatedResponse,
  ServiceSummary,
} from '@instant-mechanic/shared';

/**
 * The single door to the operations API.
 *
 * Every network call in the dashboard goes through here. Nothing calls `fetch`
 * directly, so the base URL, the error shape and the caching policy are decided
 * in one place instead of drifting across twenty components.
 */

/**
 * Falls back to localhost so a fresh clone runs with no .env file at all.
 * `NEXT_PUBLIC_` is required because the value is also needed in the browser;
 * it is a public URL, not a secret.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  ''
);

/** An error the API deliberately returned, carrying its status and code. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

/** Drop empty values so the URL carries only filters that are actually set. */
function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      // The dashboard is a live view: a cached response would show stale
      // numbers while claiming to be current.
      cache: 'no-store',
    });
  } catch {
    // A refused connection or DNS failure never reaches the block below,
    // because fetch rejects rather than returning a response.
    throw new ApiClientError(
      503,
      'API_UNREACHABLE',
      `Could not reach the operations API at ${API_URL}. Is it running?`
    );
  }

  if (!response.ok) {
    let code = 'HTTP_ERROR';
    let message = `The API responded with ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // A non-JSON error body (a proxy's HTML 502 page, say) keeps the default.
    }
    throw new ApiClientError(response.status, code, message);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------- dashboard

export async function fetchOverview(): Promise<DashboardOverview> {
  const { data } = await request<ApiResponse<DashboardOverview>>('/api/dashboard');
  return data;
}

export async function fetchAnalytics(days = 30): Promise<DashboardAnalytics> {
  const { data } = await request<ApiResponse<DashboardAnalytics>>(
    `/api/dashboard/analytics${buildQuery({ days })}`
  );
  return data;
}

// ----------------------------------------------------------------- bookings

export interface BookingQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  serviceId?: number;
  mechanicId?: number;
  customerId?: number;
  category?: string;
  city?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: string;
}

export function fetchBookings(
  query: BookingQuery = {}
): Promise<PaginatedResponse<BookingListItem>> {
  return request<PaginatedResponse<BookingListItem>>(`/api/bookings${buildQuery({ ...query })}`);
}

export async function fetchBooking(id: number | string): Promise<BookingDetail> {
  const { data } = await request<ApiResponse<BookingDetail>>(`/api/bookings/${id}`);
  return data;
}

// ---------------------------------------------------------------- mechanics

export interface MechanicQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  city?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function fetchMechanics(
  query: MechanicQuery = {}
): Promise<PaginatedResponse<MechanicSummary>> {
  return request<PaginatedResponse<MechanicSummary>>(`/api/mechanics${buildQuery({ ...query })}`);
}

// ---------------------------------------------------------------- customers

export interface CustomerQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  city?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function fetchCustomers(
  query: CustomerQuery = {}
): Promise<PaginatedResponse<CustomerSummary>> {
  return request<PaginatedResponse<CustomerSummary>>(`/api/customers${buildQuery({ ...query })}`);
}

// ----------------------------------------------------------------- catalogue

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data } = await request<ApiResponse<FilterOptions>>('/api/filters');
  return data;
}

export async function fetchServices(): Promise<ServiceSummary[]> {
  const { data } = await request<ApiResponse<ServiceSummary[]>>('/api/services');
  return data;
}
