import type { Metadata } from 'next';
import { Verification } from '@/components/admin/Verification';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Verification' };

export default async function Page() {
  await requireAdmin();
  return <Verification />;
}
