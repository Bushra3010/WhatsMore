import 'server-only';
// Server-side admin check for every Command Center layout and page.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { adminServerClient, currentAdmin } from '@/lib/supabase/admin-server';

/** admin_me for this request (deduplicated across the layout and page). */
export const getAdmin = cache(currentAdmin);

/**
 * The signed-in admin, or a redirect to the sign-in page. A session that is not an admin's goes to
 * /admin/login?m=not-admin, where it is signed out with the original "not an admin" message.
 * `owner: true` sends moderators back to the dashboard.
 */
export async function requireAdmin(opts: { owner?: boolean } = {}) {
  const me = await getAdmin();
  if (!me) {
    const { data } = await (await adminServerClient()).auth.getClaims();
    redirect(data?.claims ? '/admin/login?m=not-admin' : '/admin/login');
  }
  if (opts.owner && me.role !== 'owner') redirect('/admin/dashboard');
  return me;
}
