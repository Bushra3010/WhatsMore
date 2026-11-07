'use client';
import { Topbar } from './AdminShell';
import { toast } from './feedback';
import { when } from './format';
import { useLoad } from './useLoad';
import { rpc } from './rpc';

type AnnouncementRow = { id: string; title: string; body: string; level: 'info' | 'warning' | 'critical'; active: boolean; created_at: string };

export function Announcements() {
  const { data: list, reload: load } = useLoad(() => rpc<AnnouncementRow[]>('admin_announcements'));

  const publish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    try {
      await rpc('admin_announce', { t: String(f.get('title')).trim(), b: String(f.get('body')).trim(), lvl: f.get('level') });
      toast('Announcement published');
      form.reset();
      load();
    } catch { /* shown */ }
  };

  const end = async (a: AnnouncementRow) => {
    try { await rpc('admin_end_announcement', { aid: a.id }); toast('Announcement ended'); load(); } catch { /* shown */ }
  };

  let body: React.ReactNode;
  if (!list) body = <div className="empty">Loading…</div>;
  else if (!list.length) body = <div className="empty">No announcements yet.</div>;
  else body = (
    <>
      <h3>Published</h3>
      <div className="table-wrap">
        <table>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td><span className={'cc-pill ' + (a.level === 'critical' ? 'bad' : a.level === 'warning' ? 'warn' : 'cc-badge')}>{a.level === 'critical' ? 'Critical' : a.level === 'warning' ? 'Warning' : 'Info'}</span></td>
                <td><b>{a.title}</b><div className="muted small">{a.body}</div></td>
                <td className="nw">{when(a.created_at)}</td>
                <td className="nw">{a.active ? <><span className="cc-pill good">Showing</span> <button className="cc-btn sm" type="button" onClick={() => end(a)}>End</button></> : <span className="cc-pill">Ended</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <>
      <Topbar title="Announcements" onRefresh={load} />
      <div className="card">
        <h3>New announcement</h3>
        <p className="sub">Shown as a banner to everyone signed in to WHATSMORE, straight away.</p>
        <form className="report" onSubmit={publish}>
          <label className="cc-field">Title<input name="title" maxLength={80} required /></label>
          <label className="cc-field">Message<textarea name="body" rows={3} maxLength={600} required /></label>
          <label className="cc-field">Type
            <select name="level" defaultValue="info">
              <option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option>
            </select>
          </label>
          <div className="actions-row"><button className="cc-btn primary" type="submit">Publish</button></div>
        </form>
      </div>
      <div className="card" id="alist">{body}</div>
    </>
  );
}
