'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';

export type PaymentMode = 'cash' | 'card' | 'upi';
export interface PaymentSplit {
  mode: PaymentMode;
  amount: number;
}

export function PaymentDialog({
  total,
  onConfirm,
  onClose,
}: {
  total: number;
  onConfirm: (splits: PaymentSplit[]) => void;
  onClose: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<PaymentMode, string>>({
    cash: total.toFixed(2),
    card: '',
    upi: '',
  });

  const paid = (['cash', 'card', 'upi'] as PaymentMode[]).reduce(
    (sum, m) => sum + (parseFloat(amounts[m]) || 0),
    0,
  );
  const due = Math.round((total - paid) * 100) / 100;

  function confirm() {
    const splits = (['cash', 'card', 'upi'] as PaymentMode[])
      .map((mode) => ({ mode, amount: parseFloat(amounts[mode]) || 0 }))
      .filter((s) => s.amount > 0);
    onConfirm(splits);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-fg">Payment</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Total due <span className="font-semibold text-fg">₹{total.toFixed(2)}</span>
        </p>
        {(['cash', 'card', 'upi'] as PaymentMode[]).map((mode) => (
          <label key={mode} className="mb-3 flex items-center justify-between gap-3">
            <span className="w-16 text-sm capitalize text-muted">{mode}</span>
            <input
              inputMode="decimal"
              value={amounts[mode]}
              onChange={(e) => setAmounts((a) => ({ ...a, [mode]: e.target.value }))}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-right text-fg outline-none focus:border-accent"
            />
          </label>
        ))}
        <div className="mb-4 mt-2 flex justify-between text-sm">
          <span className="text-muted">{due > 0 ? 'Remaining' : 'Change'}</span>
          <span className={due > 0 ? 'text-danger' : 'text-success'}>
            ₹{Math.abs(due).toFixed(2)}
          </span>
        </div>
        <Button className="w-full" disabled={due > 0.001} onClick={confirm}>
          Confirm payment
        </Button>
      </div>
    </div>
  );
}
