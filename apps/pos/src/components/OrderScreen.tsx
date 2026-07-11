'use client';

import { useMemo, useState } from 'react';
import { Button } from '@nomnom/ui';
import { LayoutGrid, Users, UtensilsCrossed } from 'lucide-react';
import type { CategoryWithItems, MenuItem } from '@nomnom/types';
import type { LocalOrder, OrderType } from '@nomnom/sync-client';
import { removeLine, setLineQuantity, toggleLineComp } from '@/lib/cart';
import type { CompTarget } from './CompDialog';

const ORDER_TABS: { type: OrderType; label: string }[] = [
  { type: 'dine_in', label: 'Dine In' },
  { type: 'delivery', label: 'Delivery' },
  { type: 'takeaway', label: 'Pick Up' },
];

export function OrderScreen({
  draft,
  menu,
  tableName,
  onPickItem,
  onMutate,
  onOrderType,
  onOpenTablePicker,
  onOpenGuest,
  onOpenCovers,
  onComp,
  onSave,
  onKot,
  onPay,
  onVoid,
}: {
  draft: LocalOrder;
  menu: CategoryWithItems[];
  tableName?: string;
  onPickItem: (item: MenuItem) => void;
  onMutate: (o: LocalOrder) => void;
  onOrderType: (t: OrderType) => void;
  onOpenTablePicker: () => void;
  onOpenGuest: () => void;
  onOpenCovers: () => void;
  onComp: (t: CompTarget) => void;
  onSave: () => void;
  onKot: () => void;
  onPay: () => void;
  onVoid: () => void;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(menu[0]?.id ?? null);
  const [search, setSearch] = useState('');

  const allItems = useMemo(() => menu.flatMap((c) => c.items ?? []), [menu]);
  const items: MenuItem[] = search.trim()
    ? allItems.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : (menu.find((c) => c.id === activeCat)?.items ?? menu[0]?.items ?? []);

  const empty = draft.lines.length === 0;

  return (
    <div className="grid h-[calc(100vh-49px)] grid-cols-1 md:grid-cols-[1fr_380px]">
      {/* Left: search + category rail + item grid */}
      <div className="flex min-h-0 flex-col border-r border-spoto-line">
        <div className="border-b border-spoto-line p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item"
            className="w-full rounded-lg border border-spoto-line bg-spoto-surface px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple"
          />
        </div>
        <div className="flex min-h-0 flex-1">
          {/* Category rail */}
          <nav className="w-36 shrink-0 overflow-y-auto border-r border-spoto-line bg-spoto-surface">
            {menu.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  setSearch('');
                }}
                className={`w-full border-l-4 px-3 py-3 text-left text-sm font-medium ${
                  c.id === activeCat && !search
                    ? 'border-spoto-purple bg-spoto-purple/10 text-spoto-purple-ink'
                    : 'border-transparent text-spoto-ink hover:bg-spoto-surface-2'
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>
          {/* Item grid */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPickItem(item)}
                  className="flex min-h-20 flex-col items-start justify-between gap-1 rounded-xl border border-spoto-line bg-spoto-surface p-3 text-left hover:border-spoto-purple/50"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${item.is_veg ? 'bg-veg' : 'bg-nonveg'}`} />
                  <span className="text-sm font-medium leading-tight text-spoto-ink">{item.name}</span>
                  <span className="text-xs text-spoto-muted">₹{Number(item.base_price).toFixed(2)}</span>
                </button>
              ))}
              {items.length === 0 && <p className="text-sm text-spoto-muted">No items.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Right: order panel */}
      <aside className="flex min-h-0 flex-col bg-spoto-surface">
        {/* Order-type tabs */}
        <div className="grid grid-cols-3 border-b border-spoto-line">
          {ORDER_TABS.map((t) => (
            <button
              key={t.type}
              onClick={() => onOrderType(t.type)}
              className={`py-3 text-sm font-heading font-semibold ${
                draft.orderType === t.type
                  ? 'bg-spoto-purple text-white'
                  : 'bg-spoto-surface text-spoto-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Action row: table / guest / covers / bill no */}
        <div className="flex items-center gap-2 border-b border-spoto-line px-3 py-2">
          {draft.orderType === 'dine_in' && (
            <IconChip icon={LayoutGrid} label={tableName ? `T ${tableName}` : 'Table'} onClick={onOpenTablePicker} />
          )}
          <IconChip icon={UtensilsCrossed} label={draft.customerName || draft.customerPhone || 'Guest'} onClick={onOpenGuest} />
          <IconChip icon={Users} label={`${draft.covers}`} onClick={onOpenCovers} />
          <span className="ml-auto text-right text-xs text-spoto-muted">
            Bill No
            <br />
            <span className="font-heading text-sm font-bold text-spoto-ink">{draft.number ?? '—'}</span>
          </span>
        </div>

        {/* Items */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {empty && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-spoto-muted">
              <span className="text-4xl">🍽️</span>
              <p className="text-sm">No item selected</p>
              <p className="text-xs">Tap items from the menu</p>
            </div>
          )}
          {draft.lines.map((l) => {
            const opts = [...l.optionLabels, ...l.addOnLabels].join(', ');
            return (
              <div key={l.id} className="mb-2 flex items-start justify-between gap-2 border-b border-spoto-line pb-2">
                <div className="min-w-0">
                  <p className={`truncate font-medium text-spoto-ink ${l.isComplimentary ? 'line-through' : ''}`}>
                    {l.nameSnapshot}
                  </p>
                  {opts && <p className="truncate text-xs text-spoto-muted">{opts}</p>}
                  <div className="mt-1 flex items-center gap-2">
                    <button onClick={() => onMutate(setLineQuantity(draft, l.id, l.quantity - 1))} className="h-6 w-6 rounded border border-spoto-line text-spoto-ink">−</button>
                    <span className="w-5 text-center text-sm text-spoto-ink">{l.quantity}</span>
                    <button onClick={() => onMutate(setLineQuantity(draft, l.id, l.quantity + 1))} className="h-6 w-6 rounded border border-spoto-line text-spoto-ink">+</button>
                    <button
                      onClick={() =>
                        l.isComplimentary
                          ? onMutate(toggleLineComp(draft, l.id))
                          : onComp({ scope: 'item', lineId: l.id, lineName: l.nameSnapshot })
                      }
                      className={`ml-1 text-xs ${l.isComplimentary ? 'text-success' : 'text-spoto-purple-ink'}`}
                    >
                      {l.isComplimentary ? 'comped' : 'comp'}
                    </button>
                    <button onClick={() => onMutate(removeLine(draft, l.id))} className="text-xs text-danger">remove</button>
                  </div>
                </div>
                <span className={`whitespace-nowrap font-medium ${l.isComplimentary ? 'text-success' : 'text-spoto-ink'}`}>
                  {l.isComplimentary ? '₹0.00' : `₹${(l.unitPrice * l.quantity).toFixed(2)}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Totals + payment + actions */}
        <div className="border-t border-spoto-line p-3">
          <label className="mb-2 flex items-center gap-2 text-sm text-spoto-ink">
            <input
              type="checkbox"
              checked={draft.isComplimentary}
              onChange={() => onComp({ scope: 'bill' })}
            />
            Complimentary (whole bill)
          </label>
          <dl className="mb-3 space-y-1 text-sm">
            <Row label="Subtotal" value={draft.subtotal} />
            <Row label="GST" value={draft.taxTotal} />
            <Row label="Total" value={draft.grandTotal} bold />
          </dl>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" disabled={empty} onClick={onSave}>
              Save
            </Button>
            <Button variant="secondary" disabled={empty} onClick={onKot}>
              KOT
            </Button>
            <Button variant="cta" disabled={empty} onClick={onPay}>
              Bill &amp; Pay
            </Button>
          </div>
          <button onClick={onVoid} className="mt-2 w-full text-center text-xs text-danger">
            Void order
          </button>
        </div>
      </aside>
    </div>
  );
}

function IconChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-spoto-line bg-spoto-bg px-2.5 py-1.5 text-xs font-medium text-spoto-ink"
    >
      <Icon className="h-4 w-4 text-spoto-purple-ink" />
      <span className="max-w-20 truncate">{label}</span>
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-spoto-ink' : 'text-spoto-muted'}`}>
      <dt>{label}</dt>
      <dd>₹{value.toFixed(2)}</dd>
    </div>
  );
}
