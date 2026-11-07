'use client';
// Supabase client for the Command Center in the browser. The session lives in cookies so server
// components can check admin rights before rendering a page.
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const adminBrowserClient = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { cookieOptions: { name: 'wm-admin' } });
