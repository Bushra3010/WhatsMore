'use client';
import { Topbar } from './AdminShell';
import { dialog, toast } from './feedback';
import { ago } from './format';
import { useLoad } from './useLoad';
import { rpc, sb } from './rpc';

type StatusRow = {
  id: string; kind: 'text' | 'image' | 'voice' | string; body: string | null; caption: string | null; audience: string;
  created_at: string; expires_at: string; media_path: string | null; username: string | null; name: string | null;
};
const AUD: Record<string, string> = { everyone: 'Everyone', contacts: 'Contacts', close: 'Close friends', private: 'Only them' };

export function Statuses() {
  const { data, reload: load } = useLoad(async () => ({ list: await rpc<StatusRow[]>('admin_recent_statuses'), now: Date.now() }));

  const remove = async (s: StatusRow) => {
    const v = await dialog({
      title: 'Remove this status?', ok: 'Remove', danger: true,
      body: <label className="cc-field">Reason (for the audit log)<input name="reason" maxLength={200} /></label>,
    });
    if (!v) return;
    try {
      const path = await rpc<string | null>('admin_remove_status', { sid: s.id, reason: v.reason || '' });
      if (path) { try { await sb().storage.from('status-media').remove([path]); } catch { /* file may already be gone */ } }
      toast('Status removed');
      load();
    } catch { /* shown */ }
  };

  let body: React.ReactNode;
  if (!data) body = <div className="empty">Loading…</div>;
  else if (!data.list.length) body = <div className="empty">No live statuses right now.</div>;
  else body = (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Posted by</th><th>Status</th><th>Audience</th><th>Posted</th><th></th></tr></thead>
        <tbody>
          {data.list.map((s) => (
            <tr key={s.id}>
              <td className="user-cell"><b>{s.name || '—'}</b><span>@{s.username || ''}</span></td>
              <td>{s.kind === 'text' ? s.body : <><span className="cc-pill">{s.kind === 'voice' ? 'Voice' : 'Photo'}</span> {s.caption || ''}</>}</td>
              <td>{AUD[s.audience] || s.audience}</td>
              <td className="nw">{ago(s.created_at, data.now)}</td>
              <td><button className="cc-btn sm danger" type="button" onClick={() => remove(s)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Topbar title="Live statuses" onRefresh={load} />
      <div className="notice">Statuses disappear after 24 hours. Remove one here if it breaks the rules — it disappears for everyone straight away.</div>
      <div className="card" id="slist">{body}</div>
    </>
  );
}
