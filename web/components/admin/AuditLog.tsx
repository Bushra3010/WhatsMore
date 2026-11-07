'use client';
import { Topbar } from './AdminShell';
import { when } from './format';
import { useLoad } from './useLoad';
import { rpc } from './rpc';

type AuditRow = {
  id: number; action: string; target: string | null; details: Record<string, unknown> | null; created_at: string;
  admin_username: string | null; target_username: string | null;
};
const LABEL: Record<string, string> = {
  'badge.set': 'Gave a badge', 'badge.remove': 'Removed a badge', 'user.suspend': 'Suspended', 'user.unsuspend': 'Unsuspended',
  'user.delete': 'Deleted account', 'report.actioned': 'Actioned report', 'report.dismissed': 'Dismissed report',
  'message.remove': 'Removed message', 'verification.approve': 'Approved verification', 'verification.reject': 'Rejected verification',
  'announcement.publish': 'Published announcement', 'announcement.end': 'Ended announcement', 'status.remove': 'Removed status',
  'admin.set': 'Set admin role', 'admin.remove': 'Removed admin',
};

const detailText = (d: AuditRow['details']) =>
  Object.entries(d || {})
    .filter(([k, v]) => k !== 'who' && v !== null && v !== '' && v !== false && v !== 0)
    .map(([k, v]) => k + ': ' + String(v))
    .join(' · ');

export function AuditLog() {
  const { data: list, reload: load } = useLoad(() => rpc<AuditRow[]>('admin_audit_log', { lim: 200 }));

  let body: React.ReactNode;
  if (!list) body = <div className="empty">Loading…</div>;
  else if (!list.length) body = <div className="empty">No admin actions yet.</div>;
  else body = (
    <div className="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>
          {list.map((a) => {
            const who = a.details?.who;
            return (
              <tr key={a.id}>
                <td className="nw">{when(a.created_at)}</td>
                <td>@{a.admin_username || '—'}</td>
                <td>{LABEL[a.action] || a.action}</td>
                <td>
                  {a.target_username ? '@' + a.target_username
                    : who ? <>{String(who)} <span className="muted small">(deleted)</span></>
                      : <span className="muted small">{String(a.target || '').slice(0, 8)}</span>}
                </td>
                <td className="muted small">{detailText(a.details)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Topbar title="Audit log" onRefresh={load} />
      <div className="notice">Every admin action is recorded here and cannot be edited.</div>
      <div className="card" id="aud">{body}</div>
    </>
  );
}
