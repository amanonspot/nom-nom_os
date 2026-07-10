/**
 * PersistencePort — the storage seam the whole offline stack depends on.
 *
 * Phase 1 implements this with IndexedDB (@nomnom/persistence-idb). Phase 6
 * drops in a SQLite adapter inside Tauri with zero changes to the POS or the
 * SyncEngine. Read caches (menu, tables) are last-write-wins snapshots; orders
 * and the outbox are the durable local source of truth until synced.
 */

import type { LocalOrder, OutboxEntry } from './types';

export interface PersistencePort {
  // --- Read caches (populated on pull; served offline) ---
  saveMenu(branchId: string, tree: unknown): Promise<void>;
  getMenu(branchId: string): Promise<unknown | null>;
  saveTables(branchId: string, tables: unknown): Promise<void>;
  getTables(branchId: string): Promise<unknown | null>;

  // --- Orders (local source of truth) ---
  saveOrder(order: LocalOrder): Promise<void>;
  getOrder(id: string): Promise<LocalOrder | null>;
  listOrders(branchId: string): Promise<LocalOrder[]>;

  // --- Outbox queue ---
  enqueue(entry: OutboxEntry): Promise<void>;
  pending(): Promise<OutboxEntry[]>;
  updateEntry(entry: OutboxEntry): Promise<void>;
}
