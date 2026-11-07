'use client';
import { useRef, useState } from 'react';
import { Topbar, useAdmin } from './AdminShell';
import { toast } from './feedback';
import { isFuture, when } from './format';
import { rpc } from './rpc';
import { useLoad } from './useLoad';

type ReportRow = {
  id: string; category: string; target_kind: string; status: 'open' | 'actioned' | 'dismissed'; created_at: string;
  details: string | null; resolution: string | null; resolved_at: string | null; target_label?: string | null;
  target_user: string | null; target_message: string | null; reporter_username: string | null;
  target_username: string | null; target_name: string | null; target_suspended_until: string | null;
  message_body: string | null; message_kind: string | null; message_caption: string | null; message_file: string | null;
  message_deleted_at: string | null; message_sender: string | null;
};
type Tab = 'open' | 'actioned' | 'dismissed' | 'all';
type Act = 'dismiss' | 'remove' | 'suspend' | 'both';

const TABS: [Tab, string][] = [['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']];
const DONE: Record<Act, string> = { dismiss: 'Report dismissed', remove: 'Message removed for everyone', suspend: 'Account suspended for 7 days', both: 'Message removed and account suspended' };
let savedTab: Tab = 'open';

function ReportCard({ r, now, onDone }: { r: ReportRow; now: number; onDone: () => void }) {
  const note = useRef<HTMLInputElement>(null);
  const content = r.target_message
    ? r.message_deleted_at
      ? <div className="cc-quote gone">Message already removed</div>
      : <div className="cc-quote">{r.message_body || r.message_caption || (r.message_file ? '📎 ' + r.message_file : '[' + (r.message_kind || 'message') + ']')}</div>
    : null;
  const who = r.target_username ? `@${r.target_username}${r.target_name ? ' (' + r.target_name + ')' : ''}` : r.target_label || '—';
  const suspended = isFuture(r.target_suspended_until, now);
  const live = !!r.target_message && !r.message_deleted_at;
  const person = !!(r.target_user || r.message_sender);

  const act = async (d: Act) => {
    try {
      await rpc('admin_resolve_report', {
        rid: r.id, outcome: d === 'dismiss' ? 'dismissed' : 'actioned', note: note.current?.value.trim() || '',
        remove_message: d === 'remove' || d === 'both', suspend_days: d === 'suspend' || d === 'both' ? 7 : 0,
      });
      toast(DONE[d]);
      onDone();
    } catch { /* shown */ }
  };

  return (
    <div className="card report">
      <div className="head">
        <span className="cc-pill bad">{r.category}</span>
        <span className="cc-pill">{r.target_kind}</span>
        {r.status !== 'open' ? <span className={'cc-pill' + (r.status === 'actioned' ? ' good' : '')}>{r.status === 'actioned' ? 'Actioned' : 'Dismissed'}</span> : null}
        {suspended ? <span className="cc-pill warn">Suspended</span> : null}
        <span className="muted small">{when(r.created_at)} · reported by @{r.reporter_username || 'deleted user'}</span>
      </div>
      <div><b>Reported:</b> {who}</div>
      {content}
      {r.details ? <div className="muted">“{r.details}”</div> : null}
      {r.status === 'open' ? (
        <div className="actions-row">
          <input placeholder="Note (optional)" ref={note} maxLength={300} aria-label="Note" />
          <button className="cc-btn sm" type="button" onClick={() => act('dismiss')}>Dismiss</button>
          {live ? <button className="cc-btn sm danger" type="button" onClick={() => act('remove')}>Remove message</button> : null}
          {person && !suspended ? <button className="cc-btn sm danger" type="button" onClick={() => act('suspend')}>Suspend 7 days</button> : null}
          {live && person ? <button className="cc-btn sm danger" type="button" onClick={() => act('both')}>Remove + suspend</button> : null}
        </div>
      ) : (
        <div className="muted small">{r.resolution ? '“' + r.resolution + '” · ' : ''}{when(r.resolved_at)}</div>
      )}
    </div>
  );
}

export function Reports() {
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<Tab>(savedTab);
  const { data, fresh, reload: load } = useLoad(async () => {
    const list = await rpc<ReportRow[]>('admin_reports', { st: tab });
    void refreshCounts();
    return { list, tab, now: Date.now() };
  }, tab);

  const tabs = (
    <div className="cc-seg" role="tablist">
      {TABS.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { savedTab = k; setTab(k); }}>{l}</button>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (!data || !fresh) body = <div className="empty">Loading…</div>;
  else if (!data.list.length) body = <div className="card empty">{data.tab === 'open' ? '✓ No open reports.' : 'Nothing here.'}</div>;
  else body = data.list.map((r) => <ReportCard key={r.id} r={r} now={data.now} onDone={load} />);

  return (
    <>
      <Topbar title="Reports" tools={tabs} onRefresh={load} />
      <div id="rlist">{body}</div>
    </>
  );
}
