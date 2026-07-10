'use client';

import { useMemo, useState } from 'react';
import { Button } from '@nomnom/ui';
import type { AddOn, MenuItem, VariationOption } from '@nomnom/types';
import { buildLine } from '@/lib/cart';
import type { LocalOrderLine } from '@nomnom/sync-client';

export function ItemDialog({
  item,
  addOns,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  addOns: AddOn[];
  onAdd: (line: LocalOrderLine) => void;
  onClose: () => void;
}) {
  const groups = item.variation_groups ?? [];

  // Default selection: each group's default option (or its first).
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      const def = g.options.find((o) => o.is_default) ?? g.options[0];
      if (def) init[g.id] = def.id;
    }
    return init;
  });
  const [chosenAddOns, setChosenAddOns] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const optionObjs = useMemo<VariationOption[]>(() => {
    const out: VariationOption[] = [];
    for (const g of groups) {
      const opt = g.options.find((o) => o.id === selected[g.id]);
      if (opt) out.push(opt);
    }
    return out;
  }, [groups, selected]);

  const addOnObjs = addOns.filter((a) => chosenAddOns.has(a.id));

  const preview = buildLine(item, optionObjs, addOnObjs, quantity, notes);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-fg">{item.name}</h2>
            <p className="text-sm text-muted">Base ₹{Number(item.base_price).toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {groups.map((g) => (
            <fieldset key={g.id} className="mb-4">
              <legend className="mb-2 text-sm font-medium text-muted">
                {g.name}
                {g.is_required && <span className="text-danger"> *</span>}
              </legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const active = selected[g.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelected((s) => ({ ...s, [g.id]: o.id }))}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        active
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-bg text-fg'
                      }`}
                    >
                      {o.name}
                      {Number(o.price_delta) !== 0 &&
                        ` (${Number(o.price_delta) > 0 ? '+' : ''}₹${Number(o.price_delta)})`}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {addOns.length > 0 && (
            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-medium text-muted">Add-ons</legend>
              <div className="flex flex-wrap gap-2">
                {addOns.map((a) => {
                  const active = chosenAddOns.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() =>
                        setChosenAddOns((prev) => {
                          const next = new Set(prev);
                          next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                          return next;
                        })
                      }
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        active ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-fg'
                      }`}
                    >
                      {a.name} (+₹{Number(a.price)})
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="mb-4 flex flex-col gap-1 text-sm text-muted">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. extra spicy"
              className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
            />
          </label>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">Qty</span>
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-9 w-9 rounded-lg border border-border text-fg"
            >
              −
            </button>
            <span className="w-6 text-center font-medium text-fg">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-9 w-9 rounded-lg border border-border text-fg"
            >
              +
            </button>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <Button className="w-full" onClick={() => onAdd(preview)}>
            Add · ₹{(preview.unitPrice * preview.quantity).toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}
