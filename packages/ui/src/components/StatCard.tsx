import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';
import { Card } from './Card';

/* Adopted from spotorangeradmin admin-shell/stat-card, re-themed light. */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'purple',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'purple' | 'green' | 'amber';
}) {
  const tone =
    accent === 'green'
      ? 'bg-spoto-green/20 text-[#4d7c0f]'
      : accent === 'amber'
        ? 'bg-warning/15 text-warning'
        : 'bg-spoto-purple/15 text-spoto-purple-ink';

  return (
    <Card className="flex items-center gap-4 p-4">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-spoto', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-spoto-muted">{label}</p>
        <p className="font-heading text-2xl font-bold text-spoto-ink">{value}</p>
      </div>
    </Card>
  );
}
