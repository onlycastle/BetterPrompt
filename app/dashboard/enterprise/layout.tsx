/**
 * Enterprise Layout
 * Guards all enterprise dashboard pages behind organization membership.
 * The setup page is exempted — admins without an org are redirected there
 * and must be able to see it to create their organization.
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isEnterpriseAllowed } from '@/lib/enterprise-access';

export default function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasAccess = isEnterpriseAllowed(user?.organizationId);
  const isSetupPage = pathname === '/dashboard/enterprise/setup';

  useEffect(() => {
    if (!isLoading && !hasAccess && !isSetupPage) {
      // Redirect to setup if user is admin but has no org, otherwise to analyze
      if (user?.role === 'admin') {
        router.replace('/dashboard/enterprise/setup');
      } else {
        router.replace('/dashboard/analyze');
      }
    }
  }, [user, isLoading, hasAccess, isSetupPage, router]);

  if (isLoading) return null;
  // Allow setup page through even without org access (admin needs to create org here)
  if (!hasAccess && !isSetupPage) return null;

  return <>{children}</>;
}
