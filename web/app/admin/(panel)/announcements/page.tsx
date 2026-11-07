import type { Metadata } from 'next';
import { Announcements } from '@/components/admin/Announcements';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Announcements' };

export default async function Page() {
  await requireAdmin();
  return <Announcements />;
}
