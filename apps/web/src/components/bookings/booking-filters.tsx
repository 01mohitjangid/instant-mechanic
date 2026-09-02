'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { FilterOptions } from '@instant-mechanic/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildQueryString } from '@/lib/search-params';

const ALL = '__all__';

/**
 * Filters write to the URL and let the server re-render.
 *
 * Nothing is held in component state except the text being typed, so a
 * filtered view can be shared as a link and the back button does what it should.
 */
export function BookingFilters({ options }: { options: FilterOptions | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('search') ?? '';
  const [term, setTerm] = useState(currentSearch);

  // Keep the box in step when the URL changes underneath it — a "Clear all"
  // click or a back navigation must not leave stale text behind.
  useEffect(() => setTerm(currentSearch), [currentSearch]);

  const push = (updates: Record<string, string | null>) => {
    // Any filter change resets to page 1; staying on page 9 of a narrower
    // result set would show an empty table.
    const query = buildQueryString(searchParams, { ...updates, page: null });
    startTransition(() => router.push(`${pathname}${query}`));
  };

  // Debounced, so typing "Sharma" is one request instead of six.
  useEffect(() => {
    if (term === currentSearch) return;
    const timer = setTimeout(() => push({ search: term || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const status = searchParams.get('status') ?? ALL;
  const category = searchParams.get('category') ?? ALL;
  const mechanicId = searchParams.get('mechanicId') ?? ALL;
  const city = searchParams.get('city') ?? ALL;
  // Sorting is not a filter, so "Clear" must not offer to wipe it — and must
  // not light up just because the user clicked a column heading.
  const IGNORED = new Set(['page', 'sortBy', 'sortOrder']);
  const hasFilters = [...searchParams.keys()].some((key) => !IGNORED.has(key));

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending ? '' : undefined}>
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search booking, customer, plate…"
          aria-label="Search bookings"
          className="pl-9"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => push({ status: value === ALL ? null : value })}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {/* The overview links here with ?status=on_the_way,in_progress. Without
              a matching item the trigger would show an empty placeholder even
              though the table is correctly filtered. */}
          {status.includes(',') ? <SelectItem value={status}>Multiple statuses</SelectItem> : null}
          {options?.statuses.map((entry) => (
            <SelectItem key={entry.value} value={entry.value}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={category}
        onValueChange={(value) => push({ category: value === ALL ? null : value })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Filter by service category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {options?.categories.map((entry) => (
            <SelectItem key={entry} value={entry}>
              {entry}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={mechanicId}
        onValueChange={(value) => push({ mechanicId: value === ALL ? null : value })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Filter by mechanic">
          <SelectValue placeholder="Mechanic" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All mechanics</SelectItem>
          {options?.mechanics.map((entry) => (
            <SelectItem key={entry.id} value={String(entry.id)}>
              {entry.name}
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
          {options?.cities.map((entry) => (
            <SelectItem key={entry} value={entry}>
              {entry}
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
