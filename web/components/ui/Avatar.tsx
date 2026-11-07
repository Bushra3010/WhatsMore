import { contact, initials, BADGE_LABELS } from '@/lib/util';
import type { Chat, Contact } from '@/lib/types';
import { Icon } from '@/components/Icon';

type Who = Partial<Contact> | null | undefined;

/** Round avatar: emoji or initials on the person's colour (avatarHTML in the original). */
export function Avatar({ o, size = 49, extra = '' }: { o: Who; size?: number; extra?: string }) {
  const p = o || {};
  const fs = Math.round(size * (p.emoji ? 0.5 : 0.4));
  return (
    <div className={`avatar ${extra}`} style={{ width: size, height: size, background: p.color || '#8696a0', fontSize: fs }}>
      {p.emoji ? p.emoji : initials(p.name)}
    </div>
  );
}

export function ChatAvatar({ ch, size = 49 }: { ch: Chat; size?: number }) {
  if (ch.type === 'direct') return <Avatar o={contact(ch.contactId)} size={size} />;
  return <Avatar o={{ name: ch.name, emoji: ch.emoji, color: ch.color }} size={size} extra="group" />;
}

/** Verified / badge tick next to a name. */
export function Verified({ c }: { c: Who }) {
  if (c?.badge) return <span className={`verified badge-${c.badge}`} title={BADGE_LABELS[c.badge] || 'Verified'}><Icon name="verified" size={16} /></span>;
  if (c?.business?.verified) return <span className="verified" title="Verified business"><Icon name="verified" size={16} /></span>;
  return null;
}

/** File-type badge (PDF, DOC, …). */
export function DocIcon({ label, color, cls = '' }: { label: string; color: string; cls?: string }) {
  return <div className={`doc-icon ${cls}`} style={{ background: color }}>{label}</div>;
}
