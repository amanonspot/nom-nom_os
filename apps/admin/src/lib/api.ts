import type { Me } from '@nomnom/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';

/** Sign in with username + login PIN, gated to the Admin service. */
export async function login(username: string, pin: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/pin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin, service: 'admin' }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Invalid username or PIN');
  }
  const data = (await res.json()) as { access: string };
  return data.access;
}

export async function fetchMe(accessToken: string): Promise<Me> {
  const res = await fetch(`${API_URL}/api/me/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load profile');
  return (await res.json()) as Me;
}
