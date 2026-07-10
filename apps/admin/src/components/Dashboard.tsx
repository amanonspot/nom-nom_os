'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session';
import { MenuManager } from './MenuManager';
import { TableManager } from './TableManager';

type Tab = 'menu' | 'tables';

export function Dashboard() {
  const { me, logout } = useSession();
  const [tab, setTab] = useState<Tab>('menu');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-2">Nom Nom OS · Admin</p>
          <h1 className="font-display text-2xl font-bold text-fg">
            {me?.restaurant?.name ?? 'Restaurant'} — {me?.branch?.name ?? ''}
          </h1>
        </div>
        <button onClick={logout} className="text-sm text-muted underline">Sign out</button>
      </header>

      <nav className="mb-6 flex gap-2">
        {(['menu', 'tables'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm capitalize ${
              tab === t ? 'bg-accent text-white' : 'border border-border bg-surface text-fg'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'menu' ? <MenuManager /> : <TableManager />}
    </div>
  );
}
