import type { AddOn, MenuItem, VariationOption } from '@nomnom/types';
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
    optionIds: options.map((o) => o.id),
    addOnIds: addOnList.map((a) => a.id),
    optionLabels: options.map((o) => o.name),
    addOnLabels: addOnList.map((a) => a.name),
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
    lines: [],
    discountTotal: 0,
    subtotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    status: 'open',
    syncState: 'pending',
    createdAt: now,
    updatedAt: now,
  };
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
