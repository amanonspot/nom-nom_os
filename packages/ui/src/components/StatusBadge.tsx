type Tone = 'veg' | 'nonveg' | 'success' | 'warning' | 'danger' | 'free' | 'occupied';

const tones: Record<Tone, string> = {
  veg: 'text-veg border-veg',
  nonveg: 'text-nonveg border-nonveg',
  success: 'text-success border-success',
  warning: 'text-warning border-warning',
  danger: 'text-danger border-danger',
  free: 'text-status-free border-status-free',
  occupied: 'text-status-occupied border-status-occupied',
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
