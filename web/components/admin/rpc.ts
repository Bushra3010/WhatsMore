'use client';
// Every read and change goes through admin_* database functions, which refuse anyone not on the
// admins list and write each change to the audit log. Errors are shown as a toast, then rethrown.
import { adminBrowserClient } from '@/lib/supabase/admin-browser';
import { toast } from './feedback';

export const sb = () => adminBrowserClient();

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) { toast(error.message); throw error; }
  return data as T;
}
