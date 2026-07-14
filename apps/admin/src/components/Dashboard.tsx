'use client';

import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, ListTree, UtensilsCrossed } from 'lucide-react';
import { StatCard } from '@nomnom/ui';
import type { CategoryWithItems, Table } from '@nomnom/types';
import { useSession } from '@/lib/session';
import { AppShell, type Tab } from './AppShell';
import { MenuManager } from './MenuManager';
import { TableManager } from './TableManager';
import { UserManager } from './UserManager';

const TITLES: Record<Tab, string> = { menu: 'Menu', tables: 'Tables', access: 'Access' };

export function Dashboard() {
  const { me, logout, authFetch, branchId } = useSession();
  const [tab, setTab] = useState<Tab>('menu');
  const [stats, setStats] = useState({ categories: 0, items: 0, tables: 0 });

  const loadStats = useCallback(async () => {
    if (!branchId) return;
    const [tree, tables] = await Promise.all([
      authFetch<CategoryWithItems[]>(`/api/catalog/menu/?branch=${branchId}`),
      authFetch<Table[]>(`/api/ops/tables/?branch=${branchId}`),
    ]);
    const items = tree.reduce((n, c) => n + (c.items?.length ?? 0), 0);
    setStats({ categories: tree.length, items, tables: tables.length });
  }, [authFetch, branchId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, tab]);

  return (
    <AppShell tab={tab} setTab={setTab} me={me} onLogout={logout}>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-spoto-purple-ink">
          {me?.restaurant?.name ?? 'Restaurant'} · {me?.branch?.name ?? ''}
        </p>
        <h1 className="font-heading text-2xl font-bold text-spoto-ink">{TITLES[tab]}</h1>
      </div>

      {tab !== 'access' && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <StatCard label="Categories" value={stats.categories} icon={ListTree} accent="purple" />
          <StatCard label="Menu items" value={stats.items} icon={UtensilsCrossed} accent="green" />
          <StatCard label="Tables" value={stats.tables} icon={LayoutGrid} accent="amber" />
        </div>
      )}

      {tab === 'menu' && <MenuManager onDataChange={loadStats} />}
      {tab === 'tables' && <TableManager onDataChange={loadStats} />}
      {tab === 'access' && <UserManager />}
    </AppShell>
  );
}
