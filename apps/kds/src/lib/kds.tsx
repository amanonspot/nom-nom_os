'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Me, Order } from '@nomnom/types';
import {
  advanceItem,
  advanceOrder,
  fetchActiveOrders,
  fetchMe,
  login as apiLogin,
  wsUrl,
  type KitchenStatus,
} from './api';

interface Session {
  token: string;
  branchId: string;
}

interface KdsValue {
  ready: boolean;
  session: Session | null;
  connected: boolean;
  orders: Order[];
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  bumpOrder: (id: string, status: KitchenStatus) => Promise<void>;
  bumpItem: (id: string, status: KitchenStatus) => Promise<void>;
}

const Ctx = createContext<KdsValue | null>(null);
const KEY = 'nomnom.kds.session';

export function KdsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [orderMap, setOrderMap] = useState<Record<string, Order>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  // Order ids we've already seen, so a new-order chime rings exactly once.
  const seenRef = useRef<Set<string>>(new Set());

  // Lazily create/resume the AudioContext — must follow a user gesture (login
  // click or first interaction) to satisfy browser autoplay policy.
  const ensureAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctor) audioRef.current = new Ctor();
      }
      void audioRef.current?.resume();
    } catch {
      /* audio unavailable — silent */
    }
  }, []);

  const playChime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      // Two short rising tones — a friendly "new order" ping.
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const upsert = useCallback((order: Order) => {
    if (order.id) seenRef.current.add(order.id);
    setOrderMap((m) => ({ ...m, [order.id!]: order }));
  }, []);

  const loadActive = useCallback(async (s: Session) => {
    try {
      const active = await fetchActiveOrders(s.token, s.branchId);
      // Seed "seen" so existing tickets don't chime on (re)connect.
      active.forEach((o) => o.id && seenRef.current.add(o.id));
      setOrderMap(Object.fromEntries(active.map((o) => [o.id!, o])));
    } catch {
      /* offline / poll will retry */
    }
  }, []);

  // Connect the WebSocket (with a polling fallback while disconnected).
  const connect = useCallback(
    (s: Session) => {
      wsRef.current?.close();
      const ws = new WebSocket(wsUrl(s.branchId, s.token));
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { event: string; order: Order };
          if (!msg.order) return;
          // Chime once for a genuinely new order (not for kitchen updates).
          if (msg.event === 'order.new' && msg.order.id && !seenRef.current.has(msg.order.id)) {
            playChime();
          }
          upsert(msg.order);
        } catch {
          /* ignore malformed */
        }
      };
      const startPolling = () => {
        setConnected(false);
        if (!pollRef.current) {
          pollRef.current = setInterval(() => void loadActive(s), 4000);
        }
      };
      ws.onclose = startPolling;
      ws.onerror = () => ws.close();
    },
    [upsert, loadActive, playChime],
  );

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    (async () => {
      if (raw) {
        const s = JSON.parse(raw) as Session;
        setSession(s);
        await loadActive(s);
        connect(s);
      }
      setReady(true);
    })();
    // Restored sessions: unlock audio on the first user interaction so the
    // new-order chime can play (autoplay policy needs a gesture).
    const unlock = () => ensureAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, pin: string) => {
      ensureAudio(); // unlock the chime while we're inside the login click
      const token = await apiLogin(username, pin);
      const me: Me = await fetchMe(token);
      const s: Session = { token, branchId: me.branch?.id ?? '' };
      localStorage.setItem(KEY, JSON.stringify(s));
      setSession(s);
      await loadActive(s);
      connect(s);
    },
    [loadActive, connect, ensureAudio],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    wsRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setSession(null);
    setOrderMap({});
  }, []);

  const bumpOrder = useCallback(
    async (id: string, status: KitchenStatus) => {
      if (!session) return;
      upsert(await advanceOrder(session.token, id, status));
    },
    [session, upsert],
  );

  const bumpItem = useCallback(
    async (id: string, status: KitchenStatus) => {
      if (!session) return;
      upsert(await advanceItem(session.token, id, status));
    },
    [session, upsert],
  );

  // Active tickets only (drop served/void), newest first.
  const orders = useMemo(
    () =>
      Object.values(orderMap)
        .filter((o) => ['pending', 'cooking', 'ready'].includes(o.kitchen_status ?? '') && o.status !== 'void')
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [orderMap],
  );

  const value = useMemo<KdsValue>(
    () => ({ ready, session, connected, orders, login, logout, bumpOrder, bumpItem }),
    [ready, session, connected, orders, login, logout, bumpOrder, bumpItem],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKds(): KdsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKds must be used within KdsProvider');
  return ctx;
}
