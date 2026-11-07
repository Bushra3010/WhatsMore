import type { Metadata } from 'next';
import { Dashboard } from '@/components/admin/Dashboard';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Page() {
  await requireAdmin();
  return <Dashboard />;
}
