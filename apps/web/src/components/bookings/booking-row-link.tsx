import Link from 'next/link';
import type { BookingListItem } from '@instant-mechanic/shared';
import { BookingStatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/format';

/** A compact booking line used by the overview panels. */
export function BookingRowLink({ booking }: { booking: BookingListItem }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{booking.customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {booking.service.name} · {booking.vehicle.registrationNumber}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="tabular text-sm font-medium">{formatCurrency(booking.amount)}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(booking.scheduledAt)}</p>
      </div>
      <BookingStatusBadge status={booking.status} className="shrink-0" />
    </Link>
  );
}
