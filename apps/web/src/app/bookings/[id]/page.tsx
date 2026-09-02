import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Car, IndianRupee, Star, User, Wrench } from 'lucide-react';
import { BOOKING_STATUS_LABELS } from '@instant-mechanic/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';
import { ErrorState } from '@/components/shared/states';
import { BookingStatusBadge } from '@/components/shared/status-badge';
import { ApiClientError, fetchBooking } from '@/lib/api';
import { BOOKING_STATUS_FILL } from '@/lib/status';
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Booking ${id}` };
}

/** One label/value line. Used enough times to be worth naming. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let booking;
  try {
    booking = await fetchBooking(id);
  } catch (error) {
    // A missing booking, or an id that is not a number at all, means the URL is
    // simply wrong — that is a 404 page, not an error panel. The API answers 404
    // for the first and 400 for the second. Anything else is a real failure.
    if (error instanceof ApiClientError && (error.isNotFound || error.status === 400)) {
      notFound();
    }
    return (
      <>
        <Topbar title="Booking" />
        <PageShell>
          <ErrorState
            message={
              error instanceof ApiClientError ? error.message : 'This booking could not be loaded.'
            }
          />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Topbar title={booking.reference} description={booking.service.name} />

      <PageShell>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/bookings">
              <ArrowLeft className="size-4" />
              Back to bookings
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <Badge variant="secondary" className="capitalize">
              {booking.paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IndianRupee className="size-4 text-muted-foreground" />
                Job summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <User className="size-3.5" /> Customer
                </p>
                <Field label="Name" value={booking.customer.name} />
                <Field
                  label="Phone"
                  value={<span className="tabular">{booking.customer.phone}</span>}
                />
                <Field
                  label="Email"
                  value={<span className="break-all">{booking.customerEmail}</span>}
                />
                <Field label="City" value={booking.customer.city} />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Car className="size-3.5" /> Vehicle
                </p>
                <Field label="Vehicle" value={booking.vehicle.label} />
                <Field
                  label="Registration"
                  value={<span className="tabular">{booking.vehicle.registrationNumber}</span>}
                />
                <Field label="Fuel" value={booking.vehicle.fuelType} />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Wrench className="size-3.5" /> Service
                </p>
                <Field label="Service" value={booking.service.name} />
                <Field label="Category" value={booking.service.category} />
                <Field
                  label="Expected time"
                  value={formatDuration(booking.service.durationMinutes)}
                />
                <Field label="List price" value={formatCurrency(booking.service.basePrice, true)} />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Wrench className="size-3.5" /> Mechanic
                </p>
                {booking.mechanic ? (
                  <>
                    <Field label="Name" value={booking.mechanic.name} />
                    <Field
                      label="Phone"
                      value={<span className="tabular">{booking.mechanic.phone}</span>}
                    />
                    <Field label="Specialisation" value={booking.mechanic.specialization} />
                  </>
                ) : (
                  <p className="py-1.5 text-sm text-muted-foreground">Not assigned yet</p>
                )}
              </div>

              <Separator className="sm:col-span-2" />

              <div className="grid gap-x-8 sm:col-span-2 sm:grid-cols-2">
                <Field label="Scheduled" value={formatDateTime(booking.scheduledAt)} />
                <Field label="Created" value={formatDateTime(booking.createdAt)} />
                <Field label="Started" value={formatDateTime(booking.startedAt)} />
                <Field label="Completed" value={formatDateTime(booking.completedAt)} />
                {booking.cancelledAt ? (
                  <>
                    <Field label="Cancelled" value={formatDateTime(booking.cancelledAt)} />
                    <Field label="Reason" value={booking.cancellationReason ?? '—'} />
                  </>
                ) : null}
                <Field
                  label="Amount"
                  value={
                    <span className="text-base font-semibold">
                      {formatCurrency(booking.amount, true)}
                    </span>
                  }
                />
                <Field
                  label="Rating"
                  value={
                    booking.rating ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5 fill-status-pending text-status-pending" />
                        {booking.rating} / 5
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>

              {booking.notes ? (
                <div className="rounded-lg border bg-muted/40 p-3 sm:col-span-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Notes
                  </p>
                  <p className="mt-1 text-sm">{booking.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-6">
                {booking.history.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className="absolute top-1 -left-[1.6875rem] size-3 rounded-full ring-4 ring-background"
                      style={{ backgroundColor: BOOKING_STATUS_FILL[event.toStatus] }}
                    />
                    <p className="text-sm font-medium">{BOOKING_STATUS_LABELS[event.toStatus]}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {formatDateTime(event.changedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">by {event.changedBy}</p>
                    {event.note ? <p className="mt-1 text-xs italic">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </>
  );
}
