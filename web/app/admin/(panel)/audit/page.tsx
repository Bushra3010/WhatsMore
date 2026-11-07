import type { Metadata } from 'next';
import { AuditLog } from '@/components/admin/AuditLog';
import { requireAdmin } from '../../_lib/auth';

export const metadata: Metadata = { title: 'Audit log' };

export default async function Page() {
  await requireAdmin();
  return <AuditLog />;
}
