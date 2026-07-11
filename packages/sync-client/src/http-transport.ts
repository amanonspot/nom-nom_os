/** A Transport that talks to the DRF sync API (/api/sync/push, /api/sync/pull). */

import type { Transport } from './engine';
import type { LocalOrder, PullResult, PushAck } from './types';

export interface HttpTransportOptions {
  apiUrl: string;
  /** Returns a fresh access token (or null when unauthenticated). */
  getToken: () => string | null;
}

function orderToPayload(order: LocalOrder) {
  return {
    id: order.id,
    branch: order.branchId,
    table: order.tableId ?? null,
    order_type: order.orderType,
    covers: order.covers,
    delivery_address: order.deliveryAddress ?? '',
    discount_total: order.discountTotal,
    is_complimentary: order.isComplimentary,
    comp_reason: order.compReason ?? '',
    ...(order.customerPhone ? { customer_phone: order.customerPhone } : {}),
    ...(order.customerName ? { customer_name: order.customerName } : {}),
    items_write: order.lines.map((l) => ({
      menu_item: l.menuItemId,
      quantity: l.quantity,
      notes: l.notes ?? '',
      is_complimentary: l.isComplimentary ?? false,
      option_ids: l.optionIds,
      add_on_ids: l.addOnIds,
    })),
  };
}

export function createHttpTransport({ apiUrl, getToken }: HttpTransportOptions): Transport {
  function headers() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  return {
    async pushBatch(orders: LocalOrder[]): Promise<{ acks: PushAck[] }> {
      const res = await fetch(`${apiUrl}/api/sync/push/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ orders: orders.map(orderToPayload) }),
      });
      if (!res.ok) throw new Error(`push failed: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { acks: PushAck[] };

      // Settle any orders that were billed offline (payments captured locally).
      for (const order of orders) {
        if (order.payments && order.payments.length > 0) {
          const settle = await fetch(`${apiUrl}/api/ops/orders/${order.id}/settle/`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(order.payments),
          });
          if (!settle.ok) throw new Error(`settle failed: ${settle.status}`);
        }
      }
      return data;
    },

    async pull(since: string | null, branchId?: string): Promise<PullResult> {
      const params = new URLSearchParams();
      if (since) params.set('since', since);
      if (branchId) params.set('branch', branchId);
      const res = await fetch(`${apiUrl}/api/sync/pull/?${params.toString()}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`pull failed: ${res.status}`);
      return (await res.json()) as PullResult;
    },
  };
}
