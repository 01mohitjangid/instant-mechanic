'use client';

import { useState } from 'react';
import { Menu, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Nav } from './nav';

/** The sidebar for small screens: the same links, behind a slide-out sheet. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Link href="/" onClick={() => setOpen(false)} className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Instant Mechanic</span>
            <span className="text-xs text-muted-foreground">Operations</span>
          </span>
        </Link>
        <Nav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
