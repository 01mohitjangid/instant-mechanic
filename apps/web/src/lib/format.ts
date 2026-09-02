/**
 * Display formatting.
 *
 * Every date is formatted with an explicit timezone. Without one, the server
 * renders in UTC and the browser re-renders in the viewer's local zone, and
 * React reports a hydration mismatch on a page that looked fine.
 */

const TIMEZONE = 'Asia/Kolkata';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money arrives as a decimal string, so it is only parsed at the very edge. */
export function formatCurrency(value: string | number, precise = false): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return precise ? inrPrecise.format(amount) : inr.format(amount);
}

/** ₹24.6L / ₹2.5Cr — for a KPI tile, where the exact rupee is noise. */
export function formatCompactCurrency(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return inr.format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const chartDay = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateOnly.format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return timeOnly.format(new Date(iso));
}

/** "01 Sep" — an x-axis label for a `YYYY-MM-DD` series point. */
export function formatChartDay(day: string): string {
  return chartDay.format(new Date(`${day}T00:00:00Z`));
}

/** Minutes as "2h 30m". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
