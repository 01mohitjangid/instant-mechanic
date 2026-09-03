/**
 * Marks that the boot screen has already been shown in this tab.
 *
 * This constant deliberately lives outside `boot-screen.tsx`. That file is a
 * `'use client'` module, and a Server Component importing a plain value across
 * that boundary receives a client-reference proxy rather than the string — the
 * root layout ended up inlining `sessionStorage.getItem(undefined)`, which
 * always missed and re-showed the splash on every single page load.
 *
 * sessionStorage rather than localStorage: "first visit" should mean this
 * session. Someone returning tomorrow sees the dashboard boot again, which is
 * the intent; someone clicking between pages does not.
 */
export const BOOT_SEEN_KEY = 'im.booted';
