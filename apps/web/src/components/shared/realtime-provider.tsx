'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  BOOKING_STATUS_LABELS,
  REALTIME_EVENTS,
  type BookingUpdatedEvent,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@instant-mechanic/shared';
import { API_URL } from '@/lib/api';

/**
 * The live connection, opened once for the whole dashboard.
 *
 * Every page shares this one socket. Opening one per page would mean a new
 * handshake on every navigation and several copies of the same event stream.
 */

export type ConnectionState = 'connecting' | 'live' | 'polling';

interface RealtimeValue {
  state: ConnectionState;
  /** The most recent change, so a page can highlight the row that just moved. */
  lastEvent: BookingUpdatedEvent | null;
  lastUpdatedAt: Date | null;
  viewers: number;
}

const RealtimeContext = createContext<RealtimeValue>({
  state: 'connecting',
  lastEvent: null,
  lastUpdatedAt: null,
  viewers: 0,
});

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}

/** Several bookings can move in the same second; one refresh covers them all. */
const REFRESH_DEBOUNCE_MS = 1200;
/**
 * Ceiling on that debounce. A trailing-edge timer that keeps being reset never
 * fires, so an event stream faster than the debounce would leave the board
 * frozen while events poured in. This guarantees a refresh regardless.
 */
const REFRESH_MAX_WAIT_MS = 4000;
/** Only used while the socket is down. */
const FALLBACK_POLL_MS = 15_000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>('connecting');
  const [lastEvent, setLastEvent] = useState<BookingUpdatedEvent | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [viewers, setViewers] = useState(0);

  // Held in refs, not state: rescheduling the debounce must not re-render.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPendingAt = useRef<number | null>(null);

  useEffect(() => {
    const scheduleRefresh = () => {
      const now = Date.now();
      firstPendingAt.current ??= now;

      // Once the oldest un-applied event is this old, stop deferring.
      const waited = now - firstPendingAt.current;
      const delay = Math.max(0, Math.min(REFRESH_DEBOUNCE_MS, REFRESH_MAX_WAIT_MS - waited));

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        firstPendingAt.current = null;
        // router.refresh() re-runs the Server Components and streams fresh HTML
        // in. The server query stays the single source of truth, so the KPI
        // tiles, the charts and the table can never drift apart the way they
        // would if each event patched its own row in client state.
        router.refresh();
        setLastUpdatedAt(new Date());
      }, delay);
    };

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    socket.on('connect', () => setState('live'));

    socket.on(REALTIME_EVENTS.connected, (event) => {
      setState('live');
      setViewers(event.viewers);
    });

    socket.on(REALTIME_EVENTS.bookingUpdated, (event) => {
      setLastEvent(event);
      toast(`${event.reference} → ${BOOKING_STATUS_LABELS[event.toStatus]}`, {
        description: `${event.customerName} · ${event.serviceName}`,
      });
      scheduleRefresh();
    });

    // Not an error state. The dashboard keeps working, just on a timer — so the
    // indicator says "Polling", not "Offline", and nothing red appears.
    socket.on('disconnect', () => setState('polling'));
    socket.on('connect_error', () => setState('polling'));

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      socket.close();
    };
  }, [router]);

  // The safety net: if the socket is down, fall back to the polling the
  // dashboard used before real-time existed, so it degrades instead of freezing.
  useEffect(() => {
    if (state === 'live') return;

    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      router.refresh();
      setLastUpdatedAt(new Date());
    }, FALLBACK_POLL_MS);

    return () => clearInterval(timer);
  }, [state, router]);

  const value = useMemo(
    () => ({ state, lastEvent, lastUpdatedAt, viewers }),
    [state, lastEvent, lastUpdatedAt, viewers]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
