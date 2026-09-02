import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@instant-mechanic/shared';
import { Button } from '@/components/ui/button';
import { buildQueryString, type RawSearchParams } from '@/lib/search-params';
import { formatNumber } from '@/lib/format';

/**
 * Plain links, not buttons, so a page is a real URL: shareable, and openable in
 * a new tab. Rendered on the server, so it costs nothing in the client bundle.
 */
export function Pagination({
  meta,
  pathname,
  searchParams,
}: {
  meta: PaginationMeta;
  pathname: string;
  searchParams: RawSearchParams;
}) {
  // A bookmarked or hand-edited ?page=9 can land past the end. Without this,
  // the range reads "Showing 21-2 of 2" over an empty table.
  const outOfRange = meta.totalItems > 0 && meta.page > meta.totalPages;
  const first = meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {meta.totalItems === 0 ? (
          'No results'
        ) : outOfRange ? (
          <>
            Page {formatNumber(meta.page)} is past the end of{' '}
            <span className="tabular font-medium text-foreground">
              {formatNumber(meta.totalItems)}
            </span>{' '}
            {meta.totalItems === 1 ? 'result' : 'results'}
          </>
        ) : (
          <>
            Showing{' '}
            <span className="tabular font-medium text-foreground">{formatNumber(first)}</span>
            {'–'}
            <span className="tabular font-medium text-foreground">
              {formatNumber(last)}
            </span> of{' '}
            <span className="tabular font-medium text-foreground">
              {formatNumber(meta.totalItems)}
            </span>
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Page {formatNumber(Math.min(meta.page, Math.max(meta.totalPages, 1)))} of{' '}
          {formatNumber(Math.max(meta.totalPages, 1))}
        </span>

        <Button
          asChild={meta.hasPreviousPage}
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
        >
          {meta.hasPreviousPage ? (
            <Link
              href={`${pathname}${buildQueryString(searchParams, { page: meta.page - 1 })}`}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-4" />
              Previous
            </span>
          )}
        </Button>

        <Button asChild={meta.hasNextPage} variant="outline" size="sm" disabled={!meta.hasNextPage}>
          {meta.hasNextPage ? (
            <Link
              href={`${pathname}${buildQueryString(searchParams, { page: meta.page + 1 })}`}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
