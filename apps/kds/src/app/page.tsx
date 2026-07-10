'use client';

import { KdsProvider, useKds } from '@/lib/kds';
import { Login } from '@/components/Login';
import { Board } from '@/components/Board';

function Gate() {
  const { ready, session } = useKds();
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-spoto-muted">Loading…</div>;
  }
  return session ? <Board /> : <Login />;
}

export default function Page() {
  return (
    <KdsProvider>
      <Gate />
    </KdsProvider>
  );
}
