import type { Metadata } from 'next';
import { Users } from '@/components/admin/Users';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Users' };

export default async function Page() {
  await requireAdmin();
  return <Users />;
}
