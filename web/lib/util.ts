// Shared helpers ported from js/core.js: formatting, entities, people, previews.
import { S } from './state';
import type { Chat, Contact, Message } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);
export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
export const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const LANGS: Record<string, string> = { te: 'Telugu', hi: 'Hindi' };
export const COLORS = ['#1565d8', '#7c4dff', '#e91e63', '#ff9800', '#009688', '#3f51b5', '#f4511e', '#0288d1', '#8e24aa', '#c2185b'];
export const PRIVACY_OPTS: [string, string][] = [['everyone', 'Everyone'], ['contacts', 'My contacts'], ['selected', 'Selected contacts'], ['close', 'Close friends'], ['private', 'Only me']];
export const privacyLabel = (v: string) => (PRIVACY_OPTS.find((p) => p[0] === v) || ['', 'My contacts'])[1];
export const PLANS: Record<string, { name: string; quota: string; bytes: number; price: string; perk?: string }> = {
  free: { name: 'Free', quota: '5 GB', bytes: 5e9, price: '₹0', perk: 'Chat, calls, groups, status' },
  premium: { name: 'WHATSMORE Plus', quota: '100 GB', bytes: 1e11, price: '₹99 / month', perk: 'Advanced AI · more cloud · premium calling' },
  business: { name: 'Business', quota: '1 TB', bytes: 1e12, price: '₹499 / month', perk: 'Catalogue, orders, invoices, AI replies' },
  businesspro: { name: 'Business Pro', quota: '5 TB', bytes: 5e12, price: '₹1,499 / month', perk: 'Advanced analytics + automation · team inbox' },
  enterprise: { name: 'Enterprise', quota: 'Unlimited', bytes: 1e14, price: 'Custom', perk: 'Large organisations · SSO · admin & audit' },
};
export const BADGE_LABELS: Record<string, string> = { verified: 'Verified', business: 'Business verified', creator: 'Creator verified', official: 'Official', government: 'Government' };

// ---------- formatting
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function dayDiff(t: number) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(t); b.setHours(0, 0, 0, 0); return Math.round((a.getTime() - b.getTime()) / DAY); }
export const dayKey = (t: number) => new Date(t).toDateString();
export function dayLabel(t: number) {
  const dd = dayDiff(t), d = new Date(t);
  if (dd === 0) return 'Today';
  if (dd === 1) return 'Yesterday';
  if (dd < 7 && dd > 0) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
export function listTime(t: number) {
  const dd = dayDiff(t);
  if (dd <= 0) return fmtTime(t);
  if (dd === 1) return 'Yesterday';
  if (dd < 7) return new Date(t).toLocaleDateString([], { weekday: 'long' });
  return new Date(t).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}
export const callTime = (t: number) => (dayDiff(t) === 0 ? 'Today' : dayDiff(t) === 1 ? 'Yesterday' : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' })) + ', ' + fmtTime(t);
export const money = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fmtDur = (s: number) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtSize = (b: number) => (b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' kB' : (b / 1048576).toFixed(1) + ' MB');

// Every file type is supported — this only picks the icon label and colour
const FILE_TYPES: [string[], string, string, string][] = [
  [['pdf'], 'PDF', '#e5474b', 'pdf'], [['doc', 'docx', 'odt', 'rtf', 'pages'], 'DOC', '#2b6fd6', 'word'],
  [['xls', 'xlsx', 'ods', 'numbers'], 'XLS', '#1d9b5f', 'sheet'], [['csv', 'tsv'], 'CSV', '#1d9b5f', 'text'],
  [['ppt', 'pptx', 'odp', 'key'], 'PPT', '#d24726', 'slides'], [['txt', 'md', 'log', 'ini'], 'TXT', '#607d8b', 'text'],
  [['zip', 'rar', '7z', 'tar', 'gz', 'bz2'], 'ZIP', '#8d6e63', 'archive'], [['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'], 'AUDIO', '#ff9800', 'audio'],
  [['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'], 'VIDEO', '#7b1fa2', 'video'], [['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg', 'tiff'], 'IMG', '#0288d1', 'image'],
  [['psd', 'ai', 'fig', 'sketch', 'xd', 'indd', 'cdr'], 'DESIGN', '#5e35b1', 'design'], [['dwg', 'dxf', 'stl', 'step', 'obj'], 'CAD', '#455a64', 'cad'],
  [['apk', 'exe', 'dmg', 'msi', 'ipa', 'deb'], 'APP', '#43a047', 'app'], [['epub', 'mobi'], 'BOOK', '#6d4c41', 'ebook'],
  [['js', 'ts', 'py', 'java', 'kt', 'swift', 'html', 'css', 'json', 'xml', 'c', 'cpp', 'go', 'rb', 'php', 'sql', 'sh', 'yml', 'yaml'], 'CODE', '#37474f', 'text'],
  [['vcf'], 'VCF', '#009688', 'text'], [['ics'], 'ICS', '#e91e63', 'text'],
];
export function fileType(ext?: string) {
  ext = String(ext || '').toLowerCase();
  const t = FILE_TYPES.find(([exts]) => exts.includes(ext!));
  return t ? { label: t[1], color: t[2], kind: t[3] } : { label: (ext || 'file').toUpperCase().slice(0, 4), color: '#8696a0', kind: 'other' };
}
export const extOf = (name: string) => (/\.([a-z0-9]{1,6})$/i.exec(name || '')?.[1] || '').toLowerCase();
export const initials = (name?: string) => (name || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export function hash(s: string) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export function isJumbo(t?: string) {
  if (!t || t.length > 30) return false;
  const s = t.replace(/\s/g, '');
  if (!/^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+$/u.test(s)) return false;
  const n = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? [...new Intl.Segmenter().segment(s)].length : s.length / 2;
  return n <= 3;
}

// ---------- entities
let contactIdx: Map<string, Contact> | null = null, contactIdxLen = -1, contactIdxArr: Contact[] | null = null;
export function contact(id?: string | null): Contact | undefined {
  if (!id) return undefined;
  if (contactIdxArr !== S.contacts || contactIdxLen !== S.contacts.length) {
    contactIdx = new Map(S.contacts.map((c) => [c.id, c]));
    contactIdxLen = S.contacts.length; contactIdxArr = S.contacts;
  }
  return contactIdx!.get(id);
}
export const person = (id?: string | null) => contact(id) || S.directory.find((u) => u.id === id);
export const chatById = (id?: string | null) => (id ? S.chats.find((c) => c.id === id) : undefined);
export const chatTitle = (ch: Chat) => (ch.secret ? '🔒 ' : '') + (ch.type === 'direct' ? contact(ch.contactId)?.name || 'Unknown' : ch.name || '');
export const senderName = (id: string) => (id === 'me' ? 'You' : person(id)?.name || 'Unknown');
export const firstName = (id: string) => (id === 'me' ? 'You' : senderName(id).split(' ')[0]);
export const lastMsg = (ch: Chat) => ch.messages[ch.messages.length - 1];
export const lastTime = (ch: Chat) => lastMsg(ch)?.t || 0;
export const isBiz = (ch?: Chat) => !!ch && ch.type === 'direct' && !!contact(ch.contactId)?.business;
export const isAdmin = (ch?: Chat) => !!ch && ch.type === 'group' && (ch.admins || []).includes('me');
export const directChatFor = (cid: string) => S.chats.find((c) => c.type === 'direct' && c.contactId === cid && !c.secret);
export const productById = (pid: string) => Object.values(S.catalog).flat().find((p) => p.id === pid);
export const allUsernames = () => [...S.contacts, ...S.directory].map((u) => u.username);

// ---------- people (groups have no participant limit)
export const sample = <T,>(arr: T[], n: number) => (arr.length <= n ? arr.slice() : arr.slice().sort(() => Math.random() - 0.5).slice(0, n));
export function findPeople(q: string, exclude: string[] = []) {
  q = (q || '').trim().toLowerCase().replace(/^@/, '');
  const skip = new Set(exclude);
  const people = [...S.contacts.filter((c) => !c.business), ...S.directory.filter((u) => !S.contacts.some((c) => c.id === u.id))].filter((p) => !skip.has(p.id));
  const hits = q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.username.includes(q)) : people;
  return hits.sort((a, b) => (b.isContact ? 1 : 0) - (a.isContact ? 1 : 0) || a.name.localeCompare(b.name));
}
export function ensureContact(id: string) {
  const have = contact(id);
  if (have) return have;
  const u = S.directory.find((x) => x.id === id);
  if (!u) return null;
  const c: Contact = { ...u, isContact: false, online: Math.random() < 0.4 };
  S.contacts.push(c);
  return c;
}
export function namesSummary(ids: string[], max = 3) {
  const names = ids.map(firstName);
  if (names.length <= max) return names.join(', ');
  return names.slice(0, max).join(', ') + ` and ${(names.length - max).toLocaleString()} others`;
}
const FIRST = 'Aarav Aditi Akash Ananya Arjun Divya Farhan Gayatri Harsh Isha Karan Kavya Lakshmi Manoj Meera Mohit Nandini Naveen Neha Pooja Rahul Ravi Riya Rohan Sameer Sana Shreya Sneha Suresh Tanvi Varun Vikram Yash Zoya Imran Fatima Joseph Mary Priyanka Kiran'.split(' ');
const LAST = 'Sharma Reddy Rao Khan Patel Iyer Naidu Gupta Singh Verma Das Menon Joshi Nair Shah Kapoor Mehta Pillai Chowdhury Varma'.split(' ');
/** Create N new WHATSMORE users (simulates people joining via a group invite link). */
export function generatePeople(n: number) {
  const out: string[] = [], taken = new Set(allUsernames());
  for (let i = 0; i < n; i++) {
    const f = pick(FIRST), l = pick(LAST);
    let un: string;
    do { un = (f + '.' + l).toLowerCase() + (Math.floor(Math.random() * 9000) + 100); } while (taken.has(un));
    taken.add(un);
    const p: Contact = { id: 'g_' + uid(), name: f + ' ' + l, username: un, color: pick(COLORS), generated: 1 };
    S.contacts.push(p);
    out.push(p.id);
  }
  return out;
}

export function preview(m?: Message): string {
  if (!m) return '';
  switch (m.type) {
    case 'text': return m.text || '';
    case 'image': return '📷 ' + (m.caption || 'Photo');
    case 'video': return '🎥 ' + (m.caption || 'Video');
    case 'doc': return (m.signed ? '✍️ ' : '📄 ') + m.name;
    case 'signreq': return '✍️ Signature request: ' + m.doc?.name;
    case 'voice': return '🎤 Voice message (' + fmtDur(m.dur) + ')';
    case 'sticker': return m.text || '';
    case 'gif': return '🎞️ GIF';
    case 'payment': return (m.kind === 'request' ? '💳 Payment request ' : '💸 Payment ') + money(m.amount);
    case 'poll': return '📊 POLL: ' + m.question;
    case 'event': return '📅 ' + m.title;
    case 'product': return '🛍️ ' + (productById(m.productId)?.name || 'Product');
    case 'invoice': return '🧾 Invoice ' + m.orderId;
    case 'contact': return '👤 ' + (contact(m.userId)?.name || 'Contact');
    case 'location': return m.live ? '📍 Live location' : '📍 ' + (m.name || 'Location');
    case 'call': return (m.video ? '📹 Video call' : '📞 Voice call') + (m.missed ? ' · missed' : '');
    case 'deleted': return '🚫 This message was deleted';
    case 'system': return m.text || '';
  }
  return '';
}

/** Escape text for the few places that still build HTML strings (rich text formatting). */
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
/** WhatsApp-style formatting: links, *bold*, _italic_, @mentions, search highlight. Output is escaped HTML. */
export function fmtText(t: string, q?: string | null) {
  let s = esc(t);
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,!?)])/g, '$1<b>$2</b>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, '$1<i>$2</i>');
  s = s.replace(/(^|[\s(])@([a-z0-9._]{3,})/gi, '$1<span class="mention">@$2</span>');
  if (q) s = s.replace(new RegExp('(' + escRe(esc(q)) + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>');
  return s;
}
