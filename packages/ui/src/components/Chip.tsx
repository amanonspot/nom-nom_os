'use client';

import { cn } from '../lib/utils';

/*
 * Selectable pill — adopted from spotorangeradmin's Chip, re-themed light.
 * Selected = lime-green fill (matches the CTA accent); idle = surface with a
 * purple hover.
 */
export function Chip({
  label,
  selected = false,
  onClick,
  className = '',
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spoto-purple',
        selected
          ? 'border-spoto-green bg-spoto-green text-[#101010] shadow-[0_4px_16px_rgba(183,240,65,0.3)]'
          : 'border-spoto-line bg-spoto-surface text-spoto-ink hover:border-spoto-purple/60 hover:bg-spoto-surface-2',
        className,
      )}
    >
      {label}
    </button>
  );
}
