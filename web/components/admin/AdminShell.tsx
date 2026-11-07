'use client';
// Command Center frame: left navigation with open-queue counts, the signed-in admin and Sign out.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DialogHost, Toaster } from './feedback';
import { timeZone, type Admin, type Stats } from './format';
import { Logo } from './Logo';
import { rpc, sb } from './rpc';

const SECTIONS: [string, string][] = [
  ['dashboard', 'Dashboard'], ['users', 'Users'], ['reports', 'Reports'], ['verification', 'Verification'],
  ['statuses', 'Statuses'], ['announcements', 'Announcements'], ['audit', 'Audit log'], ['admins', 'Admins'],
];

type Ctx = { me: Admin; refreshCounts: () => Promise<void>; setCountsFrom: (s: Stats) => void };
const AdminCtx = createContext<Ctx | null>(null);

export function useAdmin() {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin must be used inside <AdminShell>');
  return c;
}

const SIGNED_OUT = '/admin/login?m=signed-out';

export function AdminShell({ me, children }: { me: Admin; children: ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const setCountsFrom = useCallback((s: Stats) => setCounts({ reports: s.reports_open, verification: s.verifications_pending }), []);
  const refreshCounts = useCallback(async () => {
    try { setCountsFrom(await rpc<Stats>('admin_stats', { tz: timeZone() })); } catch { /* toast already shown */ }
  }, [setCountsFrom]);

  useEffect(() => {
    let live = true;
    rpc<Stats>('admin_stats', { tz: timeZone() }).then((s) => { if (live) setCountsFrom(s); }, () => { /* toast already shown */ });
    return () => { live = false; };
  }, [setCountsFrom]);
  useEffect(() => {
    // Signed out in another tab (or the session ended): back to the sign-in page.
    const { data } = sb().auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') window.location.replace(SIGNED_OUT); });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await sb().auth.signOut();
    window.location.replace(SIGNED_OUT);
  };

  const ctx = useMemo(() => ({ me, refreshCounts, setCountsFrom }), [me, refreshCounts, setCountsFrom]);
  const section = pathname.split('/')[2] || 'dashboard';

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="shell">
        <nav className="nav" aria-label="Command Center">
          <div className="brand-row"><Logo /><div>WHATSMORE<div className="muted small">Command Center</div></div></div>
          {SECTIONS.filter(([k]) => k !== 'admins' || me.role === 'owner').map(([k, l]) => (
            <Link key={k} href={`/admin/${k}`} className={'nav-item' + (k === section ? ' on' : '')} aria-current={k === section ? 'page' : undefined}>
              {l}
              {counts[k] ? <span className="count">{counts[k]}</span> : null}
            </Link>
          ))}
          {/* phones hide the signed-in box below, so Sign out also sits at the end of the nav row */}
          <a href="#" className="nav-item phone-only" onClick={signOut}>Sign out</a>
          <div className="grow" />
          <div className="who">
            {me.name || ''} · @{me.username || ''}
            <br />
            {me.role === 'owner' ? 'Owner' : 'Moderator'} · <a href="#" onClick={signOut}>Sign out</a>
          </div>
        </nav>
        <main className="cc-main" id="main">{children}</main>
      </div>
      <DialogHost />
      <Toaster />
    </AdminCtx.Provider>
  );
}

/** Page heading with optional tools and the Refresh button. */
export function Topbar({ title, tools, onRefresh }: { title: string; tools?: ReactNode; onRefresh: () => void }) {
  return (
    <div className="topbar">
      <h2>{title}</h2>
      <div className="tools">
        {tools}
        <button className="cc-btn sm" type="button" onClick={onRefresh}>Refresh</button>
      </div>
    </div>
  );
}
