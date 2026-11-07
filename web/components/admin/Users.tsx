'use client';
import { useEffect, useRef, useState } from 'react';
import { Topbar, useAdmin } from './AdminShell';
import { dialog, toast } from './feedback';
import { ago, BADGES, isFuture, num, when } from './format';
import { rpc } from './rpc';
import { useLoad } from './useLoad';

type UserRow = {
  id: string; email: string | null; created_at: string; last_sign_in_at: string | null;
  username: string | null; name: string | null; badge: string | null;
  suspended_until: string | null; suspend_reason: string | null;
  messages: number; chats: number; open_reports: number; admin_role: 'owner' | 'moderator' | null;
};

let savedQuery = ''; // kept while moving between sections, like the original

export function Users() {
  const { me } = useAdmin();
  const [q, setQ] = useState(savedQuery);
  const [badges, setBadges] = useState<Record<string, string | null>>({}); // changed since the last load
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data, reload: load } = useLoad(async () => {
    const list = await rpc<UserRow[]>('admin_users', { q, lim: 100, off: 0 });
    setBadges({});
    return { list, q, now: Date.now() };
  }, q);
  useEffect(() => () => clearTimeout(debounce.current), []);

  const badgeOf = (u: UserRow) => (u.id in badges ? badges[u.id] : u.badge);

  const setBadge = async (u: UserRow, e: React.ChangeEvent<HTMLSelectElement>) => {
    const el = e.target, b = el.value;
    try {
      await rpc('admin_set_badge', { u: u.id, b });
      setBadges((m) => ({ ...m, [u.id]: b || null }));
      toast(b ? `@${u.username} is now ${BADGES[b]}` : `Badge removed from @${u.username}`);
    } catch { el.value = badgeOf(u) || ''; }
  };

  const suspend = async (u: UserRow) => {
    const v = await dialog({
      title: `Suspend @${u.username}?`, ok: 'Suspend', danger: true,
      body: (
        <>
          <p className="muted">They can still sign in and read, but cannot send messages, post statuses or start chats.</p>
          <label className="cc-field">For
            <select name="days" defaultValue="7">
              <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="3650">Indefinitely</option>
            </select>
          </label>
          <label className="cc-field">Reason (shown to them)<input name="reason" maxLength={300} placeholder="e.g. Spam reported by several people" /></label>
        </>
      ),
    });
    if (!v) return;
    try { await rpc('admin_suspend', { u: u.id, days: +v.days, reason: v.reason || 'Breaking WHATSMORE rules' }); toast(`@${u.username} suspended`); load(); } catch { /* shown */ }
  };

  const unsuspend = async (u: UserRow) => {
    try { await rpc('admin_suspend', { u: u.id, days: 0, reason: '' }); toast(`@${u.username} can send again`); load(); } catch { /* shown */ }
  };

  const remove = async (u: UserRow) => {
    const v = await dialog({
      title: `Delete @${u.username}?`, ok: 'Delete account', danger: true,
      body: (
        <>
          <p className="muted">This permanently deletes their account, profile, messages, statuses and memberships. It cannot be undone.</p>
          <label className="cc-field"><span>Type <b>{u.username}</b> to confirm</span><input name="confirm" autoComplete="off" /></label>
          <label className="cc-field">Reason (for the audit log)<input name="reason" maxLength={200} /></label>
        </>
      ),
    });
    if (!v) return;
    if (v.confirm.trim().toLowerCase() !== String(u.username).toLowerCase()) return toast('Username did not match — nothing deleted');
    try { await rpc('admin_delete_user', { u: u.id, reason: v.reason || '' }); toast(`@${u.username} deleted`); load(); } catch { /* shown */ }
  };

  const search = (
    <input
      className="cc-search" placeholder="Search name, @username or email" defaultValue={q} style={{ width: 260 }} aria-label="Search users"
      onChange={(e) => {
        const value = e.target.value.trim();
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => { savedQuery = value; setQ(value); }, 300);
      }}
    />
  );

  let body: React.ReactNode;
  if (!data) body = <div className="empty">Loading…</div>;
  else if (!data.list.length) body = <div className="empty">{data.q ? `No users match “${data.q}”.` : 'No users yet.'}</div>;
  else body = (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Joined</th><th>Last sign-in</th><th className="num">Messages</th><th className="num">Chats</th><th>Status</th><th>Badge</th><th>Actions</th></tr></thead>
          <tbody>
            {data.list.map((u) => {
              const susp = isFuture(u.suspended_until, data.now);
              return (
                <tr key={u.id}>
                  <td className="user-cell">
                    <b>{u.name || '—'}{u.admin_role ? <> <span className="cc-pill cc-badge">{u.admin_role === 'owner' ? 'Owner' : 'Moderator'}</span></> : null}</b>
                    <span>@{u.username || '—'} · {u.email || ''}</span>
                  </td>
                  <td className="nw">{when(u.created_at)}</td>
                  <td className="nw">{ago(u.last_sign_in_at, data.now)}</td>
                  <td className="num">{num(u.messages)}</td>
                  <td className="num">{num(u.chats)}</td>
                  <td>
                    {susp ? <span className="cc-pill bad" title={u.suspend_reason || ''}>Suspended until {when(u.suspended_until)}</span> : <span className="cc-pill good">Active</span>}
                    {u.open_reports ? <> <span className="cc-pill warn">{u.open_reports} report{u.open_reports > 1 ? 's' : ''}</span></> : null}
                  </td>
                  <td>
                    <select key={badgeOf(u) || ''} defaultValue={badgeOf(u) || ''} aria-label={`Badge for @${u.username || ''}`} onChange={(e) => setBadge(u, e)}>
                      <option value="">None</option>
                      {Object.entries(BADGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      {u.admin_role ? null : susp
                        ? <button className="cc-btn sm" type="button" onClick={() => unsuspend(u)}>Unsuspend</button>
                        : <button className="cc-btn sm danger" type="button" onClick={() => suspend(u)}>Suspend</button>}
                      {me.role === 'owner' && !u.admin_role ? <button className="cc-btn sm danger" type="button" onClick={() => remove(u)}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Showing the newest {data.list.length} accounts. Badges show next to the person&apos;s name in WHATSMORE.</p>
    </>
  );

  return (
    <>
      <Topbar title="Users" tools={search} onRefresh={load} />
      <div className="card">{body}</div>
    </>
  );
}
