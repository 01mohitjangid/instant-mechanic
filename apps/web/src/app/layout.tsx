import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { RealtimeProvider } from '@/components/shared/realtime-provider';
import { BootScreen } from '@/components/shared/boot-screen';
import { BOOT_SEEN_KEY } from '@/lib/boot';
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

/**
 * Decides, before the browser paints anything, whether this is a first visit
 * and the boot screen should cover the page.
 *
 * It has to be a blocking inline script. Left to React, the dashboard would
 * paint first and the splash would drop over the top of it after hydration.
 * Reading sessionStorage can throw outright in some privacy modes, so a
 * failure here simply means no splash.
 */
const bootFlagScript = `try{if(!sessionStorage.getItem(${JSON.stringify(
  BOOT_SEEN_KEY
)}))document.documentElement.classList.add('booting')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before React hydrates, which is a deliberate mismatch.
    // The boot flag above rides on the same allowance.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: bootFlagScript }} />
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
              {/* Inside the provider: the splash lifts when the live
                  connection settles, not on a timer invented for the look
                  of it. */}
              <BootScreen />
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
