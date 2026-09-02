import { LiveIndicator } from '@/components/shared/live-indicator';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { MobileNav } from './mobile-nav';

interface TopbarProps {
  title: string;
  description?: string;
}

export function Topbar({ title, description }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6">
      <MobileNav />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
        {description ? (
          <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
      </div>
      <LiveIndicator />
      <ThemeToggle />
    </header>
  );
}
