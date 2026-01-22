/**
 * Dashboard Index Page
 * Redirects to /dashboard/analyze
 */

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/dashboard/analyze');
}
