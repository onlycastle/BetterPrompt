/**
 * Legacy Personal Page
 * Redirects to new dashboard location
 */

import { redirect } from 'next/navigation';

export default function PersonalPage() {
  redirect('/dashboard/personal');
}
