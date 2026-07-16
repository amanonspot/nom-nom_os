import type { AddOn, MenuItem, Order, OrderItemRead, VariationOption } from '@nomnom/types';
import {
  computeUnitPrice,
  withTotals,
  type LocalOrder,
  type LocalOrderLine,
  type OrderType,
} from '@nomnom/sync-client';

const num = (v: string | number | undefined): number =>
  typeof v === 'number' ? v : parseFloat(v ?? '0');

/** Build a priced order line from an item + the chosen options and add-ons. */
export function buildLine(
  item: MenuItem,
  options: VariationOption[],
  addOnList: AddOn[],
  quantity = 1,
  notes = '',
): LocalOrderLine {
  const optionDeltas = options.map((o) => num(o.price_delta));
  const addOnPrices = addOnList.map((a) => num(a.price));
  return {
    id: crypto.randomUUID(),
    menuItemId: item.id,
    nameSnapshot: item.name,
    quantity,
    unitPrice: computeUnitPrice(num(item.base_price), optionDeltas, addOnPrices),
    gstRate: num(item.gst_rate),
    notes,
    isComplimentary: false,
    optionIds: options.map((o) => o.id),
    addOnIds: addOnList.map((a) => a.id),
    optionLabels: options.map((o) => o.name),
    addOnLabels: addOnList.map((a) => a.name),
  };
}

/** A no-variant item added straight to the cart. */
export function quickLine(item: MenuItem): LocalOrderLine {
  return {
    id: crypto.randomUUID(),
    menuItemId: item.id,
    nameSnapshot: item.name,
    quantity: 1,
    unitPrice: num(item.base_price),
    gstRate: num(item.gst_rate),
    notes: '',
    isComplimentary: false,
    optionIds: [],
    addOnIds: [],
    optionLabels: [],
    addOnLabels: [],
  };
}

export function newOrder(
  branchId: string,
  tableId: string | null,
  orderType: OrderType,
): LocalOrder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    branchId,
    tableId,
    customerId: null,
    orderType,
    covers: 1,
    lines: [],
    discountTotal: 0,
    isComplimentary: false,
    subtotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    status: 'open',
    syncState: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Rebuild an editable LocalOrder from a persisted server Order (used when a
 * cashier taps an occupied table to reopen its bill). The read serializer
 * carries everything per line, so no menu lookup is needed; the id is kept so a
 * re-save upserts idempotently.
 */
export function serverOrderToLocal(order: Order): LocalOrder {
  const lines: LocalOrderLine[] = (order.items ?? []).map((it: OrderItemRead) => ({
    id: it.id ?? crypto.randomUUID(),
    menuItemId: it.menu_item,
    nameSnapshot: it.name_snapshot,
    quantity: it.quantity ?? 1,
    unitPrice: num(it.unit_price),
    gstRate: num(it.gst_rate),
    notes: it.notes ?? '',
    isComplimentary: it.is_complimentary ?? false,
    optionIds: (it.options ?? []).map((o) => o.option),
    addOnIds: (it.add_ons ?? []).map((a) => a.add_on),
    optionLabels: (it.options ?? []).map((o) => o.name_snapshot),
    addOnLabels: (it.add_ons ?? []).map((a) => a.name_snapshot),
  }));
  return withTotals({
    id: order.id!,
    branchId: order.branch,
    tableId: order.table ?? null,
    customerId: order.customer ?? null,
    orderType: (order.order_type ?? 'dine_in') as OrderType,
    covers: order.covers ?? 1,
    deliveryAddress: order.delivery_address ?? '',
    lines,
    discountTotal: num(order.discount_total),
    isComplimentary: order.is_complimentary ?? false,
    compReason: order.comp_reason ?? '',
    subtotal: num(order.subtotal),
    taxTotal: num(order.tax_total),
    grandTotal: num(order.grand_total),
    status: (order.status ?? 'open') as LocalOrder['status'],
    number: order.number ?? null,
    kitchenStatus: order.kitchen_status ?? null,
    syncState: 'synced',
    serverId: order.id,
    createdAt: order.created_at ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function addLine(order: LocalOrder, line: LocalOrderLine): LocalOrder {
  return withTotals({ ...order, lines: [...order.lines, line] });
}

export function removeLine(order: LocalOrder, lineId: string): LocalOrder {
  return withTotals({ ...order, lines: order.lines.filter((l) => l.id !== lineId) });
}

export function setLineQuantity(
  order: LocalOrder,
  lineId: string,
  quantity: number,
): LocalOrder {
  if (quantity <= 0) return removeLine(order, lineId);
  return withTotals({
    ...order,
    lines: order.lines.map((l) => (l.id === lineId ? { ...l, quantity } : l)),
  });
}

export function toggleLineComp(order: LocalOrder, lineId: string, reason = ''): LocalOrder {
  return withTotals({
    ...order,
    lines: order.lines.map((l) =>
      l.id === lineId ? { ...l, isComplimentary: !l.isComplimentary, notes: reason || l.notes } : l,
    ),
  });
}

export function setBillComp(order: LocalOrder, on: boolean, reason = ''): LocalOrder {
  return withTotals({ ...order, isComplimentary: on, compReason: on ? reason : '' });
}

/** Apply (or clear, with 0) a flat rupee discount; pricing subtracts it. */
export function setDiscount(order: LocalOrder, amount: number): LocalOrder {
  return withTotals({ ...order, discountTotal: Math.max(0, Math.round(amount * 100) / 100) });
}
