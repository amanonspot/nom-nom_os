'use client';

import { Button, Card, StatusBadge } from '@nomnom/ui';
import { CheckCircle2, ChefHat, Clock, Wifi, WifiOff } from 'lucide-react';
import type { Order, OrderItemRead } from '@nomnom/types';
import { useKds } from '@/lib/kds';
import type { KitchenStatus } from '@/lib/api';

const NEXT: Record<KitchenStatus, KitchenStatus | null> = {
  pending: 'cooking',
  cooking: 'ready',
  ready: 'served',
  served: null,
};

const NEXT_LABEL: Record<KitchenStatus, string> = {
  pending: 'Start cooking',
  cooking: 'Mark ready',
  ready: 'Mark served',
  served: '',
};

const COLUMNS: { key: KitchenStatus; label: string; icon: typeof Clock }[] = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'cooking', label: 'Cooking', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle2 },
];

export function Board() {
  const { orders, connected, logout } = useKds();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-spoto-purple-ink">Nom Nom OS</p>
          <h1 className="font-heading text-2xl font-bold text-spoto-ink">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <span className="inline-flex items-center gap-1 text-sm text-success">
              <Wifi className="h-4 w-4" /> live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-warning">
              <WifiOff className="h-4 w-4" /> polling
            </span>
          )}
          <button onClick={logout} className="text-sm text-spoto-muted underline">
            Sign out
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.kitchen_status === col.key);
          const Icon = col.icon;
          return (
            <section key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-spoto-muted">
                <Icon className="h-4 w-4" />
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide">
                  {col.label}
                </h2>
                <span className="ml-auto text-sm">{colOrders.length}</span>
              </div>
              {colOrders.length === 0 && (
                <p className="text-sm text-spoto-muted">No tickets.</p>
              )}
              {colOrders.map((o) => (
                <Ticket key={o.id} order={o} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Human label + tone for the order type, so kitchen staff see table vs takeaway. */
function orderTypeLabel(order: Order): string {
  switch (order.order_type) {
    case 'dine_in':
      return order.table_name ? `Dine-in · ${order.table_name}` : 'Dine-in';
    case 'takeaway':
      return 'Pickup';
    case 'delivery':
      return 'Delivery';
    case 'qr':
      return 'QR';
    default:
      return 'Order';
  }
}

function Ticket({ order }: { order: Order }) {
  const { bumpOrder, bumpItem } = useKds();
  const ks = (order.kitchen_status ?? 'pending') as KitchenStatus;
  const next = NEXT[ks];
  const isTakeaway = order.order_type === 'takeaway' || order.order_type === 'delivery';

  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-heading font-bold text-spoto-ink">
          #{order.number ?? (order.id ?? '').slice(0, 6)}
        </span>
        <StatusBadge tone={ks === 'ready' ? 'success' : ks === 'cooking' ? 'warning' : 'occupied'}>
          {ks}
        </StatusBadge>
      </div>
      <div className="mb-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-heading font-bold uppercase tracking-wide ${
            isTakeaway
              ? 'bg-warning/15 text-warning'
              : 'bg-spoto-purple/15 text-spoto-purple-ink'
          }`}
        >
          {orderTypeLabel(order)}
        </span>
      </div>

      <ul className="mb-3 flex flex-col gap-2">
        {(order.items ?? []).map((item) => (
          <ItemRow key={item.id} item={item} onBump={bumpItem} />
        ))}
      </ul>

      {next && (
        <Button
          className="w-full"
          variant={ks === 'cooking' ? 'cta' : 'default'}
          onClick={() => bumpOrder(order.id!, next)}
        >
          {NEXT_LABEL[ks]}
        </Button>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  onBump,
}: {
  item: OrderItemRead;
  onBump: (id: string, status: KitchenStatus) => void;
}) {
  const ks = (item.kitchen_status ?? 'pending') as KitchenStatus;
  const next = NEXT[ks];
  const opts = [
    ...(item.options ?? []).map((o) => o.name_snapshot),
    ...(item.add_ons ?? []).map((a) => a.name_snapshot),
  ].join(', ');

  return (
    <li className="flex items-start justify-between gap-2 border-b border-spoto-line pb-2 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-spoto-ink">
          {item.quantity}× {item.name_snapshot}
        </p>
        {opts && <p className="truncate text-xs text-spoto-muted">{opts}</p>}
        {item.notes && <p className="truncate text-xs text-spoto-muted">↳ {item.notes}</p>}
      </div>
      {next ? (
        <button
          onClick={() => onBump(item.id!, next)}
          className="shrink-0 rounded-md border border-spoto-line px-2 py-1 text-xs text-spoto-purple-ink hover:bg-spoto-surface-2"
        >
          {ks} →
        </button>
      ) : (
        <span className="shrink-0 text-xs text-success">served</span>
      )}
    </li>
  );
}
