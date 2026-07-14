'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Me } from '@nomnom/types';
import { fetchMe, login as apiLogin, API_URL } from './api';

interface SessionValue {
  ready: boolean;
  token: string | null;
  me: Me | null;
  branchId: string;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const Ctx = createContext<SessionValue | null>(null);
const KEY = 'nomnom.admin.session';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    (async () => {
      if (raw) {
        const t = raw;
        try {
          setMe(await fetchMe(t));
          setToken(t);
        } catch {
          localStorage.removeItem(KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const t = await apiLogin(username, pin);
    setMe(await fetchMe(t));
    localStorage.setItem(KEY, t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setToken(null);
    setMe(null);
  }, []);

  const authFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
      return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    },
    [token],
  );

  const value = useMemo<SessionValue>(
    () => ({ ready, token, me, branchId: me?.branch?.id ?? '', login, logout, authFetch }),
    [ready, token, me, login, logout, authFetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
