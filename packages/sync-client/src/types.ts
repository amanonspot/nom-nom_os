/** Framework-agnostic types for offline-first ordering + the outbox queue. */

export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

export interface LocalOrderLine {
  /** Client UUID for the line. */
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  /** Snapshot unit price (base + option deltas + add-on prices). */
  unitPrice: number;
  gstRate: number;
  notes?: string;
  optionIds: string[];
  addOnIds: string[];
  optionLabels: string[];
  addOnLabels: string[];
}

export type OrderType = 'dine_in' | 'takeaway' | 'qr';

export interface LocalOrder {
  /** Client UUID — the same id the server persists (no remapping). */
  id: string;
  branchId: string;
  tableId?: string | null;
  customerId?: string | null;
  orderType: OrderType;
  lines: LocalOrderLine[];
  discountTotal: number;
  /** Recomputed snapshot; see pricing.computeOrderTotals. */
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: 'open' | 'held' | 'billed' | 'paid' | 'void';
  /** Payment splits captured at billing (settled server-side after create). */
  payments?: { mode: 'cash' | 'card' | 'upi'; amount: number }[];
  syncState: SyncState;
  /** Server id once acknowledged (equals `id` in our model). */
  serverId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row as returned by GET /api/sync/pull — always carries the sync clock. */
export interface PulledRow {
  id: string;
  last_modified: string;
  is_deleted: boolean;
  [k: string]: unknown;
}

export interface PullResult {
  server_time: string;
  tables: PulledRow[];
  orders: PulledRow[];
  categories: PulledRow[];
  items: PulledRow[];
  variation_groups: PulledRow[];
  variation_options: PulledRow[];
  addons: PulledRow[];
  customers: PulledRow[];
}

export interface PushAck {
  id: string;
  status: 'ok' | 'error';
  last_modified?: string;
  errors?: unknown;
}

export type OutboxOp = 'create_order' | 'update_order' | 'settle_order';

export interface OutboxEntry {
  id: string;
  op: OutboxOp;
  /** The LocalOrder id this entry mutates. */
  entityId: string;
  payload: unknown;
  status: SyncState;
  attempts: number;
  lastError?: string;
  createdAt: string;
}
