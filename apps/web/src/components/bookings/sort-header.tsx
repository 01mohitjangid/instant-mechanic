'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import { buildQueryString } from '@/lib/search-params';

/**
 * A sortable column heading.
 *
 * Clicking the active column flips the direction; clicking a different column
 * starts it descending, which is what people expect from "most recent" and
 * "highest amount" alike.
 */
export function SortHeader({
  column,
  label,
  defaultColumn,
  className,
}: {
  column: string;
  label: string;
  defaultColumn: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeColumn = searchParams.get('sortBy') ?? defaultColumn;
  const activeOrder = searchParams.get('sortOrder') ?? 'desc';
  const isActive = activeColumn === column;
  const nextOrder = isActive && activeOrder === 'desc' ? 'asc' : 'desc';

  const Icon = !isActive ? ChevronsUpDown : activeOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() =>
          router.push(
            `${pathname}${buildQueryString(searchParams, { sortBy: column, sortOrder: nextOrder, page: null })}`
          )
        )
      }
      aria-label={`Sort by ${label}, ${nextOrder}ending`}
      className={cn(
        '-mx-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium tracking-wide uppercase transition-colors hover:bg-accent',
        isActive ? 'text-foreground' : 'text-muted-foreground',
        className
      )}
    >
      {label}
      <Icon className="size-3.5" />
    </button>
  );
}
