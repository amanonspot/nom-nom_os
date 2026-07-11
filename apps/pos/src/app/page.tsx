'use client';

import { PosProvider, usePos } from '@/lib/pos';
import { Login } from '@/components/Login';
import { PosApp } from '@/components/PosApp';

function Gate() {
  const { ready, session } = usePos();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-spoto-muted">Loading…</div>
    );
  }
  return session ? <PosApp /> : <Login />;
}

export default function Page() {
  return (
    <PosProvider>
      <Gate />
    </PosProvider>
  );
}
