'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Select, StatusBadge } from '@nomnom/ui';
import { useSession } from '@/lib/session';

interface StaffUser {
  id: number;
  username: string;
  role: string;
  services: string[];
  branch: { id: string; name: string } | null;
  is_active: boolean;
  has_pin: boolean;
  pin?: string; // only present on create / reset (revealed once)
}

/** Roles offered when minting a login, with the services each unlocks. */
const ROLES: { value: string; label: string }[] = [
  { value: 'manager', label: 'Manager — POS · KDS · Admin' },
  { value: 'cashier', label: 'Cashier — POS' },
  { value: 'waiter', label: 'Waiter — POS' },
  { value: 'kitchen', label: 'Kitchen — KDS' },
  { value: 'admin', label: 'Admin — POS · KDS · Admin' },
  { value: 'owner', label: 'Owner — POS · KDS · Admin' },
];

export function UserManager() {
  const { authFetch } = useSession();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('cashier');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A freshly generated PIN to reveal once (create or reset).
  const [revealed, setRevealed] = useState<{ username: string; pin: string } | null>(null);

  const reload = useCallback(async () => {
    setUsers(await authFetch<StaffUser[]>('/api/accounts/users/'));
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await authFetch<StaffUser>('/api/accounts/users/', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), role, pin: pin.trim() }),
      });
      if (created.pin) setRevealed({ username: created.username, pin: created.pin });
      setUsername('');
      setPin('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? cleanError(err.message) : 'Could not create login');
    } finally {
      setBusy(false);
    }
  }

  async function resetPin(u: StaffUser) {
    const res = await authFetch<StaffUser>(`/api/accounts/users/${u.id}/reset_pin/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.pin) setRevealed({ username: res.username, pin: res.pin });
    await reload();
  }

  async function toggleActive(u: StaffUser) {
    await authFetch(`/api/accounts/users/${u.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    await reload();
  }

  return (
    <div>
      <h2 className="mb-1 font-heading text-lg font-semibold text-spoto-ink">Staff logins</h2>
      <p className="mb-4 text-sm text-spoto-muted">
        Create a username + PIN for staff. The role decides which apps the login can open.
      </p>

      {/* One-time PIN reveal */}
      {revealed && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-spoto-green/50 bg-spoto-green/10 px-4 py-3">
          <p className="text-sm text-spoto-ink">
            PIN for <span className="font-heading font-bold">{revealed.username}</span> —{' '}
            <span className="font-heading text-lg font-bold tracking-widest">{revealed.pin}</span>
            <span className="ml-2 text-xs text-spoto-muted">Shown once — share it now.</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={create} className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          Username
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. cashier2"
            autoCapitalize="none"
            spellCheck={false}
            className="min-h-10 w-44 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          Role
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="min-h-10 w-64 py-1"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-spoto-muted">
          PIN (optional)
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="auto"
            inputMode="numeric"
            className="min-h-10 w-24 py-1"
          />
        </label>
        <Button type="submit" disabled={!username.trim() || busy}>
          {busy ? 'Creating…' : '+ Create login'}
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* Staff table */}
      <div className="overflow-hidden rounded-xl border border-spoto-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-spoto-surface-2 text-xs uppercase tracking-wide text-spoto-muted">
            <tr>
              <th className="px-4 py-2 font-heading font-semibold">Username</th>
              <th className="px-4 py-2 font-heading font-semibold">Role</th>
              <th className="px-4 py-2 font-heading font-semibold">Access</th>
              <th className="px-4 py-2 font-heading font-semibold">Status</th>
              <th className="px-4 py-2 font-heading font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-spoto-line bg-spoto-surface">
                <td className="px-4 py-3 font-heading font-semibold text-spoto-ink">{u.username}</td>
                <td className="px-4 py-3 capitalize text-spoto-ink">{u.role}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.services.length ? (
                      u.services.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-spoto-purple/12 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-wide text-spoto-purple-ink"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-spoto-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={u.is_active ? 'success' : 'danger'}>
                    {u.is_active ? 'active' : 'disabled'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <button
                      onClick={() => resetPin(u)}
                      className="font-heading font-semibold text-spoto-purple-ink hover:underline"
                    >
                      Reset PIN
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className={u.is_active ? 'text-danger' : 'text-spoto-purple-ink'}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-spoto-muted">
                  No staff logins yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pull a human message out of the "path → status body" authFetch error text. */
function cleanError(msg: string): string {
  const m = msg.match(/\{.*"([^"]+)":\s*(\[?"[^"]+"|"[^"]+")/);
  if (m) return m[2].replace(/[[\]"]/g, '');
  if (/username/i.test(msg) && /exist/i.test(msg)) return 'That username is taken.';
  return 'Could not create login. Check the username is unique.';
}
