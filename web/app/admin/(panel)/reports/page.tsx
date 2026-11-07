import type { Metadata } from 'next';
import { Reports } from '@/components/admin/Reports';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Reports' };

export default async function Page() {
  await requireAdmin();
  return <Reports />;
}
