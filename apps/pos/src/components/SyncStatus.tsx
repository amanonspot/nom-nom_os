'use client';

import { StatusBadge } from '@nomnom/ui';
import { usePos } from '@/lib/pos';

export function SyncStatus() {
  const { sync } = usePos();
  if (!sync.online) return <StatusBadge tone="danger">offline</StatusBadge>;
  if (sync.syncing) return <StatusBadge tone="warning">syncing…</StatusBadge>;
  if (sync.pending > 0) return <StatusBadge tone="warning">{sync.pending} queued</StatusBadge>;
  return <StatusBadge tone="success">synced</StatusBadge>;
}
