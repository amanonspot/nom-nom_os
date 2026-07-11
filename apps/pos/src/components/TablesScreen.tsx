'use client';

import { Button, StatusBadge } from '@nomnom/ui';
import type { Order, Table } from '@nomnom/types';
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

export function TablesScreen({
  onOpenTable,
  onNewOrder,
}: {
  onOpenTable: (t: Table) => void;
  onNewOrder: (t: OrderType) => void;
}) {
  const { tables, activeOrders, now } = usePos();
  const orderByTable = new Map<string, Order>();
  for (const o of activeOrders) if (o.table) orderByTable.set(o.table, o);

  const takeaways = activeOrders.filter((o) => !o.table);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-spoto-ink">Floor</h1>
        <div className="flex gap-2">
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
          return (
            <button
              key={t.id}
              onClick={() => onOpenTable(t)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left ${
                warn
                  ? 'border-warning bg-warning/10'
                  : occupied
                    ? 'border-status-occupied/40 bg-spoto-surface'
                    : 'border-spoto-line bg-spoto-surface'
              }`}
            >
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
