'use client';

import { useEffect, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';
import { useRealtime } from '@/components/shared/realtime-provider';
import { BOOT_SEEN_KEY } from '@/lib/boot';



/** Below this the splash reads as a glitch rather than a deliberate state. */
const MIN_VISIBLE_MS = 1000;
const MIN_VISIBLE_REDUCED_MS = 400;

const HARD_CAP_MS = 2600;
const FADE_MS = 420;

export function BootScreen() {
  const { state } = useRealtime();
  const [minElapsed, setMinElapsed] = useState(false);
  const [capped, setCapped] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (!document.documentElement.classList.contains('booting')) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minTimer = setTimeout(
      () => setMinElapsed(true),
      reduced ? MIN_VISIBLE_REDUCED_MS : MIN_VISIBLE_MS
    );
    const capTimer = setTimeout(() => setCapped(true), HARD_CAP_MS);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(capTimer);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dismissed.current || !root.classList.contains('booting')) return;

    // 'connecting' is the only unsettled state: both 'live' and 'polling' mean
    // the dashboard now knows how it is getting its data.
    const settled = state !== 'connecting';
    if (!capped && !(minElapsed && settled)) return;

    dismissed.current = true;
    try {
      sessionStorage.setItem(BOOT_SEEN_KEY, '1');
    } catch {
      // Private-browsing modes throw on write. Showing the splash again next
      // time is a far smaller problem than crashing the app over it.
    }

    root.classList.add('boot-leaving');
  
    setTimeout(() => root.classList.remove('booting', 'boot-leaving'), FADE_MS);
  }, [state, minElapsed, capped]);

  return (
    <div id="boot-screen" role="status" aria-live="polite">
      <div className="boot-panel">
        <span className="boot-mark">
          <span className="boot-mark__tile">
            <Wrench className="size-6" aria-hidden="true" />
          </span>
        </span>

        <span className="flex flex-col items-center gap-1">
          <span className="text-base font-semibold tracking-tight">Instant Mechanic</span>
          <span className="text-xs text-muted-foreground">Live Operations</span>
        </span>

        <span className="boot-bar">
          <span className="boot-bar__fill" />
        </span>

        <span className="text-xs text-muted-foreground">Connecting to live operations…</span>
      </div>
    </div>
  );
}
