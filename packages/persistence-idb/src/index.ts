/**
 * IndexedDB implementation of PersistencePort (Phase 1 + Phase 2 pull).
 *
 * Object stores:
 *   caches       — keyed "menu:<branch>" / "tables:<branch>" read snapshots
 *   orders       — LocalOrder keyed by id, indexed by branchId
 *   outbox       — OutboxEntry keyed by id, indexed by createdAt
 *   remoteOrders — pulled orders (server shape) keyed by id, LWW-merged
 *   meta         — small key/value store (e.g. the pull cursor)
 *
 * Phase 6 replaces this module with a SQLite adapter behind the same interface.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  LocalOrder,
  OutboxEntry,
  PersistencePort,
  PulledRow,
} from '@nomnom/sync-client';

interface NomNomDB extends DBSchema {
  caches: { key: string; value: { key: string; value: unknown } };
  orders: { key: string; value: LocalOrder; indexes: { byBranch: string } };
  outbox: { key: string; value: OutboxEntry; indexes: { byCreatedAt: string } };
  remoteOrders: { key: string; value: PulledRow };
  meta: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = 'nomnom-pos';
const DB_VERSION = 2;

function openDatabase(): Promise<IDBPDatabase<NomNomDB>> {
  return openDB<NomNomDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('caches', { keyPath: 'key' });
        const orders = db.createObjectStore('orders', { keyPath: 'id' });
        orders.createIndex('byBranch', 'branchId');
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
        outbox.createIndex('byCreatedAt', 'createdAt');
      }
      if (oldVersion < 2) {
        db.createObjectStore('remoteOrders', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
  });
}

const SYNC_CURSOR_KEY = 'syncCursor';

export class IdbPersistence implements PersistencePort {
  private dbp: Promise<IDBPDatabase<NomNomDB>>;

  constructor() {
    this.dbp = openDatabase();
  }

  private async putCache(key: string, value: unknown): Promise<void> {
    const db = await this.dbp;
    await db.put('caches', { key, value });
  }

  private async getCache(key: string): Promise<unknown | null> {
    const db = await this.dbp;
    const row = await db.get('caches', key);
    return row ? row.value : null;
  }

  saveMenu(branchId: string, tree: unknown): Promise<void> {
    return this.putCache(`menu:${branchId}`, tree);
  }
  getMenu(branchId: string): Promise<unknown | null> {
    return this.getCache(`menu:${branchId}`);
  }
  saveTables(branchId: string, tables: unknown): Promise<void> {
    return this.putCache(`tables:${branchId}`, tables);
  }
  getTables(branchId: string): Promise<unknown | null> {
    return this.getCache(`tables:${branchId}`);
  }
  saveAddOns(branchId: string, addOns: unknown): Promise<void> {
    return this.putCache(`addons:${branchId}`, addOns);
  }
  getAddOns(branchId: string): Promise<unknown | null> {
    return this.getCache(`addons:${branchId}`);
  }

  async saveOrder(order: LocalOrder): Promise<void> {
    const db = await this.dbp;
    await db.put('orders', order);
  }
  async getOrder(id: string): Promise<LocalOrder | null> {
    const db = await this.dbp;
    return (await db.get('orders', id)) ?? null;
  }
  async listOrders(branchId: string): Promise<LocalOrder[]> {
    const db = await this.dbp;
    return db.getAllFromIndex('orders', 'byBranch', branchId);
  }

  async enqueue(entry: OutboxEntry): Promise<void> {
    const db = await this.dbp;
    await db.put('outbox', entry);
  }
  async pending(): Promise<OutboxEntry[]> {
    const db = await this.dbp;
    return db.getAllFromIndex('outbox', 'byCreatedAt');
  }
  async updateEntry(entry: OutboxEntry): Promise<void> {
    const db = await this.dbp;
    await db.put('outbox', entry);
  }

  // --- Pull sync ---
  async getSyncCursor(): Promise<string | null> {
    const db = await this.dbp;
    const row = await db.get('meta', SYNC_CURSOR_KEY);
    return row ? (row.value as string) : null;
  }
  async setSyncCursor(iso: string): Promise<void> {
    const db = await this.dbp;
    await db.put('meta', { key: SYNC_CURSOR_KEY, value: iso });
  }

  async mergePulled(store: 'remoteOrders', rows: PulledRow[]): Promise<string[]> {
    const db = await this.dbp;
    const changed: string[] = [];
    const tx = db.transaction(store, 'readwrite');
    for (const row of rows) {
      const existing = await tx.store.get(row.id);
      // Last-write-wins by last_modified; missing existing always accepts.
      if (existing && existing.last_modified >= row.last_modified) continue;
      if (row.is_deleted) {
        if (existing) {
          await tx.store.delete(row.id);
          changed.push(row.id);
        }
      } else {
        await tx.store.put(row);
        changed.push(row.id);
      }
    }
    await tx.done;
    return changed;
  }

  async getRemoteOrder(id: string): Promise<PulledRow | null> {
    const db = await this.dbp;
    return (await db.get('remoteOrders', id)) ?? null;
  }
  async listRemoteOrders(): Promise<PulledRow[]> {
    const db = await this.dbp;
    return db.getAll('remoteOrders');
  }
}
