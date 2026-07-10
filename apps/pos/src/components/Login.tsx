'use client';

import { useState } from 'react';
import { Button } from '@nomnom/ui';
import { usePos } from '@/lib/pos';

export function Login() {
  const { login } = usePos();
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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-spoto-purple-ink">Nom Nom OS</p>
        <h1 className="font-heading text-3xl font-bold text-spoto-ink">Point of Sale</h1>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-spoto-line bg-spoto-surface p-6">
        <label className="flex flex-col gap-1 text-sm text-spoto-muted">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-spoto-muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-spoto-line bg-spoto-bg px-3 py-2 text-spoto-ink outline-none focus:border-spoto-purple"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
