import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/shared/states';

export default function CustomersLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6">
      <Skeleton className="h-9 w-64" />
      <Card className="py-0">
        <CardContent className="p-0">
          <TableSkeleton rows={10} />
        </CardContent>
      </Card>
    </div>
  );
}
