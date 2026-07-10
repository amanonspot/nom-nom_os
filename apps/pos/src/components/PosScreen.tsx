'use client';

import { useState } from 'react';
import { Button, StatusBadge } from '@nomnom/ui';
import type { MenuItem, Table } from '@nomnom/types';
import type { LocalOrder, LocalOrderLine } from '@nomnom/sync-client';
import { usePos } from '@/lib/pos';
import { addLine, newOrder, removeLine, setLineQuantity } from '@/lib/cart';
import { printKOT, printReceipt } from '@/lib/print';
import { ItemDialog } from './ItemDialog';
import { PaymentDialog, type PaymentSplit } from './PaymentDialog';
import { PinDialog } from './PinDialog';
import { SyncStatus } from './SyncStatus';

export function PosScreen() {
  const { session, menu, tables, addOns, engine, logout, setTableStatus } = usePos();
  const [draft, setDraft] = useState<LocalOrder | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showVoid, setShowVoid] = useState(false);

  const branchId = session?.branchId ?? '';

  function startOrder(t: Table | null) {
    setTable(t);
    setDraft(newOrder(branchId, t?.id ?? null, t ? 'dine_in' : 'takeaway'));
    setActiveCat(menu[0]?.id ?? null);
    if (t) setTableStatus(t.id, 'occupied');
  }

  function backToFloor(freeTable: boolean) {
    if (freeTable && table) setTableStatus(table.id, 'free');
    setDraft(null);
    setTable(null);
    setShowVoid(false);
  }

  function onPickItem(item: MenuItem) {
    if ((item.variation_groups?.length ?? 0) > 0 || addOns.length > 0) {
      setDialogItem(item);
    } else if (draft) {
      setDraft(addLine(draft, buildQuickLine(item)));
    }
  }

  function buildQuickLine(item: MenuItem): LocalOrderLine {
    return {
      id: crypto.randomUUID(),
      menuItemId: item.id,
      nameSnapshot: item.name,
      quantity: 1,
      unitPrice: Number(item.base_price),
      gstRate: Number(item.gst_rate),
      notes: '',
      optionIds: [],
      addOnIds: [],
      optionLabels: [],
      addOnLabels: [],
    };
  }

  async function finalizeAndPay(splits: PaymentSplit[]) {
    if (!draft || !engine) return;
    const paidOrder: LocalOrder = { ...draft, status: 'paid', payments: splits };
    await engine.enqueueOrder(paidOrder);
    printReceipt(paidOrder, table?.name);
    setShowPayment(false);
    backToFloor(true);
  }

  function voidOrder(_pin: string) {
    // Draft is not yet persisted; discarding frees the table locally.
    backToFloor(true);
  }

  // --- Floor view ---
  if (!draft) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Header name={session?.name} onLogout={logout} />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-fg">Floor</h2>
          <Button variant="ghost" onClick={() => startOrder(null)}>
            + Takeaway
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => startOrder(t)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <span className="font-display text-lg font-semibold text-fg">{t.name}</span>
              <StatusBadge tone={t.status === 'free' ? 'free' : 'occupied'}>
                {t.status}
              </StatusBadge>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Ordering view ---
  const activeCategory = menu.find((c) => c.id === activeCat) ?? menu[0];
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4">
      <Header
        name={session?.name}
        onLogout={logout}
        title={table ? `Table ${table.name}` : 'Takeaway'}
        onBack={() => backToFloor(true)}
      />
      <div className="grid flex-1 gap-4 md:grid-cols-[1fr_360px]">
        {/* Menu */}
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {menu.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  c.id === activeCategory?.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-border bg-surface text-fg'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(activeCategory?.items ?? []).map((item) => (
              <button
                key={item.id}
                onClick={() => onPickItem(item)}
                className="flex flex-col items-start gap-1 rounded-xl border border-border bg-surface p-3 text-left"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${item.is_veg ? 'bg-veg' : 'bg-nonveg'}`}
                />
                <span className="font-medium text-fg">{item.name}</span>
                <span className="text-sm text-muted">₹{Number(item.base_price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <Cart
          order={draft}
          onQty={(id, q) => setDraft(setLineQuantity(draft, id, q))}
          onRemove={(id) => setDraft(removeLine(draft, id))}
          onKot={() => printKOT(draft, table?.name)}
          onPay={() => setShowPayment(true)}
          onVoid={() => setShowVoid(true)}
        />
      </div>

      {dialogItem && (
        <ItemDialog
          item={dialogItem}
          addOns={addOns}
          onClose={() => setDialogItem(null)}
          onAdd={(line) => {
            setDraft((d) => (d ? addLine(d, line) : d));
            setDialogItem(null);
          }}
        />
      )}
      {showPayment && (
        <PaymentDialog
          total={draft.grandTotal}
          onConfirm={finalizeAndPay}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showVoid && (
        <PinDialog title="Void order — manager PIN" onConfirm={voidOrder} onClose={() => setShowVoid(false)} />
      )}
    </div>
  );
}

function Header({
  name,
  onLogout,
  title,
  onBack,
}: {
  name?: string;
  onLogout: () => void;
  title?: string;
  onBack?: () => void;
}) {
  return (
    <header className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="rounded-lg border border-border px-2 py-1 text-fg">
            ←
          </button>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Nom Nom POS</p>
          <h1 className="font-display text-xl font-bold text-fg">{title ?? `Hi, ${name}`}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SyncStatus />
        <button onClick={onLogout} className="text-sm text-muted underline">
          Sign out
        </button>
      </div>
    </header>
  );
}

function Cart({
  order,
  onQty,
  onRemove,
  onKot,
  onPay,
  onVoid,
}: {
  order: LocalOrder;
  onQty: (id: string, q: number) => void;
  onRemove: (id: string) => void;
  onKot: () => void;
  onPay: () => void;
  onVoid: () => void;
}) {
  const empty = order.lines.length === 0;
  return (
    <aside className="flex flex-col rounded-2xl border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold text-fg">Order</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {empty && <p className="text-sm text-muted">Tap items to add them.</p>}
        {order.lines.map((l) => (
          <div key={l.id} className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{l.nameSnapshot}</p>
              {(l.optionLabels.length > 0 || l.addOnLabels.length > 0) && (
                <p className="truncate text-xs text-muted">
                  {[...l.optionLabels, ...l.addOnLabels].join(', ')}
                </p>
              )}
              {l.notes && <p className="truncate text-xs text-muted">↳ {l.notes}</p>}
              <div className="mt-1 flex items-center gap-2">
                <button onClick={() => onQty(l.id, l.quantity - 1)} className="h-6 w-6 rounded border border-border text-fg">−</button>
                <span className="w-5 text-center text-sm text-fg">{l.quantity}</span>
                <button onClick={() => onQty(l.id, l.quantity + 1)} className="h-6 w-6 rounded border border-border text-fg">+</button>
                <button onClick={() => onRemove(l.id)} className="ml-1 text-xs text-danger">remove</button>
              </div>
            </div>
            <span className="whitespace-nowrap font-medium text-fg">
              ₹{(l.unitPrice * l.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-4">
        <dl className="mb-3 space-y-1 text-sm">
          <Row label="Subtotal" value={order.subtotal} />
          <Row label="GST" value={order.taxTotal} />
          <Row label="Total" value={order.grandTotal} bold />
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={empty} onClick={onKot}>
            Print KOT
          </Button>
          <Button disabled={empty} onClick={onPay}>
            Bill &amp; Pay
          </Button>
        </div>
        <button onClick={onVoid} className="mt-2 w-full text-center text-xs text-danger">
          Void order
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-fg' : 'text-muted'}`}>
      <dt>{label}</dt>
      <dd>₹{value.toFixed(2)}</dd>
    </div>
  );
}
