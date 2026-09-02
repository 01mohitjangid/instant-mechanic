import type { PaginationMeta } from '@instant-mechanic/shared';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Turn a validated page/pageSize pair into the LIMIT/OFFSET the query needs.
 * Capped, because an un-capped `pageSize` is a free denial-of-service.
 */
export function toLimitOffset(page: number, pageSize: number): { limit: number; offset: number } {
  const limit = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  return { limit, offset: (Math.max(page, 1) - 1) * limit };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const limit = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
