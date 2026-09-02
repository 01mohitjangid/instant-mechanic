'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRealtime } from '@/components/shared/realtime-provider';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const LABELS = {
  connecting: { text: 'Connecting', dot: 'bg-muted-foreground', pulse: false },
  live: { text: 'Live', dot: 'bg-status-completed', pulse: true },
  polling: { text: 'Polling', dot: 'bg-status-pending', pulse: false },
} as const;

/**
 * Says how the dashboard is currently staying up to date.
 *
 * Worth showing rather than hiding: an operations team needs to know whether
 * the numbers in front of them are arriving the moment they change, or up to
 * fifteen seconds late.
 */
export function LiveIndicator({ className }: { className?: string }) {
  const { state, lastUpdatedAt, viewers } = useRealtime();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const label = LABELS[state];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="hidden cursor-default items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span className="relative flex size-2">
              {label.pulse ? (
                <span
                  className={cn(
                    'absolute inline-flex size-full animate-ping rounded-full opacity-70',
                    label.dot
                  )}
                />
              ) : null}
              <span className={cn('relative inline-flex size-2 rounded-full', label.dot)} />
            </span>
            {/* The word stays. Replacing it with a bare timestamp meant an
                operator could never see that the socket had dropped and the
                board was on a 15-second delay — only the dot colour changed.
                lastUpdatedAt is null until after mount, so the server and the
                first client render agree on the markup. */}
            <span>
              {label.text}
              {lastUpdatedAt ? ` · ${formatTime(lastUpdatedAt.toISOString())}` : ''}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {state === 'live' ? (
            <p>
              Live over WebSocket
              {viewers > 0 ? ` · ${viewers} ${viewers === 1 ? 'viewer' : 'viewers'}` : ''}
            </p>
          ) : state === 'polling' ? (
            <p>Socket unavailable — refreshing every 15 seconds instead</p>
          ) : (
            <p>Opening the live connection…</p>
          )}
        </TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Refresh now"
        onClick={() => startTransition(() => router.refresh())}
        className="text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={cn('size-4', isPending && 'animate-spin')} />
      </Button>
    </div>
  );
}
