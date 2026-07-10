'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, StatusBadge } from '@nomnom/ui';
import type { Table } from '@nomnom/types';
import { useSession } from '@/lib/session';

export function TableManager() {
  const { authFetch, branchId } = useSession();
  const [tables, setTables] = useState<Table[]>([]);

  const reload = useCallback(async () => {
    setTables(await authFetch<Table[]>(`/api/ops/tables/?branch=${branchId}`));
  }, [authFetch, branchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add() {
    const name = prompt('Table name (e.g. T7)');
    if (!name) return;
    const seats = Number(prompt('Seats', '4') ?? '4') || 4;
    const area = prompt('Area', 'Ground Floor') ?? '';
    await authFetch('/api/ops/tables/', {
      method: 'POST',
      body: JSON.stringify({ branch: branchId, name, seats, area }),
    });
    await reload();
  }

  async function remove(id: string) {
    if (!confirm('Delete table?')) return;
    await authFetch(`/api/ops/tables/${id}/`, { method: 'DELETE' });
    await reload();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-fg">Tables</h2>
        <Button onClick={add}>+ Table</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {tables.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4">
            <span className="font-display text-lg font-semibold text-fg">{t.name}</span>
            <span className="text-xs text-muted">{t.seats} seats</span>
            <StatusBadge tone={t.status === 'free' ? 'free' : 'occupied'}>{t.status}</StatusBadge>
            <button onClick={() => remove(t.id)} className="text-xs text-danger">delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
