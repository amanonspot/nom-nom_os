'use client';

import { useState } from 'react';
import { Button, Input } from '@nomnom/ui';

export interface CompTarget {
  scope: 'bill' | 'item';
  lineId?: string;
  lineName?: string;
}

/**
 * Complimentary (unhappy-guest) dialog: capture a reason + a manager PIN.
 * onConfirm resolves true when the PIN is valid (dialog closes) or false
 * (wrong PIN — stays open with an error).
 */
export function CompDialog({
  target,
  onConfirm,
  onClose,
}: {
  target: CompTarget;
  onConfirm: (reason: string, pin: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const ok = await onConfirm(reason.trim(), pin);
    if (!ok) {
      setError('Invalid manager PIN');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-spoto-surface p-5">
        <h2 className="mb-1 font-heading text-lg font-semibold text-spoto-ink">
          {target.scope === 'bill' ? 'Comp whole bill' : `Comp ${target.lineName ?? 'item'}`}
        </h2>
        <p className="mb-4 text-sm text-spoto-muted">
          On the house — excluded from the total. Manager authorization required.
        </p>
        <label className="mb-3 flex flex-col gap-1 text-sm text-spoto-muted">
          Reason
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. cold food, long wait"
            className="min-h-10 py-1"
          />
        </label>
        <label className="mb-3 flex flex-col gap-1 text-sm text-spoto-muted">
          Manager PIN
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="min-h-10 py-1 tracking-widest"
          />
        </label>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" disabled={busy || !pin} onClick={submit}>
            Comp
          </Button>
        </div>
      </div>
    </div>
  );
}
