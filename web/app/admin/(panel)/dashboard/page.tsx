import type { Metadata } from 'next';
import { Dashboard } from '@/components/admin/Dashboard';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Dashboard' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin();
  return <Dashboard />;
}
