/**
 * IndexedDB implementation of PersistencePort (Phase 1).
 *
 * Object stores:
 *   caches  — keyed "menu:<branch>" / "tables:<branch>" read snapshots
 *   orders  — LocalOrder keyed by id, indexed by branchId
 *   outbox  — OutboxEntry keyed by id, indexed by createdAt
 *
 * Phase 6 replaces this module with a SQLite adapter behind the same interface.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LocalOrder, OutboxEntry, PersistencePort } from '@nomnom/sync-client';

interface NomNomDB extends DBSchema {
  caches: { key: string; value: { key: string; value: unknown } };
  orders: { key: string; value: LocalOrder; indexes: { byBranch: string } };
  outbox: { key: string; value: OutboxEntry; indexes: { byCreatedAt: string } };
}

const DB_NAME = 'nomnom-pos';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBPDatabase<NomNomDB>> {
  return openDB<NomNomDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('caches', { keyPath: 'key' });
      const orders = db.createObjectStore('orders', { keyPath: 'id' });
      orders.createIndex('byBranch', 'branchId');
      const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
      outbox.createIndex('byCreatedAt', 'createdAt');
    },
  });
}

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
}
