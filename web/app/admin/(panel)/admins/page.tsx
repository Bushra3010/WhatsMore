import type { Metadata } from 'next';
import { Admins } from '@/components/admin/Admins';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Admins' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin({ owner: true });
  return <Admins />;
}
