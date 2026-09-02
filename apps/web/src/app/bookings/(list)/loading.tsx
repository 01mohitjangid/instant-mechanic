import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/shared/states';

export default function BookingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Card className="py-0">
        <CardContent className="p-0">
          <TableSkeleton rows={10} />
        </CardContent>
      </Card>
    </div>
  );
}
