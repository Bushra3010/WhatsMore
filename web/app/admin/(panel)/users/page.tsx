import type { Metadata } from 'next';
import { Users } from '@/components/admin/Users';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Users' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin();
  return <Users />;
}
