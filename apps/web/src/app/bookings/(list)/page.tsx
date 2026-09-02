import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { BookingStatusBadge } from '@/components/shared/status-badge';
import { BookingFilters } from '@/components/bookings/booking-filters';
import { SortHeader } from '@/components/bookings/sort-header';
import { Pagination } from '@/components/bookings/pagination';
import { ApiClientError, fetchBookings, fetchFilterOptions } from '@/lib/api';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { readNumber, readParam, type RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Bookings' };

const DEFAULT_SORT = 'scheduledAt';

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;

  // The filter bar's dropdowns and the table are independent reads, so they go
  // out together. `allSettled` means a failed dropdown lookup cannot blank the
  // whole page — the table still renders, just without its options.
  const [optionsResult, bookingsResult] = await Promise.allSettled([
    fetchFilterOptions(),
    fetchBookings({
      page: readNumber(params, 'page') ?? 1,
      pageSize: 20,
      search: readParam(params, 'search'),
      status: readParam(params, 'status'),
      category: readParam(params, 'category'),
      city: readParam(params, 'city'),
      mechanicId: readNumber(params, 'mechanicId'),
      serviceId: readNumber(params, 'serviceId'),
      // Read, because the customers table links straight here with a
      // ?customerId=… drill-down. Leaving it out made that link silently
      // return every booking in the system.
      customerId: readNumber(params, 'customerId'),
      minAmount: readNumber(params, 'minAmount'),
      maxAmount: readNumber(params, 'maxAmount'),
      from: readParam(params, 'from'),
      to: readParam(params, 'to'),
      sortBy: readParam(params, 'sortBy') ?? DEFAULT_SORT,
      sortOrder: readParam(params, 'sortOrder') ?? 'desc',
    }),
  ]);

  const options = optionsResult.status === 'fulfilled' ? optionsResult.value : null;

  return (
    <>
      <Topbar title="Bookings" description="Search, filter and drill into every job" />

      <PageShell>
        <BookingFilters options={options} />

        {bookingsResult.status === 'rejected' ? (
          <ErrorState
            message={
              bookingsResult.reason instanceof ApiClientError
                ? bookingsResult.reason.message
                : 'The bookings could not be loaded.'
            }
            hint="Check that the API is running and that your filters are valid."
          />
        ) : (
          <Card className="overflow-hidden py-0">
            <CardContent className="p-0">
              {bookingsResult.value.data.length === 0 ? (
                <EmptyState
                  title="No bookings match"
                  description="Nothing matches these filters. Clear one of them and try again."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>
                          <SortHeader
                            column="reference"
                            label="Booking"
                            defaultColumn={DEFAULT_SORT}
                          />
                        </TableHead>
                        <TableHead>
                          <SortHeader
                            column="customer"
                            label="Customer"
                            defaultColumn={DEFAULT_SORT}
                          />
                        </TableHead>
                        <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          <SortHeader
                            column="service"
                            label="Service"
                            defaultColumn={DEFAULT_SORT}
                          />
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          <SortHeader
                            column="mechanic"
                            label="Mechanic"
                            defaultColumn={DEFAULT_SORT}
                          />
                        </TableHead>
                        <TableHead>
                          <SortHeader column="status" label="Status" defaultColumn={DEFAULT_SORT} />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortHeader
                            column="amount"
                            label="Amount"
                            defaultColumn={DEFAULT_SORT}
                            className="justify-end"
                          />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortHeader
                            column="scheduledAt"
                            label="Scheduled"
                            defaultColumn={DEFAULT_SORT}
                            className="justify-end"
                          />
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {bookingsResult.value.data.map((booking) => (
                        <TableRow key={booking.id} className="group">
                          <TableCell>
                            <Link
                              href={`/bookings/${booking.id}`}
                              className="tabular font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {booking.reference}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{booking.customer.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {booking.customer.city}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="min-w-0">
                              <p className="truncate text-sm">{booking.vehicle.label}</p>
                              <p className="tabular truncate text-xs text-muted-foreground">
                                {booking.vehicle.registrationNumber}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="min-w-0">
                              <p className="truncate text-sm">{booking.service.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {booking.service.category}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {booking.mechanic ? (
                              <span className="text-sm">{booking.mechanic.name}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <BookingStatusBadge status={booking.status} />
                          </TableCell>
                          <TableCell className="tabular text-right font-medium">
                            {formatCurrency(booking.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="tabular text-sm">{formatDate(booking.scheduledAt)}</p>
                            <p className="tabular text-xs text-muted-foreground">
                              {formatTime(booking.scheduledAt)}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Pagination
                meta={bookingsResult.value.meta}
                pathname="/bookings"
                searchParams={params}
              />
            </CardContent>
          </Card>
        )}
      </PageShell>
    </>
  );
}
