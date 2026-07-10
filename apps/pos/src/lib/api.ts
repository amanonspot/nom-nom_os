import type { AddOn, CategoryWithItems, Me, Table } from '@nomnom/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function authed<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
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

export const fetchMenu = (token: string, branch: string) =>
  authed<CategoryWithItems[]>(`/api/catalog/menu/?branch=${branch}`, token);

export const fetchTables = (token: string, branch: string) =>
  authed<Table[]>(`/api/ops/tables/?branch=${branch}`, token);

export const fetchAddOns = (token: string, branch: string) =>
  authed<AddOn[]>(`/api/catalog/addons/?branch=${branch}`, token);

/** WebSocket URL for the branch order feed (shared with the KDS group). */
export function wsUrl(branch: string, token: string): string {
  return `${API_URL.replace(/^http/, 'ws')}/ws/kds/${branch}/?token=${encodeURIComponent(token)}`;
}
