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
import type { AddOn, CategoryWithItems, Table } from '@nomnom/types';
import { SyncEngine, createHttpTransport } from '@nomnom/sync-client';
import { IdbPersistence } from '@nomnom/persistence-idb';
import {
  API_URL,
  fetchAddOns,
  fetchMe,
  fetchMenu,
  fetchTables,
  login as apiLogin,
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
  engine: SyncEngine | null;
  login: (username: string, password: string) => Promise<void>;
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

  // Wire sync-status updates + connectivity + periodic flush.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const unsub = engine.subscribe(setSync);
    const onOnline = () => void engine.flush();
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => void engine.flush(), 8000);
    void engine.flush();
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [ready]);

  const login = useCallback(
    async (username: string, password: string) => {
      const token = await apiLogin(username, password);
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
      engine: engineRef.current,
      login,
      logout,
      setTableStatus,
    }),
    [ready, session, menu, tables, addOns, sync, login, logout, setTableStatus],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
