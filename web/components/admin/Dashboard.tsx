'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Topbar, useAdmin } from './AdminShell';
import { BarChart } from './BarChart';
import { bytes, num, timeZone, type Stats } from './format';
import { rpc } from './rpc';
import { useLoad } from './useLoad';

const KIND: Record<string, string> = { text: 'Text', image: 'Photos', video: 'Videos', voice: 'Voice notes', doc: 'Documents', rich: 'Polls, events & more', deleted: 'Deleted' };

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return <div className={'cc-kpi' + (alert ? ' alert' : '')}><span>{label}</span><b>{value}</b>{sub ? <small>{sub}</small> : null}</div>;
}

export function Dashboard() {
  const router = useRouter();
  const { setCountsFrom } = useAdmin();
  const { data, reload: load } = useLoad(async () => {
    const s = await rpc<Stats>('admin_stats', { tz: timeZone() });
    setCountsFrom(s);
    return { s, at: new Date() };
  });

  // Live data: refresh every minute while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <><Topbar title="Dashboard" onRefresh={load} /><div className="empty">Loading…</div></>;
  const { s, at } = data;
  const kinds = Object.entries(s.by_kind || {}).sort((a, b) => b[1] - a[1]);
  const kmax = Math.max(1, ...kinds.map((k) => k[1]));

  return (
    <>
      <Topbar
        title="Dashboard" onRefresh={load}
        tools={<span className="muted small">Live data · updated {at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
      />
      <div className="kpis">
        <Kpi label="Total users" value={num(s.users)} sub={`+${num(s.users_today)} today · +${num(s.users_7d)} in 7 days`} />
        <Kpi label="Active today" value={num(s.active_24h)} sub={`${num(s.signed_in_24h)} signed in`} />
        <Kpi label="Messages today" value={num(s.messages_today)} sub={`${num(s.messages)} in total`} />
        <Kpi label="Chats" value={num(s.direct_chats + s.groups)} sub={`${num(s.direct_chats)} 1:1 · ${num(s.groups)} groups`} />
        <Kpi label="Live statuses" value={num(s.statuses_live)} sub="Expire after 24 h" />
        <Kpi label="Files stored" value={num(s.files)} sub={bytes(s.storage_bytes)} />
        <Kpi label="Open reports" value={num(s.reports_open)} sub={s.reports_open ? 'Needs review' : 'All clear'} alert={s.reports_open > 0} />
        <Kpi label="Verification requests" value={num(s.verifications_pending)} sub={`${num(s.verified)} verified accounts`} />
        <Kpi label="Suspended accounts" value={num(s.suspended)} />
      </div>
      <div className="grid2">
        <div className="card"><h3>New sign-ups per day</h3><p className="sub">Last 14 days · {s.tz} time</p><BarChart rows={s.daily || []} k="signups" label="Sign-ups" /></div>
        <div className="card"><h3>Messages per day</h3><p className="sub">Last 14 days · all chats</p><BarChart rows={s.daily || []} k="messages" label="Messages" /></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Messages by type</h3><p className="sub">All time</p>
          {kinds.length ? kinds.map(([k, n]) => (
            <div className="hbar" key={k}>
              <span>{KIND[k] || k}</span>
              <div className="cc-track"><div className="fill" style={{ width: `${(n / kmax) * 100}%` }} /></div>
              <b>{num(n)}</b>
            </div>
          )) : <div className="empty">No messages yet</div>}
        </div>
        <div className="card attn">
          <h3>Needs attention</h3><p className="sub">Open queues</p>
          <div className="hbar">
            <span>Reports</span>
            <span>{s.reports_open ? <span className="cc-pill bad">{num(s.reports_open)} open</span> : <span className="cc-pill good">✓ None open</span>}</span>
            <button className="cc-btn sm" type="button" onClick={() => router.push('/admin/reports')}>Review</button>
          </div>
          <div className="hbar">
            <span>Verification</span>
            <span>{s.verifications_pending ? <span className="cc-pill warn">{num(s.verifications_pending)} pending</span> : <span className="cc-pill good">✓ None pending</span>}</span>
            <button className="cc-btn sm" type="button" onClick={() => router.push('/admin/verification')}>Review</button>
          </div>
          <p className="muted small">Calls go directly between people&apos;s browsers and are not stored, so the Command Center does not count them.</p>
        </div>
      </div>
    </>
  );
}
