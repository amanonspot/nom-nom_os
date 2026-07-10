'use client';

import { useState } from 'react';
import type { MenuItem } from '@nomnom/types';
import { useSession } from '@/lib/session';

export function VariantEditor({ item, onChange }: { item: MenuItem; onChange: () => Promise<void> }) {
  const { authFetch } = useSession();
  const [busy, setBusy] = useState(false);
  const groups = item.variation_groups ?? [];

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  const addGroup = () => {
    const name = prompt('Group name (e.g. Size, Protein)');
    if (!name) return;
    void run(() =>
      authFetch('/api/catalog/variation-groups/', {
        method: 'POST',
        body: JSON.stringify({ item: item.id, name }),
      }),
    );
  };

  const addOption = (groupId: string) => {
    const name = prompt('Option name (e.g. 500ml)');
    if (!name) return;
    const delta = prompt('Price delta (₹, can be negative)', '0') ?? '0';
    void run(() =>
      authFetch('/api/catalog/variation-options/', {
        method: 'POST',
        body: JSON.stringify({ group: groupId, name, price_delta: delta }),
      }),
    );
  };

  const delGroup = (id: string) =>
    run(() => authFetch(`/api/catalog/variation-groups/${id}/`, { method: 'DELETE' }));
  const delOption = (id: string) =>
    run(() => authFetch(`/api/catalog/variation-options/${id}/`, { method: 'DELETE' }));

  return (
    <div className="border-t border-spoto-line bg-spoto-bg/40 p-3" aria-busy={busy}>
      {groups.map((g) => (
        <div key={g.id} className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-spoto-ink">{g.name}</span>
            {g.is_required && <span className="text-xs text-danger">required</span>}
            <button onClick={() => addOption(g.id)} className="text-xs text-spoto-purple-ink">+ option</button>
            <button onClick={() => delGroup(g.id)} className="text-xs text-danger">delete group</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => (
              <span key={o.id} className="flex items-center gap-1 rounded-md border border-spoto-line px-2 py-1 text-xs text-spoto-ink">
                {o.name}
                {Number(o.price_delta) !== 0 && ` (${Number(o.price_delta) > 0 ? '+' : ''}₹${Number(o.price_delta)})`}
                <button onClick={() => delOption(o.id)} className="text-danger">×</button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addGroup} className="text-sm text-spoto-purple-ink">+ Variation group</button>
    </div>
  );
}
