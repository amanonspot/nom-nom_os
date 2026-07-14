'use client';

import { useState } from 'react';
import { LoginPortal, type LoginService } from '@nomnom/ui';
import { useKds } from '@/lib/kds';

const SERVICE_URLS: Record<LoginService, string> = {
  pos: process.env.NEXT_PUBLIC_POS_URL ?? 'http://localhost:9101',
  kds: process.env.NEXT_PUBLIC_KDS_URL ?? 'http://localhost:9102',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:9100',
};

export function Login() {
  const { login } = useKds();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(username: string, pin: string) {
    setLoading(true);
    setError(null);
    try {
      await login(username, pin);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid username or PIN');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginPortal
      service="kds"
      urls={SERVICE_URLS}
      onSubmit={onSubmit}
      error={error}
      loading={loading}
    />
  );
}
