'use client';

import { useState } from 'react';
import { Button, FadeIn, StatusBadge } from '@nomnom/ui';
import type { Me } from '@nomnom/types';
import { fetchMe, login } from '@/lib/api';

export default function AdminHome() {
  const [username, setUsername] = useState('manager1');
  const [password, setPassword] = useState('pass12345');
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await login(username, password);
      setMe(await fetchMe(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <FadeIn>
        <p className="text-sm uppercase tracking-widest text-accent-2">Nom Nom OS</p>
        <h1 className="font-display text-4xl font-bold text-fg">Admin Portal</h1>
        <p className="mt-2 text-muted">Owner &amp; manager control plane.</p>
      </FadeIn>

      {!me ? (
        <FadeIn delay={0.1}>
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
          >
            <label className="flex flex-col gap-1 text-sm text-muted">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-fg">
                {me.first_name || me.username}
              </h2>
              <StatusBadge tone="success">{me.role}</StatusBadge>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted">Restaurant</dt>
              <dd className="text-fg">{me.restaurant?.name ?? '—'}</dd>
              <dt className="text-muted">Branch</dt>
              <dd className="text-fg">{me.branch?.name ?? '—'}</dd>
              <dt className="text-muted">GSTIN</dt>
              <dd className="text-fg">{me.restaurant?.gstin || '—'}</dd>
              <dt className="text-muted">Can authorize overrides</dt>
              <dd className="text-fg">{me.can_authorize_overrides ? 'Yes' : 'No'}</dd>
            </dl>
            <Button variant="ghost" onClick={() => setMe(null)}>
              Sign out
            </Button>
          </div>
        </FadeIn>
      )}
    </main>
  );
}
