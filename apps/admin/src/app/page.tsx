'use client';

import { SessionProvider, useSession } from '@/lib/session';
import { Login } from '@/components/Login';
import { Dashboard } from '@/components/Dashboard';

function Gate() {
  const { ready, token } = useSession();
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-spoto-muted">Loading…</div>;
  }
  return token ? <Dashboard /> : <Login />;
}

export default function Page() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
