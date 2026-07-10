import type { Me } from '@nomnom/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
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
