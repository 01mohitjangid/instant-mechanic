import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { Nav } from './nav';

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Instant Mechanic</span>
        <span className="text-xs text-muted-foreground">Operations</span>
      </span>
    </Link>
  );
}

/** The desktop sidebar. Hidden below `lg`, where the mobile sheet takes over. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
      <Brand />
      <Nav />
      <div className="mt-auto rounded-lg border border-sidebar-border bg-background/50 p-3">
        <p className="text-xs font-medium">Live operations</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bookings update the moment their status changes.
        </p>
      </div>
    </aside>
  );
}

export { Brand };
