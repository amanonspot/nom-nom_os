'use client';

import { useState } from 'react';
import { Button, Input } from '@nomnom/ui';
import { lookupCustomer } from '@/lib/api';

export function GuestDialog({
  token,
  branchId,
  initialPhone,
  initialName,
  onSave,
  onClose,
}: {
  token: string;
  branchId: string;
  initialPhone: string;
  initialName: string;
  onSave: (phone: string, name: string) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [found, setFound] = useState<string | null>(null);

  // Prefill the name from history when a known phone is entered.
  async function onPhoneBlur() {
    const p = phone.trim();
    if (p.length < 5) return;
    try {
      const matches = await lookupCustomer(token, branchId, p);
      if (matches[0]?.name) {
        setName(matches[0].name);
        setFound(`Returning guest: ${matches[0].name}`);
      } else {
        setFound(null);
      }
    } catch {
      /* offline — skip lookup */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-spoto-surface p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold text-spoto-ink">Guest details</h2>
        <label className="mb-3 flex flex-col gap-1 text-sm text-spoto-muted">
          Phone
          <Input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={onPhoneBlur}
            placeholder="Phone number"
            className="min-h-11 py-1"
          />
        </label>
        {found && <p className="mb-2 text-xs text-success">{found}</p>}
        <label className="mb-4 flex flex-col gap-1 text-sm text-spoto-muted">
          Name
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest name"
            className="min-h-11 py-1"
          />
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onSave(phone.trim(), name.trim())}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
