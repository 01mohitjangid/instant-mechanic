import { CardsSkeleton, ChartSkeleton } from '@/components/shared/states';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while a Server Component page is still fetching.
 *
 * It mirrors the real layout — eight tiles then two charts — so the page does
 * not jump when the data lands.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6">
      <Skeleton className="h-9 w-52" />
      <CardsSkeleton />
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-36" />
              <ChartSkeleton />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
