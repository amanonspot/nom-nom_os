'use client';

import { PosProvider, usePos } from '@/lib/pos';
import { Login } from '@/components/Login';
import { PosScreen } from '@/components/PosScreen';

function Gate() {
  const { ready, session } = usePos();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
    );
  }
  return session ? <PosScreen /> : <Login />;
}

export default function Page() {
  return (
    <PosProvider>
      <Gate />
    </PosProvider>
  );
}
