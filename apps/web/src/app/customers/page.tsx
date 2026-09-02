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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SortHeader } from '@/components/bookings/sort-header';
import { Pagination } from '@/components/bookings/pagination';
import { ApiClientError, fetchCustomers } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber, initials } from '@/lib/format';
import { readNumber, readParam, type RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customers' };

const DEFAULT_SORT = 'lastBooking';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;

  let result;
  try {
    result = await fetchCustomers({
      page: readNumber(params, 'page') ?? 1,
      pageSize: 20,
      search: readParam(params, 'search'),
      city: readParam(params, 'city'),
      sortBy: readParam(params, 'sortBy') ?? DEFAULT_SORT,
      sortOrder: readParam(params, 'sortOrder') ?? 'desc',
    });
  } catch (error) {
    return (
      <>
        <Topbar title="Customers" />
        <PageShell>
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : 'The customers could not be loaded.'
            }
          />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Topbar title="Customers" description="Booking history and lifetime value" />

      <PageShell>
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            {result.data.length === 0 ? (
              <EmptyState title="No customers found" description="Nothing matches these filters." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>
                        <SortHeader column="name" label="Customer" defaultColumn={DEFAULT_SORT} />
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead className="hidden sm:table-cell">City</TableHead>
                      <TableHead className="text-right">
                        <SortHeader
                          column="totalBookings"
                          label="Bookings"
                          defaultColumn={DEFAULT_SORT}
                          className="justify-end"
                        />
                      </TableHead>
                      <TableHead className="text-right">
                        <SortHeader
                          column="lifetimeValue"
                          label="Lifetime value"
                          defaultColumn={DEFAULT_SORT}
                          className="justify-end"
                        />
                      </TableHead>
                      <TableHead className="text-right">
                        <SortHeader
                          column="lastBooking"
                          label="Last booking"
                          defaultColumn={DEFAULT_SORT}
                          className="justify-end"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {result.data.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                {initials(customer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{customer.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {customer.vehicleCount}{' '}
                                {customer.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <p className="tabular truncate text-sm">{customer.phone}</p>
                          <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {customer.city}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/bookings?customerId=${customer.id}`}
                            className="tabular font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {formatNumber(customer.totalBookings)}
                          </Link>
                          <p className="mt-0.5 flex justify-end gap-1">
                            <Badge variant="secondary" className="tabular px-1.5 py-0 text-[10px]">
                              {customer.completedBookings} done
                            </Badge>
                            {customer.cancelledBookings > 0 ? (
                              <Badge variant="outline" className="tabular px-1.5 py-0 text-[10px]">
                                {customer.cancelledBookings} cancelled
                              </Badge>
                            ) : null}
                          </p>
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatCurrency(customer.lifetimeValue)}
                        </TableCell>
                        <TableCell className="tabular text-right text-sm">
                          {formatDate(customer.lastBookingAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Pagination meta={result.meta} pathname="/customers" searchParams={params} />
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
