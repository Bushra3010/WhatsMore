'use client';
// Supabase client for the WHATSMORE app (live chats, realtime, calls, stories). The session is kept in
// the browser, separate from the admin panel's cookie session.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;
export function appSupabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'wm-app-auth' } });
  return client;
}
