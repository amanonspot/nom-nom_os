import { cn } from '../lib/utils';

/*
 * Tone-based badge — API kept stable for the apps (veg/table-status/etc.), but
 * restyled to the spotorangeradmin look: rounded-full pill, heading font, a
 * tinted background with a matching text color.
 */
type Tone = 'veg' | 'nonveg' | 'success' | 'warning' | 'danger' | 'free' | 'occupied';

const tones: Record<Tone, string> = {
  veg: 'bg-veg/15 text-veg',
  nonveg: 'bg-nonveg/15 text-nonveg',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  free: 'bg-status-free/15 text-status-free',
  occupied: 'bg-status-occupied/15 text-status-occupied',
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-heading font-bold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
