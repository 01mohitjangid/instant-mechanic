'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Client boundary for theme state.
 *
 * Kept in its own file so the root layout can stay a Server Component — the
 * `"use client"` directive is contagious, and putting it on the layout would
 * drag every page into the browser bundle.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
