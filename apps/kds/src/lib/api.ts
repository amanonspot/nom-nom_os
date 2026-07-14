import type { Me, Order } from '@nomnom/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';

export type KitchenStatus = 'pending' | 'cooking' | 'ready' | 'served';
export const ACTIVE_STATUSES: KitchenStatus[] = ['pending', 'cooking', 'ready'];

function authed<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  }).then((res) => {
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json() as Promise<T>;
  });
}

/** Sign in with username + login PIN, gated to the KDS service. */
export async function login(username: string, pin: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/pin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin, service: 'kds' }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Invalid username or PIN');
  }
  return ((await res.json()) as { access: string }).access;
}

export const fetchMe = (token: string) => authed<Me>('/api/me/', token);

export const fetchActiveOrders = (token: string, branch: string) =>
  authed<Order[]>(
    `/api/ops/orders/?branch=${branch}&kitchen_status=${ACTIVE_STATUSES.join(',')}`,
    token,
  );

export const advanceOrder = (token: string, orderId: string, status: KitchenStatus) =>
  authed<Order>(`/api/ops/orders/${orderId}/kitchen/`, token, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });

export const advanceItem = (token: string, itemId: string, status: KitchenStatus) =>
  authed<Order>(`/api/ops/order-items/${itemId}/kitchen/`, token, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });

export function wsUrl(branch: string, token: string): string {
  const base = API_URL.replace(/^http/, 'ws');
  return `${base}/ws/kds/${branch}/?token=${encodeURIComponent(token)}`;
}
