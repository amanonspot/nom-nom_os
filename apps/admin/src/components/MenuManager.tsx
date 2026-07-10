'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, StatusBadge } from '@nomnom/ui';
import type { AddOn, CategoryWithItems, MenuItem } from '@nomnom/types';
import { useSession } from '@/lib/session';
import { ItemForm } from './ItemForm';
import { VariantEditor } from './VariantEditor';

export function MenuManager() {
  const { authFetch, branchId } = useSession();
  const [tree, setTree] = useState<CategoryWithItems[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | 'new' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [t, a] = await Promise.all([
      authFetch<CategoryWithItems[]>(`/api/catalog/menu/?branch=${branchId}`),
      authFetch<AddOn[]>(`/api/catalog/addons/?branch=${branchId}`),
    ]);
    setTree(t);
    setAddOns(a);
    setActiveCat((c) => c ?? t[0]?.id ?? null);
  }, [authFetch, branchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const category = tree.find((c) => c.id === activeCat) ?? tree[0];

  async function addCategory() {
    const name = prompt('Category name');
    if (!name) return;
    await authFetch('/api/catalog/categories/', {
      method: 'POST',
      body: JSON.stringify({ branch: branchId, name, sort_order: tree.length + 1 }),
    });
    await reload();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Categories */}
      <aside>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            Categories
          </h2>
          <button onClick={addCategory} className="text-accent-2">+</button>
        </div>
        <ul className="flex flex-col gap-1">
          {tree.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveCat(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  c.id === category?.id ? 'bg-accent text-white' : 'text-fg hover:bg-surface'
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Items in category */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-fg">{category?.name ?? '—'}</h2>
          {category && <Button onClick={() => setEditItem('new')}>+ Item</Button>}
        </div>

        <div className="flex flex-col gap-2">
          {(category?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.is_veg ? 'bg-veg' : 'bg-nonveg'}`} />
                  <span className="font-medium text-fg">{item.name}</span>
                  <span className="text-sm text-muted">₹{Number(item.base_price).toFixed(2)}</span>
                  {!item.is_available && <StatusBadge tone="danger">unavailable</StatusBadge>}
                  <span className="text-xs text-muted">GST {Number(item.gst_rate)}%</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-accent-2">
                    Variants ({item.variation_groups?.length ?? 0})
                  </button>
                  <button onClick={() => setEditItem(item)} className="text-fg underline">Edit</button>
                </div>
              </div>
              {expanded === item.id && (
                <VariantEditor item={item} onChange={reload} />
              )}
            </div>
          ))}
          {category && (category.items?.length ?? 0) === 0 && (
            <p className="text-sm text-muted">No items yet.</p>
          )}
        </div>

        {/* Add-ons */}
        <AddOnManager addOns={addOns} onChange={reload} />
      </section>

      {editItem && category && (
        <ItemForm
          item={editItem === 'new' ? null : editItem}
          categoryId={category.id}
          onClose={() => setEditItem(null)}
          onSaved={async () => {
            setEditItem(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function AddOnManager({ addOns, onChange }: { addOns: AddOn[]; onChange: () => Promise<void> }) {
  const { authFetch, branchId } = useSession();

  async function add() {
    const name = prompt('Add-on name');
    if (!name) return;
    const price = prompt('Price (₹)', '0') ?? '0';
    await authFetch('/api/catalog/addons/', {
      method: 'POST',
      body: JSON.stringify({ branch: branchId, name, price }),
    });
    await onChange();
  }

  async function remove(id: string) {
    await authFetch(`/api/catalog/addons/${id}/`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Add-ons</h3>
        <button onClick={add} className="text-accent-2">+ Add-on</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {addOns.map((a) => (
          <span key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg">
            {a.name} · ₹{Number(a.price)}
            <button onClick={() => remove(a.id)} className="text-danger">×</button>
          </span>
        ))}
        {addOns.length === 0 && <p className="text-sm text-muted">No add-ons.</p>}
      </div>
    </div>
  );
}
