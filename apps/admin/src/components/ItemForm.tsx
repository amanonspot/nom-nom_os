'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';
import type { MenuItem } from '@nomnom/types';
import { useSession } from '@/lib/session';

export function ItemForm({
  item,
  categoryId,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  categoryId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { authFetch, branchId } = useSession();
  const [name, setName] = useState(item?.name ?? '');
  const [basePrice, setBasePrice] = useState(item ? String(item.base_price) : '');
  const [isVeg, setIsVeg] = useState(item?.is_veg ?? true);
  const [gstRate, setGstRate] = useState(item ? String(item.gst_rate) : '5');
  const [pieces, setPieces] = useState(item ? String(item.pieces_per_plate) : '1');
  const [available, setAvailable] = useState(item?.is_available ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      branch: branchId,
      category: categoryId,
      name,
      base_price: basePrice || '0',
      is_veg: isVeg,
      gst_rate: gstRate || '0',
      pieces_per_plate: Number(pieces) || 1,
      is_available: available,
    };
    try {
      if (item) {
        await authFetch(`/api/catalog/items/${item.id}/`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await authFetch('/api/catalog/items/', { method: 'POST', body: JSON.stringify(body) });
      }
      await onSaved();
    } catch {
      setError('Could not save item');
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    await authFetch(`/api/catalog/items/${item.id}/`, { method: 'DELETE' });
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl bg-spoto-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-spoto-ink">{item ? 'Edit item' : 'New item'}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-spoto-muted">×</button>
        </div>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base price (₹)">
            <input inputMode="decimal" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required
              className="w-full rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple" />
          </Field>
          <Field label="GST %">
            <input inputMode="decimal" value={gstRate} onChange={(e) => setGstRate(e.target.value)}
              className="w-full rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple" />
          </Field>
          <Field label="Pieces / plate">
            <input inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)}
              className="w-full rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple" />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-spoto-ink">
              <input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} /> Veg
            </label>
            <label className="flex items-center gap-2 text-sm text-spoto-ink">
              <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> Available
            </label>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {item &&
            (confirmDelete ? (
              <>
                <Button type="button" variant="destructive" onClick={remove}>
                  Confirm delete
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-spoto-muted"
                >
                  Cancel
                </button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ))}
          <Button type="submit" className="ml-auto" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 flex flex-col gap-1 text-sm text-spoto-muted">
      {label}
      {children}
    </label>
  );
}
