'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, LayoutDashboard, Users, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/mechanics', label: 'Mechanics', icon: Wrench },
  { href: '/customers', label: 'Customers', icon: Users },
] as const;

/** Client-side only because it needs the current path to mark the active link. */
export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        // "/" would otherwise match every route under it.
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
