/**
 * Money math for offline ordering. Mirrors the server's authoritative
 * calculation (apps/operations/serializers.py) so an offline bill matches the
 * synced one to the paisa. All amounts are numbers in rupees; we round each
 * line and tax to 2 decimals the same way Decimal.quantize does server-side.
 */

import type { LocalOrder, LocalOrderLine } from './types';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Unit price = base + Σ option deltas + Σ add-on prices. */
export function computeUnitPrice(
  basePrice: number,
  optionDeltas: number[],
  addOnPrices: number[],
): number {
  const total =
    basePrice +
    optionDeltas.reduce((a, b) => a + b, 0) +
    addOnPrices.reduce((a, b) => a + b, 0);
  return round2(total);
}

export function lineTotal(line: LocalOrderLine): number {
  return round2(line.unitPrice * line.quantity);
}

export function lineTax(line: LocalOrderLine): number {
  return round2((lineTotal(line) * line.gstRate) / 100);
}

export interface OrderTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function computeOrderTotals(
  lines: LocalOrderLine[],
  discountTotal = 0,
): OrderTotals {
  let subtotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    subtotal += lineTotal(line);
    taxTotal += lineTax(line);
  }
  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  return { subtotal, taxTotal, grandTotal: round2(subtotal + taxTotal - discountTotal) };
}

/** Recompute and return an order with fresh totals. */
export function withTotals(order: LocalOrder): LocalOrder {
  const totals = computeOrderTotals(order.lines, order.discountTotal);
  return { ...order, ...totals, updatedAt: new Date().toISOString() };
}
