import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Topbar } from '@/components/layout/topbar';
import { PageShell } from '@/components/shared/page-shell';

export default function BookingNotFound() {
  return (
    <>
      <Topbar title="Booking not found" />
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="size-6" />
          </span>
          <div>
            <p className="text-lg font-semibold">That booking does not exist</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been removed, or the reference in the URL is wrong.
            </p>
          </div>
          <Button asChild>
            <Link href="/bookings">Back to bookings</Link>
          </Button>
        </div>
      </PageShell>
    </>
  );
}
