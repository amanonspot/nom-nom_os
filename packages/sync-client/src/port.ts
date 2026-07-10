/**
 * PersistencePort — the storage seam the whole offline stack depends on.
 *
 * Phase 1 implements this with IndexedDB (@nomnom/persistence-idb). Phase 6
 * drops in a SQLite adapter inside Tauri with zero changes to the POS or the
 * SyncEngine. Read caches (menu, tables) are last-write-wins snapshots; orders
 * and the outbox are the durable local source of truth until synced.
 */

import type { LocalOrder, OutboxEntry, PulledRow } from './types';

export interface PersistencePort {
  // --- Read caches (populated on pull; served offline) ---
  saveMenu(branchId: string, tree: unknown): Promise<void>;
  getMenu(branchId: string): Promise<unknown | null>;
  saveTables(branchId: string, tables: unknown): Promise<void>;
  getTables(branchId: string): Promise<unknown | null>;
  saveAddOns(branchId: string, addOns: unknown): Promise<void>;
  getAddOns(branchId: string): Promise<unknown | null>;

  // --- Orders (local source of truth) ---
  saveOrder(order: LocalOrder): Promise<void>;
  getOrder(id: string): Promise<LocalOrder | null>;
  listOrders(branchId: string): Promise<LocalOrder[]>;

  // --- Outbox queue ---
  enqueue(entry: OutboxEntry): Promise<void>;
  pending(): Promise<OutboxEntry[]>;
  updateEntry(entry: OutboxEntry): Promise<void>;

  // --- Pull sync ---
  /** ISO timestamp of the last successful pull (delta cursor). */
  getSyncCursor(): Promise<string | null>;
  setSyncCursor(iso: string): Promise<void>;
  /**
   * Merge pulled rows (with last_modified + is_deleted) into a keyed store,
   * last-write-wins; tombstones are removed. Returns the ids that changed.
   */
  mergePulled(store: 'remoteOrders', rows: PulledRow[]): Promise<string[]>;
  getRemoteOrder(id: string): Promise<PulledRow | null>;
  listRemoteOrders(): Promise<PulledRow[]>;
}
