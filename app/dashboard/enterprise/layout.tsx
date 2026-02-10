/**
 * Enterprise Layout
 * Guards all enterprise dashboard pages behind email whitelist
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isEnterpriseAllowed } from '@/lib/enterprise-access';

export default function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isEnterpriseAllowed(user?.email ?? undefined)) {
      router.replace('/dashboard/analyze');
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!isEnterpriseAllowed(user?.email ?? undefined)) return null;

  return <>{children}</>;
}
