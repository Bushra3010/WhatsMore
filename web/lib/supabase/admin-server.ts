import 'server-only';
// Supabase client for Command Center server components and server actions (cookie session).
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export async function adminServerClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: { name: 'wm-admin' },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server components can't set cookies; proxy.ts refreshes the session instead.
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ }
      },
    },
  });
}

/** The signed-in admin (from admin_me), or null when not signed in / not an admin. */
export async function currentAdmin(): Promise<{ user_id: string; role: 'owner' | 'moderator'; name: string; username: string } | null> {
  const sb = await adminServerClient();
  const { data: claims } = await sb.auth.getClaims();
  if (!claims?.claims) return null;
  const { data, error } = await sb.rpc('admin_me');
  return error || !data ? null : data;
}
