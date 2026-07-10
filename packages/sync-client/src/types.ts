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
  syncState: SyncState;
  /** Server id once acknowledged (equals `id` in our model). */
  serverId?: string | null;
  createdAt: string;
  updatedAt: string;
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
