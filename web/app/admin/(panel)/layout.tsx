import { Suspense } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '../_lib/auth';

// Checks admin rights on the server (admin_me via the wm-admin cookie session) before anything renders.
async function AdminGate({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return <AdminShell me={me}>{children}</AdminShell>;
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="login"><div className="empty">Loading…</div></div>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
