'use client';

import { useState } from 'react';
import { Button, Input } from '@nomnom/ui';

/**
 * Custom discount dialog: a flat ₹ amount or a % of the bill, gated by a
 * manager PIN. onConfirm resolves the resolved ₹ amount only when the PIN is
 * valid (dialog closes); false → wrong PIN, stays open.
 */
export function DiscountDialog({
  base,
  current,
  onConfirm,
  onRemove,
  onClose,
}: {
  /** Pre-discount total (subtotal + tax) the % is computed against. */
  base: number;
  current: number;
  onConfirm: (amount: number, pin: string) => Promise<boolean>;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'amount' | 'percent'>('amount');
  const [value, setValue] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const raw = parseFloat(value) || 0;
  const amount =
    mode === 'percent'
      ? Math.round(Math.min(100, Math.max(0, raw)) * base) / 100
      : Math.min(base, Math.max(0, raw));

  async function submit() {
    if (amount <= 0) {
      setError('Enter a discount greater than zero.');
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onConfirm(Math.round(amount * 100) / 100, pin);
    if (!ok) {
      setError('Invalid manager PIN');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-spoto-surface p-5">
        <h2 className="mb-1 font-heading text-lg font-semibold text-spoto-ink">Custom discount</h2>
        <p className="mb-4 text-sm text-spoto-muted">Manager authorization required.</p>

        {/* ₹ / % toggle */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['amount', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border py-2 text-sm font-heading font-semibold ${
                mode === m
                  ? 'border-spoto-purple bg-spoto-purple/10 text-spoto-purple-ink'
                  : 'border-spoto-line bg-spoto-bg text-spoto-ink'
              }`}
            >
              {m === 'amount' ? '₹ Amount' : '% Percent'}
            </button>
          ))}
        </div>

        <label className="mb-3 flex flex-col gap-1 text-sm text-spoto-muted">
          {mode === 'amount' ? 'Discount (₹)' : 'Discount (%)'}
          <Input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder={mode === 'amount' ? 'e.g. 50' : 'e.g. 10'}
            className="min-h-10 py-1"
          />
        </label>

        <p className="mb-3 text-sm text-spoto-ink">
          Discount: <span className="font-heading font-bold">₹{amount.toFixed(2)}</span>
          <span className="text-spoto-muted"> off ₹{base.toFixed(2)}</span>
        </p>

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
          {current > 0 && (
            <Button variant="outline" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button className="flex-1" disabled={busy || !pin || amount <= 0} onClick={submit}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
