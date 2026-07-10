'use client';

import { useState } from 'react';
import { Button, Input } from '@nomnom/ui';
import type { MenuItem } from '@nomnom/types';
import { useSession } from '@/lib/session';

export function VariantEditor({ item, onChange }: { item: MenuItem; onChange: () => Promise<void> }) {
  const { authFetch } = useSession();
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; delta: string }>>(
    {},
  );
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

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    await run(() =>
      authFetch('/api/catalog/variation-groups/', {
        method: 'POST',
        body: JSON.stringify({ item: item.id, name }),
      }),
    );
    setGroupName('');
  }

  async function addOption(groupId: string) {
    const draft = optionDrafts[groupId];
    const name = draft?.name.trim();
    if (!name) return;
    await run(() =>
      authFetch('/api/catalog/variation-options/', {
        method: 'POST',
        body: JSON.stringify({ group: groupId, name, price_delta: draft?.delta || '0' }),
      }),
    );
    setOptionDrafts((d) => ({ ...d, [groupId]: { name: '', delta: '' } }));
  }

  const setDraft = (groupId: string, patch: Partial<{ name: string; delta: string }>) =>
    setOptionDrafts((d) => {
      const base = d[groupId] ?? { name: '', delta: '' };
      return { ...d, [groupId]: { ...base, ...patch } };
    });

  const delGroup = (id: string) =>
    run(() => authFetch(`/api/catalog/variation-groups/${id}/`, { method: 'DELETE' }));
  const delOption = (id: string) =>
    run(() => authFetch(`/api/catalog/variation-options/${id}/`, { method: 'DELETE' }));

  return (
    <div className="border-t border-spoto-line bg-spoto-surface-2/60 p-3" aria-busy={busy}>
      {groups.map((g) => {
        const draft = optionDrafts[g.id] ?? { name: '', delta: '' };
        return (
          <div key={g.id} className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-spoto-ink">{g.name}</span>
              {g.is_required && <span className="text-xs text-spoto-muted">required</span>}
              <button onClick={() => delGroup(g.id)} className="ml-auto text-xs text-danger">
                delete group
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {g.options.map((o) => (
                <span
                  key={o.id}
                  className="flex items-center gap-1 rounded-md border border-spoto-line bg-spoto-surface px-2 py-1 text-xs text-spoto-ink"
                >
                  {o.name}
                  {Number(o.price_delta) !== 0 &&
                    ` (${Number(o.price_delta) > 0 ? '+' : ''}₹${Number(o.price_delta)})`}
                  <button onClick={() => delOption(o.id)} className="text-danger">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft(g.id, { name: e.target.value })}
                placeholder="Option (e.g. 500ml)"
                className="min-h-9 flex-1 py-1 text-sm"
              />
              <Input
                value={draft.delta}
                onChange={(e) => setDraft(g.id, { delta: e.target.value })}
                placeholder="+₹"
                inputMode="decimal"
                className="min-h-9 w-20 py-1 text-sm"
              />
              <Button variant="secondary" size="sm" onClick={() => addOption(g.id)} disabled={busy}>
                Add
              </Button>
            </div>
          </div>
        );
      })}

      <form onSubmit={addGroup} className="flex gap-2">
        <Input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="New variation group (e.g. Size, Protein)"
          className="min-h-9 flex-1 py-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !groupName.trim()}>
          + Group
        </Button>
      </form>
    </div>
  );
}
