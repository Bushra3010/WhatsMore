'use client';
import { Topbar, useAdmin } from './AdminShell';
import { dialog, toast } from './feedback';
import { when } from './format';
import { useLoad } from './useLoad';
import { rpc } from './rpc';

type AdminRow = { user_id: string; role: 'owner' | 'moderator'; added_at: string; username: string | null; name: string | null; email: string | null };

export function Admins() {
  const { me } = useAdmin();
  const { data: list, reload: load } = useLoad(() => rpc<AdminRow[]>('admin_list_admins'));

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const un = String(f.get('u')).trim().replace(/^@/, '').toLowerCase(), role = String(f.get('r'));
    try {
      const found = (await rpc<{ id: string; username: string | null }[]>('admin_users', { q: un, lim: 20, off: 0 })).find((u) => u.username === un);
      if (!found) return toast(`No account with @${un}`);
      await rpc('admin_set_admin', { u: found.id, r: role });
      toast(`@${un} is now ${role === 'owner' ? 'an owner' : 'a moderator'}`);
      form.reset();
      load();
    } catch { /* shown */ }
  };

  const remove = async (a: AdminRow) => {
    const who = a.username ? '@' + a.username : a.name || 'this admin';
    if (!(await dialog({ title: `Remove ${who} as admin?`, ok: 'Remove', danger: true, body: <p className="muted">They lose access to the Command Center straight away. Their WHATSMORE account is not affected.</p> }))) return;
    try { await rpc('admin_set_admin', { u: a.user_id, r: '' }); toast('Admin removed'); load(); } catch { /* shown */ }
  };

  return (
    <>
      <Topbar title="Admins" onRefresh={load} />
      <div className="card">
        <h3>Add an admin</h3>
        <p className="sub">Moderators handle reports, verification, statuses and announcements. Owners can also delete accounts and manage admins.</p>
        <form className="actions-row" onSubmit={add}>
          <input name="u" placeholder="@username" required aria-label="Username" />
          <select name="r" aria-label="Role" defaultValue="moderator"><option value="moderator">Moderator</option><option value="owner">Owner</option></select>
          <button className="cc-btn primary" type="submit">Add</button>
        </form>
      </div>
      <div className="card" id="admlist">
        {!list ? <div className="empty">Loading…</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Admin</th><th>Role</th><th>Since</th><th></th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.user_id}>
                    <td className="user-cell"><b>{a.name || '—'}</b><span>@{a.username || ''} · {a.email || ''}</span></td>
                    <td><span className="cc-pill cc-badge">{a.role === 'owner' ? 'Owner' : 'Moderator'}</span></td>
                    <td className="nw">{when(a.added_at)}</td>
                    <td>{a.user_id === me.user_id ? <span className="muted small">You</span> : <button className="cc-btn sm danger" type="button" onClick={() => remove(a)}>Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
