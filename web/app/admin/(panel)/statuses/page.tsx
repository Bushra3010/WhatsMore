import type { Metadata } from 'next';
import { Statuses } from '@/components/admin/Statuses';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Statuses' };

export default async function Page() {
  await requireAdmin();
  return <Statuses />;
}
