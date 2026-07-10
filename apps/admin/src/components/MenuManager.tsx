'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, StatusBadge } from '@nomnom/ui';
import type { AddOn, CategoryWithItems, MenuItem } from '@nomnom/types';
import { useSession } from '@/lib/session';
import { ItemForm } from './ItemForm';
import { VariantEditor } from './VariantEditor';

export function MenuManager({ onDataChange }: { onDataChange?: () => void }) {
  const { authFetch, branchId } = useSession();
  const [tree, setTree] = useState<CategoryWithItems[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | 'new' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');

  const reload = useCallback(async () => {
    const [t, a] = await Promise.all([
      authFetch<CategoryWithItems[]>(`/api/catalog/menu/?branch=${branchId}`),
      authFetch<AddOn[]>(`/api/catalog/addons/?branch=${branchId}`),
    ]);
    setTree(t);
    setAddOns(a);
    setActiveCat((c) => c ?? t[0]?.id ?? null);
    onDataChange?.();
  }, [authFetch, branchId, onDataChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const category = tree.find((c) => c.id === activeCat) ?? tree[0];

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    await authFetch('/api/catalog/categories/', {
      method: 'POST',
      body: JSON.stringify({ branch: branchId, name, sort_order: tree.length + 1 }),
    });
    setNewCat('');
    await reload();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Categories */}
      <aside>
        <h2 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-spoto-muted">
          Categories
        </h2>
        <ul className="mb-3 flex flex-col gap-1">
          {tree.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveCat(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  c.id === category?.id ? 'bg-spoto-purple text-white' : 'text-spoto-ink hover:bg-spoto-surface'
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category"
            className="min-h-9 flex-1 py-1 text-sm"
          />
          <Button type="submit" size="sm" disabled={!newCat.trim()}>
            +
          </Button>
        </form>
      </aside>

      {/* Items in category */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-spoto-ink">{category?.name ?? '—'}</h2>
          {category && <Button onClick={() => setEditItem('new')}>+ Item</Button>}
        </div>

        <div className="flex flex-col gap-2">
          {(category?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-xl border border-spoto-line bg-spoto-surface">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.is_veg ? 'bg-veg' : 'bg-nonveg'}`} />
                  <span className="font-medium text-spoto-ink">{item.name}</span>
                  <span className="text-sm text-spoto-muted">₹{Number(item.base_price).toFixed(2)}</span>
                  {!item.is_available && <StatusBadge tone="danger">unavailable</StatusBadge>}
                  <span className="text-xs text-spoto-muted">GST {Number(item.gst_rate)}%</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-spoto-purple-ink">
                    Variants ({item.variation_groups?.length ?? 0})
                  </button>
                  <button onClick={() => setEditItem(item)} className="text-spoto-ink underline">Edit</button>
                </div>
              </div>
              {expanded === item.id && (
                <VariantEditor item={item} onChange={reload} />
              )}
            </div>
          ))}
          {category && (category.items?.length ?? 0) === 0 && (
            <p className="text-sm text-spoto-muted">No items yet.</p>
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
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await authFetch('/api/catalog/addons/', {
      method: 'POST',
      body: JSON.stringify({ branch: branchId, name: name.trim(), price: price || '0' }),
    });
    setName('');
    setPrice('');
    await onChange();
  }

  async function remove(id: string) {
    await authFetch(`/api/catalog/addons/${id}/`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <div className="mt-8">
      <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-spoto-muted">
        Add-ons
      </h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {addOns.map((a) => (
          <span key={a.id} className="flex items-center gap-2 rounded-lg border border-spoto-line bg-spoto-surface px-3 py-1.5 text-sm text-spoto-ink">
            {a.name} · ₹{Number(a.price)}
            <button onClick={() => remove(a.id)} className="text-danger">×</button>
          </span>
        ))}
        {addOns.length === 0 && <p className="text-sm text-spoto-muted">No add-ons.</p>}
      </div>
      <form onSubmit={add} className="flex max-w-md gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add-on name"
          className="min-h-9 flex-1 py-1 text-sm"
        />
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="₹"
          inputMode="decimal"
          className="min-h-9 w-20 py-1 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
