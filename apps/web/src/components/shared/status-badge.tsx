import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  type MechanicStatus,
} from '@instant-mechanic/shared';
import { Badge } from '@/components/ui/badge';
import {
  BOOKING_STATUS_STYLES,
  MECHANIC_STATUS_LABELS,
  MECHANIC_STATUS_STYLES,
} from '@/lib/status';
import { cn } from '@/lib/utils';

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  const live = status === 'on_the_way' || status === 'in_progress';

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium', BOOKING_STATUS_STYLES[status], className)}
    >
      {/* A pulsing dot marks the two statuses where a mechanic is physically
          working right now — the ones an operations team watches. */}
      {live ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}

export function MechanicStatusBadge({
  status,
  className,
}: {
  status: MechanicStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', MECHANIC_STATUS_STYLES[status], className)}
    >
      {MECHANIC_STATUS_LABELS[status]}
    </Badge>
  );
}
