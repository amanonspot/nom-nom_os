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
import type { AddOn, CategoryWithItems, Order, Table } from '@nomnom/types';
import { SyncEngine, createHttpTransport } from '@nomnom/sync-client';
import { IdbPersistence } from '@nomnom/persistence-idb';
import {
  API_URL,
  fetchActiveOrders,
  fetchAddOns,
  fetchMe,
  fetchMenu,
  fetchTables,
  login as apiLogin,
  wsUrl,
} from './api';

interface Session {
  token: string;
  branchId: string;
  name: string;
}

interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
}

interface PosContextValue {
  ready: boolean;
  session: Session | null;
  menu: CategoryWithItems[];
  tables: Table[];
  addOns: AddOn[];
  sync: SyncStatus;
  notice: string | null;
  engine: SyncEngine | null;
  /** Active (unpaid, in-kitchen) orders — drives the Tables screen timers. */
  activeOrders: Order[];
  refreshActiveOrders: () => Promise<void>;
  /** Ticking clock (ms) so elapsed timers re-render each second. */
  now: number;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  setTableStatus: (tableId: string, status: 'free' | 'occupied') => void;
}

const PosContext = createContext<PosContextValue | null>(null);

const SESSION_KEY = 'nomnom.pos.session';

export function PosProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [menu, setMenu] = useState<CategoryWithItems[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [sync, setSync] = useState<SyncStatus>({
    online: true,
    pending: 0,
    syncing: false,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const persistenceRef = useRef<IdbPersistence | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Create persistence + engine once, in the browser.
  if (!persistenceRef.current && typeof window !== 'undefined') {
    const persistence = new IdbPersistence();
    persistenceRef.current = persistence;
    engineRef.current = new SyncEngine(
      persistence,
      createHttpTransport({ apiUrl: API_URL, getToken: () => tokenRef.current }),
    );
  }

  const loadData = useCallback(async (s: Session) => {
    const persistence = persistenceRef.current!;
    try {
      // Online path: fetch fresh and refresh the offline cache.
      const [m, t, a] = await Promise.all([
        fetchMenu(s.token, s.branchId),
        fetchTables(s.token, s.branchId),
        fetchAddOns(s.token, s.branchId),
      ]);
      setMenu(m);
      setTables(t);
      setAddOns(a);
      await persistence.saveMenu(s.branchId, m);
      await persistence.saveTables(s.branchId, t);
      await persistence.saveAddOns(s.branchId, a);
    } catch {
      // Offline path: serve last-known snapshot.
      const m = (await persistence.getMenu(s.branchId)) as CategoryWithItems[] | null;
      const t = (await persistence.getTables(s.branchId)) as Table[] | null;
      const a = (await persistence.getAddOns(s.branchId)) as AddOn[] | null;
      if (m) setMenu(m);
      if (t) setTables(t);
      if (a) setAddOns(a);
    }
  }, []);

  // Restore session on mount.
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
    (async () => {
      if (raw) {
        const s = JSON.parse(raw) as Session;
        tokenRef.current = s.token;
        setSession(s);
        await loadData(s);
      }
      setReady(true);
    })();
  }, [loadData]);

  // Wire sync-status updates + connectivity + periodic flush + delta pull.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const unsub = engine.subscribe(setSync);
    const branchId = session?.branchId;
    const tick = () => {
      void engine.flush();
      if (branchId) void engine.pull(branchId);
    };
    const onOnline = () => tick();
    window.addEventListener('online', onOnline);
    const interval = setInterval(tick, 8000);
    tick();
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [ready, session]);

  // Live "order ready" notifications from the kitchen (same branch WS group),
  // with auto-reconnect so a server restart or dropped socket self-heals.
  useEffect(() => {
    if (!session?.branchId || !session.token) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(wsUrl(session.branchId, session.token));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            event: string;
            order: { kitchen_status?: string; number?: number };
          };
          if (msg.event === 'order.kitchen' && msg.order?.kitchen_status === 'ready') {
            const label = msg.order.number ? `Order ${msg.order.number}` : 'An order';
            setNotice(`${label} is ready`);
            window.setTimeout(() => setNotice(null), 5000);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [session]);

  // Refresh active orders (Tables screen timers) + a 1s ticking clock.
  const refreshActiveOrders = useCallback(async () => {
    if (!session?.branchId) return;
    try {
      setActiveOrders(await fetchActiveOrders(session.token, session.branchId));
    } catch {
      /* offline — keep last snapshot */
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void refreshActiveOrders();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void refreshActiveOrders(), 5000);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [session, refreshActiveOrders]);

  const login = useCallback(
    async (username: string, pin: string) => {
      const token = await apiLogin(username, pin);
      const me = await fetchMe(token);
      const branchId = me.branch?.id ?? '';
      const s: Session = { token, branchId, name: me.first_name || me.username };
      tokenRef.current = token;
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      await loadData(s);
    },
    [loadData],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    tokenRef.current = null;
    setSession(null);
    setMenu([]);
    setTables([]);
  }, []);

  const setTableStatus = useCallback(
    (tableId: string, status: 'free' | 'occupied') => {
      setTables((prev) => {
        const next = prev.map((t) => (t.id === tableId ? { ...t, status } : t));
        if (session) void persistenceRef.current?.saveTables(session.branchId, next);
        return next;
      });
    },
    [session],
  );

  const value = useMemo<PosContextValue>(
    () => ({
      ready,
      session,
      menu,
      tables,
      addOns,
      sync,
      notice,
      engine: engineRef.current,
      activeOrders,
      refreshActiveOrders,
      now,
      login,
      logout,
      setTableStatus,
    }),
    [
      ready,
      session,
      menu,
      tables,
      addOns,
      sync,
      notice,
      activeOrders,
      refreshActiveOrders,
      now,
      login,
      logout,
      setTableStatus,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
