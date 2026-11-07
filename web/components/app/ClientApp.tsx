'use client';
import dynamic from 'next/dynamic';

// Rendered only in the browser: everything depends on localStorage, media devices and Supabase sessions.
const AppShell = dynamic(() => import('./AppShell'), { ssr: false, loading: () => <div className="app-loading" aria-busy="true" /> });

export default function ClientApp() {
  return <AppShell />;
}
