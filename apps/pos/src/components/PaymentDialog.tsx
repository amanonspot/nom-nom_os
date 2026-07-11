'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';

export type PaymentMode = 'cash' | 'card' | 'upi';
export interface PaymentSplit {
  mode: PaymentMode;
  amount: number;
  /** Cash tendered (handed over) — used to compute change. */
  tendered?: number;
}

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
  const [amounts, setAmounts] = useState<Record<PaymentMode, string>>({
    cash: total.toFixed(2),
    card: '',
    upi: '',
  });
  // Cash tendered (what the guest handed over) → change calculator.
  const [tendered, setTendered] = useState('');

  const paid = (['cash', 'card', 'upi'] as PaymentMode[]).reduce(
    (sum, m) => sum + (parseFloat(amounts[m]) || 0),
    0,
  );
  const due = Math.round((total - paid) * 100) / 100;
  const cashAmount = parseFloat(amounts.cash) || 0;
  const tenderedNum = parseFloat(tendered) || 0;
  // Change is returned against the cash portion.
  const change = Math.round((tenderedNum - cashAmount) * 100) / 100;

  function confirm() {
    const splits = (['cash', 'card', 'upi'] as PaymentMode[])
      .map((mode) => ({
        mode,
        amount: parseFloat(amounts[mode]) || 0,
        ...(mode === 'cash' && tenderedNum > 0 ? { tendered: tenderedNum } : {}),
      }))
      .filter((s) => s.amount > 0);
    onConfirm(splits);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-spoto-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-spoto-ink">Payment</h2>
          <button onClick={onClose} className="text-2xl leading-none text-spoto-muted">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-spoto-muted">
          Total due <span className="font-semibold text-spoto-ink">₹{total.toFixed(2)}</span>
        </p>

        {(['cash', 'card', 'upi'] as PaymentMode[]).map((mode) => (
          <label key={mode} className="mb-3 flex items-center justify-between gap-3">
            <span className="w-16 text-sm capitalize text-spoto-muted">{mode}</span>
            <input
              inputMode="decimal"
              value={amounts[mode]}
              onChange={(e) => setAmounts((a) => ({ ...a, [mode]: e.target.value }))}
              className="flex-1 rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-right text-spoto-ink outline-none focus:border-spoto-purple"
            />
          </label>
        ))}

        <div className="mb-3 mt-1 flex justify-between text-sm">
          <span className="text-spoto-muted">{due > 0.001 ? 'Remaining' : 'Fully covered'}</span>
          <span className={due > 0.001 ? 'text-danger' : 'text-success'}>₹{Math.abs(due).toFixed(2)}</span>
        </div>

        {/* Change calculator */}
        <div className="mb-4 rounded-lg border border-spoto-line bg-spoto-bg p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-spoto-muted">Cash received</span>
            <input
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
              onClick={() => setTendered(cashAmount.toFixed(2))}
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

        <Button className="w-full" disabled={due > 0.001} onClick={confirm}>
          Confirm payment
        </Button>
      </div>
    </div>
  );
}
