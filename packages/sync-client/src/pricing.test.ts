import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeOrderTotals, computeUnitPrice, round2 } from './pricing';
import type { LocalOrderLine } from './types';

function line(over: Partial<LocalOrderLine>): LocalOrderLine {
  return {
    id: 'l1',
    menuItemId: 'm1',
    nameSnapshot: 'Biryani',
    quantity: 1,
    unitPrice: 0,
    gstRate: 5,
    optionIds: [],
    addOnIds: [],
    optionLabels: [],
    addOnLabels: [],
    ...over,
  };
}

test('unit price = base + option deltas + add-on prices', () => {
  assert.equal(computeUnitPrice(180, [80], [30]), 290);
  assert.equal(computeUnitPrice(40, [20], []), 60);
  assert.equal(computeUnitPrice(180, [-20], []), 160);
});

test('order totals match the server (Biryani mutton+cheese ×2 @5% GST)', () => {
  const l = line({ unitPrice: 290, quantity: 2, gstRate: 5 });
  const totals = computeOrderTotals([l]);
  assert.equal(totals.subtotal, 580);
  assert.equal(totals.taxTotal, 29); // 5% of 580
  assert.equal(totals.grandTotal, 609);
});

test('mixed GST rates and rounding', () => {
  const biryani = line({ unitPrice: 290, quantity: 1, gstRate: 5 }); // tax 14.5
  const cola = line({ id: 'l2', unitPrice: 60, quantity: 1, gstRate: 12 }); // tax 7.2
  const totals = computeOrderTotals([biryani, cola]);
  assert.equal(totals.subtotal, 350);
  assert.equal(totals.taxTotal, round2(14.5 + 7.2));
  assert.equal(totals.grandTotal, round2(350 + 21.7));
});

test('discount reduces grand total', () => {
  const l = line({ unitPrice: 100, quantity: 1, gstRate: 5 });
  const totals = computeOrderTotals([l], 10);
  assert.equal(totals.grandTotal, round2(100 + 5 - 10));
});

test('complimentary line is excluded; whole-bill comp zeroes the total', () => {
  const paid = line({ unitPrice: 100, quantity: 1, gstRate: 5 });
  const comped = line({ id: 'l2', unitPrice: 200, quantity: 1, gstRate: 5, isComplimentary: true });
  // Comped line dropped from subtotal/tax.
  const t1 = computeOrderTotals([paid, comped]);
  assert.equal(t1.subtotal, 100);
  assert.equal(t1.taxTotal, 5);
  assert.equal(t1.grandTotal, 105);
  // Whole-bill comp → grand total 0 (subtotal still recorded).
  const t2 = computeOrderTotals([paid], 0, true);
  assert.equal(t2.subtotal, 100);
  assert.equal(t2.grandTotal, 0);
});
