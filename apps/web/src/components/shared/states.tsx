import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, PlugZap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Nothing matched — not a failure, so it must not look like one. */
export function EmptyState({
  title = 'Nothing to show',
  description = 'No records match the current filters. Try widening your search.',
  icon,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Something broke. The message says what to do about it, because "Error" alone
 * leaves an operations team with nowhere to go.
 */
export function ErrorState({
  title = 'Could not load this data',
  message,
  hint,
}: {
  title?: string;
  message: string;
  hint?: string;
}) {
  const unreachable = message.toLowerCase().includes('could not reach');

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          {unreachable ? <PlugZap className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
          {hint ? <p className="mt-2 max-w-md text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Skeletons mirror the real layout, so the page does not jump when data lands. */
export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-4', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}
