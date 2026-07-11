'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';

export function CoversDialog({
  current,
  onSave,
  onClose,
}: {
  current: number;
  onSave: (n: number) => void;
  onClose: () => void;
}) {
  const [n, setN] = useState(current);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xs rounded-2xl bg-spoto-surface p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold text-spoto-ink">Covers (guests)</h2>
        <div className="mb-5 flex items-center justify-center gap-4">
          <button
            onClick={() => setN((v) => Math.max(1, v - 1))}
            className="h-11 w-11 rounded-lg border border-spoto-line text-xl text-spoto-ink"
          >
            −
          </button>
          <span className="w-10 text-center font-heading text-2xl font-bold text-spoto-ink">{n}</span>
          <button
            onClick={() => setN((v) => v + 1)}
            className="h-11 w-11 rounded-lg border border-spoto-line text-xl text-spoto-ink"
          >
            +
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onSave(n)}>
            Set
          </Button>
        </div>
      </div>
    </div>
  );
}
