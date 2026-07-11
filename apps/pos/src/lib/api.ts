import type { AddOn, CategoryWithItems, Customer, Me, Order, Table } from '@nomnom/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function authed<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return ((await res.json()) as { access: string }).access;
}

export const fetchMe = (token: string) => authed<Me>('/api/me/', token);

/** Validate a manager PIN (for comp / overrides). Returns whether it's valid. */
export const verifyPin = (token: string, pin: string) =>
  authed<{ valid: boolean }>('/api/verify-pin/', token, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  }).then((r) => r.valid);

export const fetchMenu = (token: string, branch: string) =>
  authed<CategoryWithItems[]>(`/api/catalog/menu/?branch=${branch}`, token);

export const fetchTables = (token: string, branch: string) =>
  authed<Table[]>(`/api/ops/tables/?branch=${branch}`, token);

export const fetchAddOns = (token: string, branch: string) =>
  authed<AddOn[]>(`/api/catalog/addons/?branch=${branch}`, token);

/** Active (unpaid, in-kitchen) orders for the Tables screen timers. */
export const fetchActiveOrders = (token: string, branch: string) =>
  authed<Order[]>(
    `/api/ops/orders/?branch=${branch}&kitchen_status=pending,cooking,ready`,
    token,
  );

export const getOrder = (token: string, id: string) =>
  authed<Order>(`/api/ops/orders/${id}/`, token);

export const lookupCustomer = (token: string, branch: string, phone: string) =>
  authed<Customer[]>(
    `/api/ops/customers/by_phone/?branch=${branch}&phone=${encodeURIComponent(phone)}`,
    token,
  );

/** Change table (guests shifted): frees the old, occupies the new. */
export const assignTable = (token: string, orderId: string, tableId: string) =>
  authed<Order>(`/api/ops/orders/${orderId}/assign_table/`, token, {
    method: 'POST',
    body: JSON.stringify({ table: tableId }),
  });

/** Complimentary (manager-PIN gated). scope 'bill' or 'item'. */
export const compOrder = (
  token: string,
  orderId: string,
  body: { scope: 'bill' | 'item'; item?: string; reason: string; pin: string },
) =>
  authed<Order>(`/api/ops/orders/${orderId}/comp/`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** WebSocket URL for the branch order feed (shared with the KDS group). */
export function wsUrl(branch: string, token: string): string {
  return `${API_URL.replace(/^http/, 'ws')}/ws/kds/${branch}/?token=${encodeURIComponent(token)}`;
}
