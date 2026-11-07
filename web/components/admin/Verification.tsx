'use client';
import { Topbar, useAdmin } from './AdminShell';
import { toast } from './feedback';
import { BADGES, when } from './format';
import { useLoad } from './useLoad';
import { rpc } from './rpc';

type VerificationRow = {
  id: string; user_id: string; badge: string; note: string | null; status: 'pending' | 'approved' | 'rejected';
  created_at: string; decided_at: string | null; username: string | null; name: string | null; current_badge: string | null;
};

export function Verification() {
  const { refreshCounts } = useAdmin();
  const { data: list, reload: load } = useLoad(async () => {
    const rows = await rpc<VerificationRow[]>('admin_verifications', { st: 'all' });
    void refreshCounts();
    return rows;
  });

  const decide = async (v: VerificationRow, approve: boolean) => {
    try {
      await rpc('admin_decide_verification', { vid: v.id, approve });
      toast(approve ? 'Approved — badge added' : 'Request rejected');
      load();
    } catch { /* shown */ }
  };

  let body: React.ReactNode;
  if (!list) body = <div className="empty">Loading…</div>;
  else if (!list.length) body = <div className="card empty">No verification requests yet. People request a badge from Settings → Profile in WHATSMORE.</div>;
  else body = (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Requested</th><th>Note</th><th>When</th><th>Decision</th></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td className="user-cell"><b>{v.name || '—'}</b><span>@{v.username || ''}{v.current_badge ? ' · now ' + (BADGES[v.current_badge] ?? v.current_badge) : ''}</span></td>
                <td><span className="cc-pill cc-badge">{BADGES[v.badge] ?? v.badge}</span></td>
                <td>{v.note || '—'}</td>
                <td className="nw">{when(v.created_at)}</td>
                <td>
                  {v.status === 'pending' ? (
                    <div className="row-actions">
                      <button className="cc-btn sm primary" type="button" onClick={() => decide(v, true)}>Approve</button>
                      <button className="cc-btn sm" type="button" onClick={() => decide(v, false)}>Reject</button>
                    </div>
                  ) : (
                    <><span className={'cc-pill' + (v.status === 'approved' ? ' good' : '')}>{v.status === 'approved' ? 'Approved' : 'Rejected'}</span> <span className="muted small nw">{when(v.decided_at)}</span></>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <Topbar title="Verification requests" onRefresh={load} />
      <div className="notice">Approve only after checking documents: Business (registered business), Creator (identity and audience), Official (registered organisation), Government (authorised department). A badge can be removed any time from Users.</div>
      <div id="vlist">{body}</div>
    </>
  );
}
