/**
 * SyncEngine — offline-first order sync.
 *
 * Push: orders are written locally first and queued in the outbox; `flush()`
 * drains the outbox as a single ordered **batch** to /api/sync/push. Every sale
 * completes with zero network calls; the server upsert is idempotent on the
 * order's client UUID.
 *
 * Pull: `pull()` fetches rows changed since the local cursor and merges them
 * (last-write-wins, tombstones removed) so terminals converge. A `conflict`
 * event fires when a pulled order is newer than a still-pending local copy.
 */

import type { PersistencePort } from './port';
import type { LocalOrder, OutboxEntry, PullResult, PushAck } from './types';

export interface Transport {
  pushBatch(orders: LocalOrder[]): Promise<{ acks: PushAck[] }>;
  pull(since: string | null, branchId?: string): Promise<PullResult>;
}

export type SyncListener = (state: {
  online: boolean;
  pending: number;
  syncing: boolean;
}) => void;

export type ConflictListener = (info: { id: string; resolution: 'remote-wins' }) => void;

export class SyncEngine {
  private syncing = false;
  private listeners = new Set<SyncListener>();
  private conflictListeners = new Set<ConflictListener>();

  constructor(
    private readonly port: PersistencePort,
    private readonly transport: Transport,
    private readonly isOnline: () => boolean = () =>
      typeof navigator === 'undefined' ? true : navigator.onLine,
  ) {}

  subscribe(fn: SyncListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onConflict(fn: ConflictListener): () => void {
    this.conflictListeners.add(fn);
    return () => this.conflictListeners.delete(fn);
  }

  private async emit(): Promise<void> {
    const pending = (await this.port.pending()).filter((e) => e.status !== 'synced');
    for (const fn of this.listeners) {
      fn({ online: this.isOnline(), pending: pending.length, syncing: this.syncing });
    }
  }

  /** Persist an order locally, enqueue it, and attempt an immediate flush. */
  async enqueueOrder(order: LocalOrder): Promise<void> {
    await this.port.saveOrder({ ...order, syncState: 'pending' });
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      op: 'create_order',
      entityId: order.id,
      payload: order,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    await this.port.enqueue(entry);
    await this.emit();
    void this.flush();
  }

  /** Drain the outbox as one ordered batch. Safe to call repeatedly. */
  async flush(): Promise<void> {
    if (this.syncing || !this.isOnline()) return;
    this.syncing = true;
    await this.emit();
    try {
      const queue = (await this.port.pending())
        .filter((e) => e.status === 'pending' || e.status === 'failed')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (queue.length === 0) return;

      const orders = queue.map((e) => e.payload as LocalOrder);
      try {
        const { acks } = await this.transport.pushBatch(orders);
        const okById = new Map(acks.filter((a) => a.status === 'ok').map((a) => [a.id, a]));
        for (const entry of queue) {
          if (!okById.has(entry.entityId)) continue;
          await this.port.updateEntry({ ...entry, status: 'synced' });
          const order = await this.port.getOrder(entry.entityId);
          if (order) {
            await this.port.saveOrder({ ...order, syncState: 'synced', serverId: order.id });
          }
        }
      } catch (err) {
        for (const entry of queue) {
          await this.port.updateEntry({
            ...entry,
            status: 'failed',
            attempts: entry.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      this.syncing = false;
      await this.emit();
    }
  }

  /** Pull deltas since the cursor and merge them; returns changed order ids. */
  async pull(branchId?: string): Promise<string[]> {
    if (!this.isOnline()) return [];
    const since = await this.port.getSyncCursor();
    const result = await this.transport.pull(since, branchId);

    // Conflict detection: a pulled order that also sits unsynced in our outbox.
    const pendingIds = new Set(
      (await this.port.pending())
        .filter((e) => e.status !== 'synced')
        .map((e) => e.entityId),
    );
    for (const row of result.orders) {
      if (pendingIds.has(row.id)) {
        for (const fn of this.conflictListeners) fn({ id: row.id, resolution: 'remote-wins' });
      }
    }

    const changed = await this.port.mergePulled('remoteOrders', result.orders);
    await this.port.setSyncCursor(result.server_time);
    return changed;
  }
}
