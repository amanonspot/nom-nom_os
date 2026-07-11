'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';

export type PaymentMode = 'cash' | 'card' | 'upi';
export interface PaymentSplit {
  mode: PaymentMode;
  amount: number;
  /** Cash tendered (handed over) — used to compute change. */
  tendered?: number;
  reference?: string;
}

const MODES: { mode: PaymentMode; label: string }[] = [
  { mode: 'cash', label: 'Cash' },
  { mode: 'card', label: 'Card' },
  { mode: 'upi', label: 'UPI' },
];
const QUICK_CASH = [100, 200, 500, 1000, 2000];

export function PaymentDialog({
  total,
  onConfirm,
  onClose,
}: {
  total: number;
  onConfirm: (splits: PaymentSplit[]) => void;
  onClose: () => void;
}) {
  // Single-mode by default (Petpooja-style); the chosen mode covers the total.
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');

  // Split mode (partial / mixed payment) — optional.
  const [split, setSplit] = useState(false);
  const [amounts, setAmounts] = useState<Record<PaymentMode, string>>({
    cash: total.toFixed(2),
    card: '',
    upi: '',
  });

  const tenderedNum = parseFloat(tendered) || 0;
  const change = Math.round((tenderedNum - total) * 100) / 100;

  const splitPaid = (['cash', 'card', 'upi'] as PaymentMode[]).reduce(
    (s, m) => s + (parseFloat(amounts[m]) || 0),
    0,
  );
  const splitDue = Math.round((total - splitPaid) * 100) / 100;

  function confirm() {
    if (split) {
      const splits = (['cash', 'card', 'upi'] as PaymentMode[])
        .map((m) => ({ mode: m, amount: parseFloat(amounts[m]) || 0 }))
        .filter((s) => s.amount > 0);
      onConfirm(splits);
      return;
    }
    // Single mode covers the full total.
    onConfirm([
      {
        mode,
        amount: total,
        ...(mode === 'cash' && tenderedNum > 0 ? { tendered: tenderedNum } : {}),
        ...(reference ? { reference } : {}),
      },
    ]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-spoto-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-spoto-ink">Payment</h2>
          <button onClick={onClose} className="text-2xl leading-none text-spoto-muted">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-spoto-muted">
          Total <span className="font-heading text-base font-bold text-spoto-ink">₹{total.toFixed(2)}</span>
        </p>

        {!split ? (
          <>
            {/* Mode selector (Petpooja-style) */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  onClick={() => setMode(m.mode)}
                  className={`rounded-lg border py-2.5 text-sm font-heading font-semibold ${
                    mode === m.mode
                      ? 'border-spoto-purple bg-spoto-purple text-white'
                      : 'border-spoto-line bg-spoto-bg text-spoto-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'cash' ? (
              /* Change calculator — cash only */
              <div className="mb-4 rounded-lg border border-spoto-line bg-spoto-bg p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-spoto-muted">Cash received</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder="₹ tendered"
                    className="w-28 rounded-lg border border-spoto-line bg-spoto-surface px-3 py-2 text-right text-spoto-ink outline-none focus:border-spoto-purple"
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_CASH.map((v) => (
                    <button
                      key={v}
                      onClick={() => setTendered(String(v))}
                      className="rounded-md border border-spoto-line px-2 py-1 text-xs text-spoto-ink hover:border-spoto-purple"
                    >
                      ₹{v}
                    </button>
                  ))}
                  <button
                    onClick={() => setTendered(total.toFixed(2))}
                    className="rounded-md border border-spoto-line px-2 py-1 text-xs text-spoto-ink hover:border-spoto-purple"
                  >
                    Exact
                  </button>
                </div>
                {tenderedNum > 0 && (
                  <div className="flex items-center justify-between font-heading font-bold">
                    <span className="text-sm text-spoto-ink">{change >= 0 ? 'Return change' : 'Short by'}</span>
                    <span className={change >= 0 ? 'text-success' : 'text-danger'}>
                      ₹{Math.abs(change).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Card / UPI — optional reference, no calculator */
              <label className="mb-4 flex flex-col gap-1 text-sm text-spoto-muted">
                Reference (optional)
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={mode === 'card' ? 'Approval / last 4' : 'UPI txn ref'}
                  className="rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple"
                />
              </label>
            )}

            <button onClick={() => setSplit(true)} className="mb-3 text-xs text-spoto-purple-ink">
              Split payment
            </button>
          </>
        ) : (
          <>
            {/* Split: per-mode amounts */}
            {(['cash', 'card', 'upi'] as PaymentMode[]).map((m) => (
              <label key={m} className="mb-3 flex items-center justify-between gap-3">
                <span className="w-16 text-sm capitalize text-spoto-muted">{m}</span>
                <input
                  inputMode="decimal"
                  value={amounts[m]}
                  onChange={(e) => setAmounts((a) => ({ ...a, [m]: e.target.value }))}
                  className="flex-1 rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-right text-spoto-ink outline-none focus:border-spoto-purple"
                />
              </label>
            ))}
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-spoto-muted">{splitDue > 0.001 ? 'Remaining' : 'Fully covered'}</span>
              <span className={splitDue > 0.001 ? 'text-danger' : 'text-success'}>
                ₹{Math.abs(splitDue).toFixed(2)}
              </span>
            </div>
            <button onClick={() => setSplit(false)} className="mb-3 text-xs text-spoto-purple-ink">
              ← Single mode
            </button>
          </>
        )}

        <Button className="w-full" disabled={split && splitDue > 0.001} onClick={confirm}>
          Confirm payment
        </Button>
      </div>
    </div>
  );
}
