import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Tints the icon chip. Defaults to the neutral primary. */
  tone?: 'default' | 'pending' | 'completed' | 'cancelled' | 'live';
  className?: string;
}

const TONES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-primary/10 text-primary',
  pending: 'bg-status-pending/15 text-status-pending',
  completed: 'bg-status-completed/15 text-status-completed',
  cancelled: 'bg-status-cancelled/15 text-status-cancelled',
  live: 'bg-status-in-progress/15 text-status-in-progress',
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="tabular truncate text-2xl font-semibold">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
