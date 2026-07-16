'use client';

import { useState } from 'react';
import { Button, StatusBadge } from '@nomnom/ui';
import type { Table } from '@nomnom/types';
import { usePos } from '@/lib/pos';

/** Assign or change the table for the current order. */
export function TablePicker({
  tables,
  currentTableId,
  onPick,
  onClose,
}: {
  tables: Table[];
  currentTableId: string | null;
  onPick: (table: Table) => void;
  onClose: () => void;
}) {
  const { createTable } = usePos();
  const [newTable, setNewTable] = useState('');
  const [adding, setAdding] = useState(false);

  async function addAndPick(e: React.FormEvent) {
    e.preventDefault();
    const name = newTable.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const t = await createTable(name);
      setNewTable('');
      if (t) onPick(t); // instant table → assign it straight away
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-spoto-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-spoto-ink">
            {currentTableId ? 'Change table' : 'Assign table'}
          </h2>
          <button onClick={onClose} className="text-2xl leading-none text-spoto-muted">
            ×
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {tables.map((t) => {
            const isCurrent = t.id === currentTableId;
            return (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${
                  isCurrent ? 'border-spoto-purple bg-spoto-purple/10' : 'border-spoto-line bg-spoto-bg'
                }`}
              >
                <span className="font-heading text-lg font-semibold text-spoto-ink">{t.name}</span>
                <StatusBadge tone={t.status === 'free' ? 'free' : 'occupied'}>{t.status}</StatusBadge>
              </button>
            );
          })}
        </div>

        {/* Instant table: create + assign in one step. */}
        <form onSubmit={addAndPick} className="mt-4 flex items-center gap-2 border-t border-spoto-line pt-4">
          <input
            value={newTable}
            onChange={(e) => setNewTable(e.target.value)}
            placeholder="New table no."
            className="min-h-10 flex-1 rounded-lg border border-spoto-line bg-spoto-bg px-3 py-1.5 text-sm text-spoto-ink outline-none focus:border-spoto-purple"
          />
          <Button type="submit" variant="secondary" disabled={!newTable.trim() || adding}>
            + Add & assign
          </Button>
        </form>
      </div>
    </div>
  );
}
