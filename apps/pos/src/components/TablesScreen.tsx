'use client';

import { useState } from 'react';
import { Button, StatusBadge } from '@nomnom/ui';
import { ChevronDown } from 'lucide-react';
import type { Order, OrderItemRead, Table } from '@nomnom/types';
import type { OrderType } from '@nomnom/sync-client';
import { usePos } from '@/lib/pos';

const PENDING_WARN_MS = 10 * 60 * 1000; // amber if a ticket sits > 10 min

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const ITEM_TONE: Record<string, 'occupied' | 'warning' | 'success'> = {
  pending: 'occupied',
  cooking: 'warning',
  ready: 'success',
  served: 'success',
};

export function TablesScreen({
  onOpenTable,
  onNewOrder,
}: {
  onOpenTable: (t: Table) => void;
  onNewOrder: (t: OrderType) => void;
}) {
  const { tables, activeOrders, now, createTable } = usePos();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newTable, setNewTable] = useState('');
  const [adding, setAdding] = useState(false);

  const orderByTable = new Map<string, Order>();
  for (const o of activeOrders) if (o.table) orderByTable.set(o.table, o);

  const takeaways = activeOrders.filter((o) => !o.table);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    const name = newTable.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      await createTable(name);
      setNewTable('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-spoto-ink">Floor</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Instant table: create a table with a custom number, ready at once. */}
          <form onSubmit={addTable} className="flex items-center gap-1">
            <input
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              placeholder="Table no."
              className="w-24 rounded-lg border border-spoto-line bg-spoto-surface px-2 py-1.5 text-sm text-spoto-ink outline-none focus:border-spoto-purple"
            />
            <Button type="submit" variant="secondary" disabled={!newTable.trim() || adding}>
              + Table
            </Button>
          </form>
          <Button variant="ghost" onClick={() => onNewOrder('takeaway')}>
            + Pick Up
          </Button>
          <Button variant="ghost" onClick={() => onNewOrder('delivery')}>
            + Delivery
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tables.map((t) => {
          const order = orderByTable.get(t.id);
          const occupied = t.status !== 'free' || !!order;
          const elapsed = order?.created_at ? now - new Date(order.created_at).getTime() : 0;
          const ks = order?.kitchen_status ?? 'pending';
          const warn = occupied && ks !== 'ready' && elapsed > PENDING_WARN_MS;
          const isOpen = expanded.has(t.id);
          const items: OrderItemRead[] = order?.items ?? [];
          return (
            <div
              key={t.id}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${
                warn
                  ? 'border-warning bg-warning/10'
                  : occupied
                    ? 'border-status-occupied/40 bg-spoto-surface'
                    : 'border-spoto-line bg-spoto-surface'
              }`}
            >
              <button onClick={() => onOpenTable(t)} className="flex flex-col items-start gap-2 text-left">
                <div className="flex w-full items-center justify-between">
                  <span className="font-heading text-lg font-semibold text-spoto-ink">{t.name}</span>
                  <StatusBadge tone={occupied ? (warn ? 'warning' : 'occupied') : 'free'}>
                    {occupied ? ks : 'free'}
                  </StatusBadge>
                </div>
                {order ? (
                  <>
                    <span className="font-heading text-sm font-bold text-spoto-ink tabular-nums">
                      ⏱ {fmtElapsed(elapsed)}
                    </span>
                    <span className="text-xs text-spoto-muted">
                      Bill #{order.number ?? '—'} · ₹{Number(order.grand_total).toFixed(0)}
                      {warn ? ' · waiting!' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-spoto-muted">{t.seats} seats · tap to seat</span>
                )}
              </button>

              {/* Collapsible per-item KDS status for the active order. */}
              {order && items.length > 0 && (
                <>
                  <button
                    onClick={() => toggle(t.id)}
                    className="flex items-center gap-1 text-xs font-medium text-spoto-purple-ink"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                    {isOpen ? 'Hide' : `${items.length} item${items.length > 1 ? 's' : ''}`}
                  </button>
                  {isOpen && (
                    <ul className="flex flex-col gap-1 border-t border-spoto-line pt-2">
                      {items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-spoto-ink">
                            {it.quantity}× {it.name_snapshot}
                          </span>
                          <StatusBadge tone={ITEM_TONE[it.kitchen_status ?? 'pending'] ?? 'occupied'}>
                            {it.kitchen_status ?? 'pending'}
                          </StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {takeaways.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-spoto-muted">
            Pick Up / Delivery
          </h2>
          <div className="flex flex-wrap gap-2">
            {takeaways.map((o) => {
              const elapsed = o.created_at ? now - new Date(o.created_at).getTime() : 0;
              return (
                <span
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg border border-spoto-line bg-spoto-surface px-3 py-2 text-sm text-spoto-ink"
                >
                  <span className="capitalize">{o.order_type}</span> #{o.number ?? '—'}
                  <span className="font-heading font-bold tabular-nums">⏱ {fmtElapsed(elapsed)}</span>
                  <StatusBadge tone={o.kitchen_status === 'ready' ? 'success' : 'occupied'}>
                    {o.kitchen_status}
                  </StatusBadge>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
