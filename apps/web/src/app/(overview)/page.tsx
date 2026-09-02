import {
  Activity,
  BadgeIndianRupee,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock,
  UserPlus,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { VolumeChart } from '@/components/dashboard/volume-chart';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { StatusChart } from '@/components/dashboard/status-chart';
import { CategoryChart } from '@/components/dashboard/category-chart';
import { BookingRowLink } from '@/components/bookings/booking-row-link';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { ApiClientError, fetchAnalytics, fetchBookings, fetchOverview } from '@/lib/api';
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/format';

/** Always render fresh: a cached operations dashboard is a lying one. */
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  // Four independent reads, issued together so the round trips overlap instead
  // of stacking up into a slow first paint.
  const results = await Promise.allSettled([
    fetchOverview(),
    fetchAnalytics(30),
    fetchBookings({ pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' }),
    fetchBookings({
      pageSize: 6,
      status: 'on_the_way,in_progress',
      sortBy: 'scheduledAt',
      sortOrder: 'asc',
    }),
  ]);

  const [overviewResult, analyticsResult, recentResult, liveResult] = results;

  // If the API is down, every panel fails the same way — so say it once, at the
  // top, instead of printing the same error six times.
  if (overviewResult.status === 'rejected') {
    const error = overviewResult.reason;
    return (
      <>
        <Topbar title="Overview" description="Live operations at a glance" />
        <PageShell>
          <ErrorState
            message={
              error instanceof ApiClientError
                ? error.message
                : 'The dashboard data could not be loaded.'
            }
            hint="Start the API with `npm run dev:api` from the repo root, or check NEXT_PUBLIC_API_URL."
          />
        </PageShell>
      </>
    );
  }

  const overview = overviewResult.value;
  const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : null;
  const recent = recentResult.status === 'fulfilled' ? recentResult.value.data : [];
  const live = liveResult.status === 'fulfilled' ? liveResult.value.data : [];

  return (
    <>
      <Topbar
        title="Overview"
        description={`Live operations · today resolved in ${overview.timezone}`}
      />

      <PageShell>
        <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total bookings"
            value={formatNumber(overview.totalBookings)}
            hint={`${formatNumber(overview.totalCustomers)} customers all-time`}
            icon={CalendarDays}
          />
          <KpiCard
            label="Today's bookings"
            value={formatNumber(overview.todaysBookings)}
            hint={`${formatCompactCurrency(overview.todaysRevenue)} earned today`}
            icon={CalendarClock}
            tone="live"
          />
          <KpiCard
            label="Completed"
            value={formatNumber(overview.completedBookings)}
            hint={`Avg ticket ${formatCurrency(overview.averageTicket)}`}
            icon={CircleCheck}
            tone="completed"
          />
          <KpiCard
            label="Pending"
            value={formatNumber(overview.pendingBookings)}
            hint="Waiting to be assigned"
            icon={Clock}
            tone="pending"
          />
          <KpiCard
            label="Cancelled"
            value={formatNumber(overview.cancelledBookings)}
            hint={`${((overview.cancelledBookings / Math.max(overview.totalBookings, 1)) * 100).toFixed(1)}% of all bookings`}
            icon={CircleX}
            tone="cancelled"
          />
          <KpiCard
            label="Total revenue"
            value={formatCompactCurrency(overview.totalRevenue)}
            hint="Completed jobs only"
            icon={BadgeIndianRupee}
            tone="completed"
          />
          <KpiCard
            label="Active mechanics"
            value={`${formatNumber(overview.activeMechanics)} / ${formatNumber(overview.totalMechanics)}`}
            hint={`${formatNumber(overview.activeJobs)} jobs in flight`}
            icon={Wrench}
          />
          <KpiCard
            label="New customers"
            value={formatNumber(overview.newCustomers)}
            hint="Signed up in the last 30 days"
            icon={UserPlus}
          />
        </section>

        {analytics ? (
          <>
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bookings over time</CardTitle>
                  <CardDescription>Last {analytics.rangeDays} days</CardDescription>
                </CardHeader>
                <CardContent>
                  <VolumeChart series={analytics.series} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue over time</CardTitle>
                  <CardDescription>Earned from completed jobs</CardDescription>
                </CardHeader>
                <CardContent>
                  <RevenueChart series={analytics.series} />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booking status</CardTitle>
                  <CardDescription>Where every booking currently sits</CardDescription>
                </CardHeader>
                <CardContent>
                  <StatusChart data={analytics.statusBreakdown} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by service category</CardTitle>
                  <CardDescription>Completed jobs only</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryChart data={analytics.serviceBreakdown} />
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <ErrorState
            title="Charts could not be loaded"
            message="The analytics endpoint did not respond. The figures above are still current."
          />
        )}

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-status-in-progress" />
                  Jobs in flight
                </CardTitle>
                <CardDescription>Mechanics working right now</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/bookings?status=on_the_way,in_progress">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {live.length === 0 ? (
                <EmptyState
                  title="Nothing in flight"
                  description="No mechanic is on the way or working a job at this moment."
                />
              ) : (
                <div className="flex flex-col">
                  {live.map((booking) => (
                    <BookingRowLink key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Latest bookings</CardTitle>
                <CardDescription>Most recently created</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/bookings">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {recent.length === 0 ? (
                <EmptyState title="No bookings yet" description="New bookings will appear here." />
              ) : (
                <div className="flex flex-col">
                  {recent.map((booking) => (
                    <BookingRowLink key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </PageShell>
    </>
  );
}
