import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { RealtimeProvider } from '@/components/shared/realtime-provider';
import { Sidebar } from '@/components/layout/sidebar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Instant Mechanic — Live Operations',
    template: '%s · Instant Mechanic',
  },
  description:
    'Live operations dashboard for vehicle service bookings, mechanics, customers and revenue.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before React hydrates, which is a deliberate mismatch.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            {/* One socket for the whole app, opened here so it survives
                navigation between pages. */}
            <RealtimeProvider>
              <div className="flex min-h-svh">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">{children}</div>
              </div>
              <Toaster position="bottom-right" closeButton />
            </RealtimeProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
