import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Consistent page padding and max width, so every screen lines up. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6', className)}>
      {children}
    </main>
  );
}
