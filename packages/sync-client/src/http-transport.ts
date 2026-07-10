/** A Transport that POSTs orders to the DRF backend (/api/ops/orders/). */

import type { Transport } from './engine';
import type { LocalOrder } from './types';

export interface HttpTransportOptions {
  apiUrl: string;
  /** Returns a fresh access token (or null when unauthenticated). */
  getToken: () => string | null;
}

export function createHttpTransport({ apiUrl, getToken }: HttpTransportOptions): Transport {
  return {
    async pushOrder(payload: unknown): Promise<{ id: string }> {
      const order = payload as LocalOrder;
      const body = {
        id: order.id,
        branch: order.branchId,
        table: order.tableId ?? null,
        customer: order.customerId ?? null,
        order_type: order.orderType,
        discount_total: order.discountTotal,
        items_write: order.lines.map((l) => ({
          menu_item: l.menuItemId,
          quantity: l.quantity,
          notes: l.notes ?? '',
          option_ids: l.optionIds,
          add_on_ids: l.addOnIds,
        })),
      };
      const token = getToken();
      const res = await fetch(`${apiUrl}/api/ops/orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`push failed: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { id: string };

      // If the order was billed offline, settle its payments after create.
      if (order.payments && order.payments.length > 0) {
        const settle = await fetch(`${apiUrl}/api/ops/orders/${data.id}/settle/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(order.payments),
        });
        if (!settle.ok) throw new Error(`settle failed: ${settle.status}`);
      }
      return { id: data.id };
    },
  };
}
