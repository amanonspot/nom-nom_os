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
  /** Per-line complimentary (comp one dish); excluded from the bill. */
  isComplimentary?: boolean;
  optionIds: string[];
  addOnIds: string[];
  optionLabels: string[];
  addOnLabels: string[];
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'qr';

export interface LocalOrder {
  /** Client UUID — the same id the server persists (no remapping). */
  id: string;
  branchId: string;
  tableId?: string | null;
  customerId?: string | null;
  /** Guest capture — phone links/creates a Customer server-side. */
  customerPhone?: string;
  customerName?: string;
  orderType: OrderType;
  /** Party size (guests seated). */
  covers: number;
  deliveryAddress?: string;
  lines: LocalOrderLine[];
  discountTotal: number;
  /** Whole-bill complimentary — zeroes the total. */
  isComplimentary: boolean;
  compReason?: string;
  /** Recomputed snapshot; see pricing.computeOrderTotals. */
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: 'open' | 'held' | 'billed' | 'paid' | 'void';
  /** Server-assigned Bill No, present once persisted. */
  number?: number | null;
  /** Kitchen roll-up status, present once persisted. */
  kitchenStatus?: string | null;
  /** Payment splits captured at billing (settled server-side after create). */
  payments?: { mode: 'cash' | 'card' | 'upi'; amount: number; tendered?: number }[];
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
