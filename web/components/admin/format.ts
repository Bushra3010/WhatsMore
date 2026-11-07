// Formatting helpers and shared types for the Command Center (ported from js/admin.js).

export type Admin = { user_id: string; role: 'owner' | 'moderator'; name: string; username: string };

export const num = (n: unknown) => Number(n || 0).toLocaleString('en-IN');
export const when = (t?: string | null) =>
  t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const ago = (t: string | null | undefined, now: number) => {
  if (!t) return 'never';
  const s = (now - Date.parse(t)) / 1000;
  return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago';
};
export const bytes = (v: unknown) => {
  const b = Number(v || 0);
  return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB';
};
/** The admin's IANA time zone, sent to admin_stats so daily charts group by the admin's calendar days. */
export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
/** 'YYYY-MM-DD' from the server is a calendar day in the admin's zone: read it as local, not UTC. */
export const dayOf = (s: string) => new Date(s + 'T00:00:00');
export const isFuture = (t: string | null | undefined, now: number) => !!t && Date.parse(t) > now;

export const BADGES: Record<string, string> = {
  verified: 'Verified',
  business: 'Business verified',
  creator: 'Creator verified',
  official: 'Official',
  government: 'Government',
};

export type Daily = { day: string; signups: number; messages: number };
export type Stats = {
  tz: string;
  users: number; users_today: number; users_7d: number; active_24h: number; signed_in_24h: number;
  messages: number; messages_today: number; direct_chats: number; groups: number; statuses_live: number;
  reactions: number; reports_open: number; verifications_pending: number; suspended: number; verified: number;
  files: number; storage_bytes: number; by_kind: Record<string, number> | null; daily: Daily[] | null;
};
