import type { Metadata } from 'next';
import { Verification } from '@/components/admin/Verification';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Verification' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin();
  return <Verification />;
}
