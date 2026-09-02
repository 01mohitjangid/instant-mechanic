import Link from 'next/link';
import type { Metadata } from 'next';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { BookingStatusBadge, MechanicStatusBadge } from '@/components/shared/status-badge';
import { Pagination } from '@/components/bookings/pagination';
import { MechanicFilters } from '@/components/mechanics/mechanic-filters';
import { ApiClientError, fetchFilterOptions, fetchMechanics } from '@/lib/api';
import { formatCompactCurrency, formatDateTime, formatNumber, initials } from '@/lib/format';
import { readNumber, readParam, type RawSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mechanics' };

export default async function MechanicsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;

  // The roster and the filter bar's city list are independent reads, so they go
  // out together rather than one after the other.
  const optionsPromise = fetchFilterOptions().catch(() => null);

  let result;
  try {
    result = await fetchMechanics({
      page: readNumber(params, 'page') ?? 1,
      pageSize: 12,
      search: readParam(params, 'search'),
      status: readParam(params, 'status'),
      city: readParam(params, 'city'),
      sortBy: readParam(params, 'sortBy') ?? 'jobsCompleted',
      sortOrder: readParam(params, 'sortOrder') ?? 'desc',
    });
  } catch (error) {
    return (
      <>
        <Topbar title="Mechanics" />
        <PageShell>
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : 'The mechanics could not be loaded.'
            }
          />
        </PageShell>
      </>
    );
  }

  const cities = (await optionsPromise)?.cities ?? [];

  // Scales every workload bar against the busiest mechanic, so the bars compare
  // people to each other rather than to an arbitrary ceiling.
  const busiest = Math.max(...result.data.map((mechanic) => mechanic.jobsCompleted), 1);

  return (
    <>
      <Topbar title="Mechanics" description="Workload, availability and current job" />

      <PageShell>
        <MechanicFilters cities={cities} />

        {result.data.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState title="No mechanics found" description="Nothing matches these filters." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((mechanic) => (
              <Card key={mechanic.id} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {initials(mechanic.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{mechanic.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {mechanic.specialization} · {mechanic.city}
                      </p>
                    </div>
                    <MechanicStatusBadge status={mechanic.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="tabular text-lg font-semibold">
                        {formatNumber(mechanic.jobsCompleted)}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="tabular text-lg font-semibold">
                        {formatCompactCurrency(mechanic.revenueGenerated)}
                      </p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="tabular inline-flex items-center gap-1 text-lg font-semibold">
                        {mechanic.averageRating ?? '—'}
                        {mechanic.averageRating ? (
                          <Star className="size-3.5 fill-status-pending text-status-pending" />
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Workload</span>
                      <span>{mechanic.activeJobs} active</span>
                    </div>
                    <Progress value={(mechanic.jobsCompleted / busiest) * 100} className="h-1.5" />
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {mechanic.currentBooking?.isLive ? 'Working now' : 'Last job'}
                    </p>
                    {mechanic.currentBooking ? (
                      <Link
                        href={`/bookings/${mechanic.currentBooking.id}`}
                        className="block space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular truncate text-sm font-medium text-primary underline-offset-4 hover:underline">
                            {mechanic.currentBooking.reference}
                          </span>
                          <BookingStatusBadge status={mechanic.currentBooking.status} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {mechanic.currentBooking.customerName} ·{' '}
                          {mechanic.currentBooking.serviceName}
                        </p>
                        <p className="tabular text-xs text-muted-foreground">
                          {formatDateTime(mechanic.currentBooking.scheduledAt)}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">No jobs yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="py-0">
          <CardContent className="p-0">
            <Pagination meta={result.meta} pathname="/mechanics" searchParams={params} />
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
