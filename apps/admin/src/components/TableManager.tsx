'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, StatusBadge } from '@nomnom/ui';
import type { Table } from '@nomnom/types';
import { useSession } from '@/lib/session';

export function TableManager({ onDataChange }: { onDataChange?: () => void }) {
  const { authFetch, branchId } = useSession();
  const [tables, setTables] = useState<Table[]>([]);
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('4');
  const [area, setArea] = useState('Ground Floor');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setTables(await authFetch<Table[]>(`/api/ops/tables/?branch=${branchId}`));
    onDataChange?.();
  }, [authFetch, branchId, onDataChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await authFetch('/api/ops/tables/', {
      method: 'POST',
      body: JSON.stringify({
        branch: branchId,
        name: name.trim(),
        seats: Number(seats) || 4,
        area: area.trim(),
      }),
    });
    setName('');
    await reload();
  }

  async function remove(id: string) {
    await authFetch(`/api/ops/tables/${id}/`, { method: 'DELETE' });
    setConfirmId(null);
    await reload();
  }

  return (
    <div>
      <h2 className="mb-4 font-heading text-lg font-semibold text-spoto-ink">Tables</h2>

      <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          Name
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T7"
            className="min-h-10 w-24 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          Seats
          <Input
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            inputMode="numeric"
            className="min-h-10 w-20 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          Area
          <Input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="min-h-10 w-40 py-1"
          />
        </label>
        <Button type="submit" disabled={!name.trim()}>
          + Table
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {tables.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-2 rounded-xl border border-spoto-line bg-spoto-surface p-4">
            <span className="font-heading text-lg font-semibold text-spoto-ink">{t.name}</span>
            <span className="text-xs text-spoto-muted">{t.seats} seats</span>
            <StatusBadge tone={t.status === 'free' ? 'free' : 'occupied'}>{t.status}</StatusBadge>
            {confirmId === t.id ? (
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => remove(t.id)} className="font-semibold text-danger">
                  confirm
                </button>
                <button onClick={() => setConfirmId(null)} className="text-spoto-muted">
                  cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmId(t.id)} className="text-xs text-danger">
                delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
