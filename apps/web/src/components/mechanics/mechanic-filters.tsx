'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { MECHANIC_STATUSES } from '@instant-mechanic/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MECHANIC_STATUS_LABELS } from '@/lib/status';
import { buildQueryString } from '@/lib/search-params';

const ALL = '__all__';

/**
 * Every sort key the API accepts, each with the direction that actually reads
 * as its label. Without the explicit order, picking "Name" inherited the page's
 * `desc` default and listed people Z to A.
 */
const SORTS = [
  { value: 'jobsCompleted', label: 'Most jobs done', order: 'desc' },
  { value: 'revenue', label: 'Highest revenue', order: 'desc' },
  { value: 'rating', label: 'Best rated', order: 'desc' },
  { value: 'name', label: 'Name (A–Z)', order: 'asc' },
  { value: 'status', label: 'Availability', order: 'asc' },
  { value: 'hiredAt', label: 'Recently hired', order: 'desc' },
] as const;

/** Same URL-driven pattern as the bookings filter bar. */
export function MechanicFilters({ cities }: { cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('search') ?? '';
  const [term, setTerm] = useState(currentSearch);

  useEffect(() => setTerm(currentSearch), [currentSearch]);

  const push = (updates: Record<string, string | null>) => {
    const query = buildQueryString(searchParams, { ...updates, page: null });
    startTransition(() => router.push(`${pathname}${query}`));
  };

  useEffect(() => {
    if (term === currentSearch) return;
    const timer = setTimeout(() => push({ search: term || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const status = searchParams.get('status') ?? ALL;
  const city = searchParams.get('city') ?? ALL;
  const sortBy = searchParams.get('sortBy') ?? 'jobsCompleted';
  const IGNORED = new Set(['page', 'sortBy', 'sortOrder']);
  const hasFilters = [...searchParams.keys()].some((key) => !IGNORED.has(key));

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending ? '' : undefined}>
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search name or specialisation…"
          aria-label="Search mechanics"
          className="pl-9"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => push({ status: value === ALL ? null : value })}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by availability">
          <SelectValue placeholder="Availability" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All availability</SelectItem>
          {/* The API accepts a comma-separated list; without a matching item the
              trigger would go blank while the list stayed correctly filtered. */}
          {status.includes(',') ? <SelectItem value={status}>Multiple statuses</SelectItem> : null}
          {MECHANIC_STATUSES.map((entry) => (
            <SelectItem key={entry} value={entry}>
              {MECHANIC_STATUS_LABELS[entry]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={city} onValueChange={(value) => push({ city: value === ALL ? null : value })}>
        <SelectTrigger className="w-[140px]" aria-label="Filter by city">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All cities</SelectItem>
          {cities.map((entry) => (
            <SelectItem key={entry} value={entry}>
              {entry}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sortBy}
        onValueChange={(value) =>
          push({
            sortBy: value,
            sortOrder: SORTS.find((entry) => entry.value === value)?.order ?? 'desc',
          })
        }
      >
        <SelectTrigger className="w-[170px]" aria-label="Sort mechanics">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((entry) => (
            <SelectItem key={entry.value} value={entry.value}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push(pathname))}
          className="text-muted-foreground"
        >
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
