'use client';

import { LayoutGrid, LogOut, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { cn } from '@nomnom/ui';
import type { Me } from '@nomnom/types';

export type Tab = 'menu' | 'tables';

const NAV: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { key: 'tables', label: 'Tables', icon: LayoutGrid },
];

/*
 * Ranger-style admin shell (adapted from spotorangeradmin/admin-shell): a fixed
 * left side-nav on desktop, a bottom nav on mobile, and a scrolling content
 * column. Tab-driven (this admin is a single route).
 */
export function AppShell({
  tab,
  setTab,
  me,
  onLogout,
  children,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  me: Me | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-spoto-bg">
      {/* Desktop side-nav */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-spoto-line bg-spoto-surface px-4 py-6 lg:flex">
        <div className="flex flex-col items-start gap-1 px-2">
          <span className="font-heading text-xl font-bold text-spoto-ink">Nom Nom OS</span>
          <p className="pl-0.5 text-[10px] font-heading font-semibold uppercase tracking-[0.3em] text-spoto-purple-ink">
            Admin
          </p>
        </div>

        <nav className="mt-8 grid gap-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <NavButton
              key={key}
              label={label}
              icon={Icon}
              active={tab === key}
              onClick={() => setTab(key)}
            />
          ))}
        </nav>

        <div className="mt-auto border-t border-spoto-line pt-4">
          <p className="px-2 text-sm font-heading font-semibold text-spoto-ink">
            {me?.restaurant?.name ?? 'Restaurant'}
          </p>
          <p className="px-2 text-xs text-spoto-muted">{me?.branch?.name ?? ''}</p>
          <button
            onClick={onLogout}
            className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-spoto px-3 text-sm font-heading font-semibold text-spoto-muted transition-colors hover:bg-spoto-surface-2 hover:text-spoto-ink"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-spoto-line bg-spoto-surface px-4 py-3 lg:hidden">
        <span className="font-heading text-lg font-bold text-spoto-ink">Nom Nom OS</span>
        <button onClick={onLogout} className="text-sm text-spoto-muted underline">
          Sign out
        </button>
      </header>

      {/* Content */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-spoto-line bg-spoto-surface lg:hidden">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-heading font-semibold',
              tab === key ? 'text-spoto-purple-ink' : 'text-spoto-muted',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-spoto px-3 font-heading font-semibold transition-colors',
        active
          ? 'bg-spoto-purple/15 text-spoto-purple-ink'
          : 'text-spoto-muted hover:bg-spoto-surface-2 hover:text-spoto-ink',
      )}
    >
      <Icon aria-hidden className="h-5 w-5" />
      {label}
    </button>
  );
}
