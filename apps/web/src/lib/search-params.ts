/**
 * Filter state lives in the URL, not in React state.
 *
 * That is what makes a filtered view shareable, bookmarkable and survivable
 * across a refresh — and it lets the table stay a Server Component, because the
 * filters arrive as part of the request rather than as client state.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value only: `?status=a&status=b` is a client bug, not two filters. */
export function readParam(params: RawSearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.length > 0 ? single : undefined;
}

export function readNumber(params: RawSearchParams, key: string): number | undefined {
  const raw = readParam(params, key);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Merge changes into the current query. `null` removes a key. */
export function buildQueryString(
  current: RawSearchParams | URLSearchParams,
  updates: Record<string, string | number | null | undefined>
): string {
  const next =
    current instanceof URLSearchParams
      ? new URLSearchParams(current)
      : new URLSearchParams(
          Object.entries(current).flatMap(([key, value]) => {
            const single = Array.isArray(value) ? value[0] : value;
            return single ? [[key, single] as [string, string]] : [];
          })
        );

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, String(value));
  }

  const query = next.toString();
  return query ? `?${query}` : '';
}

/** Any filter change must send the user back to page 1, or they land on an empty page. */
export function buildFilterHref(
  pathname: string,
  current: RawSearchParams | URLSearchParams,
  updates: Record<string, string | number | null | undefined>
): string {
  return `${pathname}${buildQueryString(current, { ...updates, page: null })}`;
}
