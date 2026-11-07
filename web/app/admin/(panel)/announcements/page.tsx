import type { Metadata } from 'next';
import { Announcements } from '@/components/admin/Announcements';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Announcements' };

// waits for the per-request admin check on the server, by design
export const instant = false;

export default async function Page() {
  await requireAdmin();
  return <Announcements />;
}
