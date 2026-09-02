/**
 * The API response contracts.
 *
 * The Express routes return exactly these shapes and the dashboard consumes
 * exactly these shapes, so a field rename breaks the build on both sides in the
 * same commit instead of showing up as a blank column in production.
 *
 * Money is a `string`, never a `number`. PostgreSQL NUMERIC does not fit in a
 * JavaScript float without losing paise, so amounts travel as decimal strings
 * and are formatted at the edge.
 */
import type { BookingStatus, MechanicStatus, PaymentStatus } from './booking.js';

/** Every successful response is wrapped, so clients always unwrap the same way. */
export interface ApiResponse<T> {
  data: T;
}

/** Every list response carries the paging state the table needs. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Every failure looks like this, whatever went wrong. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    /** Present only for 422s: which field failed and why. */
    details?: { path: string; message: string }[];
  };
}

// ---------------------------------------------------------------- dashboard

export interface DashboardOverview {
  totalBookings: number;
  todaysBookings: number;
  completedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  activeJobs: number;
  totalRevenue: string;
  todaysRevenue: string;
  activeMechanics: number;
  totalMechanics: number;
  newCustomers: number;
  totalCustomers: number;
  averageRating: number | null;
  averageTicket: string;
  /** The timezone every "today" figure above was resolved in. */
  timezone: string;
}

export interface StatusBreakdownEntry {
  status: BookingStatus;
  label: string;
  bookings: number;
  /**
   * Total amount of the bookings in this status — pipeline value, not earned
   * revenue. They coincide for `completed`; earned revenue is
   * `DashboardOverview.totalRevenue`.
   */
  value: string;
}

export interface ServiceBreakdownEntry {
  category: string;
  bookings: number;
  revenue: string;
}

export interface TimeSeriesPoint {
  /** ISO date, `YYYY-MM-DD`, in the operations timezone. */
  date: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: string;
}

export interface DashboardAnalytics {
  rangeDays: number;
  timezone: string;
  series: TimeSeriesPoint[];
  statusBreakdown: StatusBreakdownEntry[];
  serviceBreakdown: ServiceBreakdownEntry[];
}

// ----------------------------------------------------------------- bookings

export interface BookingListItem {
  id: number;
  reference: string;
  status: BookingStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  amount: string;
  scheduledAt: string;
  createdAt: string;
  completedAt: string | null;
  rating: number | null;
  customer: { id: number; name: string; phone: string; city: string };
  vehicle: { id: number; label: string; registrationNumber: string };
  service: { id: number; name: string; category: string };
  mechanic: { id: number; name: string } | null;
}

export interface BookingStatusEvent {
  id: number;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedAt: string;
  changedBy: string;
  note: string | null;
}

export interface BookingDetail extends BookingListItem {
  startedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  notes: string | null;
  updatedAt: string;
  customerEmail: string;
  vehicle: BookingListItem['vehicle'] & {
    make: string;
    model: string;
    year: number;
    fuelType: string;
  };
  service: BookingListItem['service'] & { durationMinutes: number; basePrice: string };
  mechanic: (BookingListItem['mechanic'] & { phone: string; specialization: string }) | null;
  history: BookingStatusEvent[];
}

// ---------------------------------------------------------------- mechanics

export interface MechanicSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  status: MechanicStatus;
  city: string;
  latitude: number | null;
  longitude: number | null;
  hiredAt: string;
  jobsCompleted: number;
  jobsCancelled: number;
  activeJobs: number;
  revenueGenerated: string;
  averageRating: number | null;
  /** The job in flight, or the most recent one if nothing is live. */
  currentBooking: {
    id: number;
    reference: string;
    status: BookingStatus;
    statusLabel: string;
    scheduledAt: string;
    customerName: string;
    serviceName: string;
    isLive: boolean;
  } | null;
}

// ---------------------------------------------------------------- customers

export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  vehicleCount: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  lifetimeValue: string;
  lastBookingAt: string | null;
}

// ----------------------------------------------------------------- services

export interface ServiceSummary {
  id: number;
  name: string;
  category: string;
  description: string | null;
  basePrice: string;
  durationMinutes: number;
  isActive: boolean;
  totalBookings: number;
}

/** Everything the dashboard needs to populate its filter dropdowns, in one call. */
export interface FilterOptions {
  statuses: { value: BookingStatus; label: string }[];
  services: { id: number; name: string; category: string }[];
  categories: string[];
  mechanics: { id: number; name: string }[];
  cities: string[];
}
