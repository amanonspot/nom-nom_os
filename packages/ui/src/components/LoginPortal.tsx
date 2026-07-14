'use client';

import * as React from 'react';
import { ChefHat, Delete, LayoutGrid, ShoppingCart, type LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { Input } from './Input';

export type LoginService = 'pos' | 'kds' | 'admin';

const SERVICES: { key: LoginService; label: string; blurb: string; icon: LucideIcon }[] = [
  { key: 'pos', label: 'POS', blurb: 'Take orders & bill', icon: ShoppingCart },
  { key: 'kds', label: 'KDS', blurb: 'Kitchen display', icon: ChefHat },
  { key: 'admin', label: 'Admin', blurb: 'Menu, tables & access', icon: LayoutGrid },
];

const PIN_MIN = 4;
const PIN_MAX = 6;

interface LoginPortalProps {
  /** Which service this app is; its tile is the active auth target. */
  service: LoginService;
  /** URLs of every service, so other tiles can navigate cross-app. */
  urls: Record<LoginService, string>;
  onSubmit: (username: string, pin: string) => Promise<void> | void;
  error?: string | null;
  loading?: boolean;
  brandName?: string;
}

/**
 * The single, container-style login shown by all three apps: three service
 * tiles (POS · KDS · Admin) plus a username + numeric-PIN keypad for the current
 * service. Selecting a different tile navigates to that app's URL.
 */
export function LoginPortal({
  service,
  urls,
  onSubmit,
  error,
  loading = false,
  brandName = 'Nom Nom OS',
}: LoginPortalProps) {
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');

  const active = SERVICES.find((s) => s.key === service)!;

  const pushDigit = (d: string) =>
    setPin((p) => (p.length >= PIN_MAX ? p : p + d));
  const backspace = () => setPin((p) => p.slice(0, -1));

  const canSubmit = username.trim().length > 0 && pin.length >= PIN_MIN && !loading;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    void onSubmit(username.trim(), pin);
  };

  const go = (key: LoginService) => {
    if (key === service) return;
    if (typeof window !== 'undefined') window.location.assign(urls[key]);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-spoto-purple-ink">
          {brandName}
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-spoto-ink">Sign in</h1>
      </div>

      {/* Service tiles — the current one is the active auth target. */}
      <div className="grid grid-cols-3 gap-3">
        {SERVICES.map(({ key, label, blurb, icon: Icon }) => {
          const current = key === service;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go(key)}
              aria-pressed={current}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all',
                current
                  ? 'border-spoto-purple bg-spoto-purple/10 shadow-sm'
                  : 'border-spoto-line bg-spoto-surface hover:border-spoto-purple/40 hover:bg-spoto-surface-2',
              )}
            >
              <Icon
                className={cn('size-6', current ? 'text-spoto-purple-ink' : 'text-spoto-muted')}
              />
              <span
                className={cn(
                  'font-heading text-sm font-bold',
                  current ? 'text-spoto-ink' : 'text-spoto-muted',
                )}
              >
                {label}
              </span>
              <span className="text-[10px] leading-tight text-spoto-muted">{blurb}</span>
            </button>
          );
        })}
      </div>

      {/* Auth screen for the current service. */}
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-2xl border border-spoto-line bg-spoto-surface p-6 shadow-sm"
      >
        <p className="text-sm text-spoto-muted">
          Signing in to <span className="font-heading font-bold text-spoto-ink">{active.label}</span>
        </p>

        <label className="flex flex-col gap-1 text-sm text-spoto-muted">
          Username
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. manager1"
          />
        </label>

        {/* PIN dots */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-spoto-muted">PIN</span>
          <div className="flex items-center justify-center gap-3 py-1">
            {Array.from({ length: Math.max(PIN_MIN, pin.length) }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'size-3 rounded-full transition-colors',
                  i < pin.length ? 'bg-spoto-purple' : 'bg-spoto-line',
                )}
              />
            ))}
          </div>
        </div>

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Button
              key={d}
              type="button"
              variant="secondary"
              size="lg"
              className="text-lg"
              onClick={() => pushDigit(d)}
            >
              {d}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setPin('')}
            disabled={pin.length === 0}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="text-lg"
            onClick={() => pushDigit('0')}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            aria-label="Backspace"
            onClick={backspace}
            disabled={pin.length === 0}
          >
            <Delete className="size-5" />
          </Button>
        </div>

        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {loading ? 'Signing in…' : `Sign in to ${active.label}`}
        </Button>
      </form>
    </div>
  );
}
