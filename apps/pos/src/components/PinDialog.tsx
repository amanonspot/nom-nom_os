'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';

export function PinDialog({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: (pin: string) => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xs rounded-2xl bg-surface p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-fg">{title}</h2>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Manager PIN"
          className="mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2 text-center text-lg tracking-widest text-fg outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => onConfirm(pin)}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
