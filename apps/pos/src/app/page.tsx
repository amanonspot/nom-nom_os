import { Button, StatusBadge } from '@nomnom/ui';

// Phase 0 shell. Phase 1 replaces this with the offline-first POS
// (category tabs → item/variant dialog → order → KOT → GST bill).
const demoTables = [
  { id: 1, name: 'T1', status: 'free' as const },
  { id: 2, name: 'T2', status: 'occupied' as const },
  { id: 3, name: 'T3', status: 'free' as const },
  { id: 4, name: 'T4', status: 'occupied' as const },
];

export default function PosHome() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">Nom Nom OS</p>
          <h1 className="font-display text-3xl font-bold text-fg">Point of Sale</h1>
        </div>
        <StatusBadge tone="warning">offline-ready</StatusBadge>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-fg">Floor</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {demoTables.map((t) => (
            <div
              key={t.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg p-6"
            >
              <span className="font-display text-xl font-semibold text-fg">{t.name}</span>
              <StatusBadge tone={t.status}>{t.status}</StatusBadge>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-3">
        <StatusBadge tone="veg">Veg</StatusBadge>
        <StatusBadge tone="nonveg">Non-veg</StatusBadge>
        <Button className="ml-auto">New order</Button>
      </section>
    </main>
  );
}
