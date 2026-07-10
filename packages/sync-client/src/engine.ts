/**
 * SyncEngine — writes orders locally first, queues an outbox entry, then
 * flushes to the server when connectivity allows. Every sale completes with
 * zero network calls; the outbox drains opportunistically (on enqueue, on
 * `online` events, and on demand). Ordered, at-least-once delivery; the server
 * upsert is idempotent on the order's client UUID.
 */

import type { PersistencePort } from './port';
import type { LocalOrder, OutboxEntry } from './types';

export interface Transport {
  /** Push a create/update order payload; resolves with the server id. */
  pushOrder(payload: unknown): Promise<{ id: string }>;
}

export type SyncListener = (state: {
  online: boolean;
  pending: number;
  syncing: boolean;
}) => void;

export class SyncEngine {
  private syncing = false;
  private listeners = new Set<SyncListener>();

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

  /** Drain the outbox in creation order. Safe to call repeatedly. */
  async flush(): Promise<void> {
    if (this.syncing || !this.isOnline()) return;
    this.syncing = true;
    await this.emit();
    try {
      const queue = (await this.port.pending())
        .filter((e) => e.status === 'pending' || e.status === 'failed')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const entry of queue) {
        try {
          const res = await this.transport.pushOrder(entry.payload);
          await this.port.updateEntry({ ...entry, status: 'synced' });
          const order = await this.port.getOrder(entry.entityId);
          if (order) {
            await this.port.saveOrder({
              ...order,
              syncState: 'synced',
              serverId: res.id,
            });
          }
        } catch (err) {
          await this.port.updateEntry({
            ...entry,
            status: 'failed',
            attempts: entry.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          });
          break; // preserve order; retry the rest on the next flush
        }
      }
    } finally {
      this.syncing = false;
      await this.emit();
    }
  }
}
