import type { Metadata } from 'next';
import { Statuses } from '@/components/admin/Statuses';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Statuses' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin();
  return <Statuses />;
}
