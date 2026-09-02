import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </span>
      <div>
        <p className="text-lg font-semibold">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          That page does not exist in the operations dashboard.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to overview</Link>
      </Button>
    </div>
  );
}
