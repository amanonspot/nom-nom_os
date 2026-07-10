'use client';

import { useState } from 'react';
import { Button, FadeIn } from '@nomnom/ui';
import { useSession } from '@/lib/session';

export function Login() {
  const { login } = useSession();
  const [username, setUsername] = useState('manager1');
  const [password, setPassword] = useState('pass12345');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <FadeIn>
        <p className="text-sm uppercase tracking-widest text-accent-2">Nom Nom OS</p>
        <h1 className="font-display text-3xl font-bold text-fg">Admin Portal</h1>
      </FadeIn>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent" />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
