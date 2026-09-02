'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The last line of defence: an error that escaped a page's own handling.
 *
 * Must be a Client Component — Next needs the `reset` callback to re-render the
 * segment without a full page reload.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] unhandled error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div>
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The dashboard hit an unexpected error. Trying again usually clears it; if it does not,
          check that the operations API is reachable.
        </p>
        {error.digest ? (
          <p className="tabular mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>
      <Button onClick={reset}>
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
