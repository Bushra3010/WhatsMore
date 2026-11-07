'use client';
// Live chats through Supabase (ported from js/cloud.js): server rows → app messages, full sync of my
// conversations, realtime updates, read receipts, typing and online status. Row-level security in the
// database means each person only ever receives the conversations they belong to.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { S, ui, save, commit, refresh } from '@/lib/state';
import type { Chat, Message } from '@/lib/types';
import { toast } from '@/lib/overlay';
import { contact, chatById, extOf, lastTime, preview, senderName, uid } from '@/lib/util';
import { notify } from '@/lib/actions';
import { appSupabase } from '@/lib/supabase/app-client';

export const sb = appSupabase();
export const CL: {
  user: User | null; channel: RealtimeChannel | null; syncing: Promise<void> | null; found: Map<string, any>;
  noted: Set<string>; conv: Map<string, RealtimeChannel>; urls: Map<string, string>; typingT: Record<string, any>;
  typingSent: number; readT: Record<string, any>; suspended: { until: number; reason: string } | null;
} = { user: null, channel: null, syncing: null, found: new Map(), noted: new Set(), conv: new Map(), urls: new Map(), typingT: {}, typingSent: 0, readT: {}, suspended: null };

export const cuid = (u: string) => 'u_' + u;
export const chid = (c: string) => 'sb_' + c;
export const rawId = (id: string) => String(id).replace(/^(u_|sb_|sm_)/, '');
export const cloudOn = () => !!CL.user;
export const SYS_E2E = 'This is a live chat with real WHATSMORE accounts. Messages, photos, voice notes and files sync instantly to everyone in the chat.';
export const BUCKET = 'chat-media';
export const MAX_MEDIA = 25 * 1024 * 1024;
export const MEDIA_KINDS = ['image', 'video', 'voice', 'doc'];
/** Simple, self-contained message types that can be shared as-is. */
export const RICH: Record<string, string[]> = { sticker: ['text'], gif: ['gif'], location: ['lat', 'lng', 'name', 'acc', 'live'], poll: ['question', 'options', 'multi'], event: ['title', 'when', 'place'], payment: ['kind', 'amount', 'note', 'split'], contact: ['user'] };
const MSG_COLS = 'id, conversation_id, sender_id, kind, body, caption, payload, media_path, media_name, media_size, media_mime, duration, reply_to, edited_at, deleted_at, created_at';
const S2 = () => S as any;

/** Hooks other live modules add to (stories and moderation run after every sync, and clean up on sign-out). */
export const afterSync: (() => void)[] = [];
export const onSignedOut: (() => void)[] = [];
/** Called when the database refuses something I send (most likely a suspension made after the page loaded). */
export const refusalHooks: (() => void)[] = [];
/** Realtime 'rtc' broadcasts on a conversation channel (calls). */
export const rtcSignalHooks: ((convId: string, payload: any) => void)[] = [];

// ---------- people
export function upsertCloudContact(p: any) {
  const id = cuid(p.id);
  let c = contact(id);
  const fields = { name: p.name, username: p.username, about: p.about, color: p.color || '#1565d8', badge: p.badge || null };
  if (c) Object.assign(c, fields);
  else { c = { id, ...fields, isContact: true, cloud: true, online: false }; S.contacts.push(c); }
  return c;
}
export async function fetchProfiles(ids: string[]) {
  const need = [...new Set(ids)].filter((x) => x && x !== CL.user?.id);
  if (!need.length) return;
  const { data } = await sb.from('profiles').select('id, username, name, about, color, badge').in('id', need);
  (data || []).forEach(upsertCloudContact);
}

// ---------- server row → app message
export function mapCloudMsg(r: any): Message {
  const base: any = { id: 'sm_' + r.id, sbId: r.id, from: r.sender_id === CL.user!.id ? 'me' : cuid(r.sender_id), t: Date.parse(r.created_at), status: 'delivered', reactions: {} };
  if (r.reply_to) base.replyTo = 'sm_' + r.reply_to;
  if (r.edited_at) base.edited = true;
  const media = { mediaPath: r.media_path, size: r.media_size, caption: r.caption || '' };
  const url = r.media_path && CL.urls.get(r.media_path);
  switch (r.kind) {
    case 'text': return { ...base, type: 'text', text: r.body };
    case 'deleted': return { ...base, type: 'deleted' };
    case 'rich': {
      const p = r.payload || {}; const keep = RICH[p.type] || [];
      const o: any = { ...base, type: RICH[p.type] ? p.type : 'text', text: RICH[p.type] ? undefined : '[unsupported message]' };
      keep.forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; });
      if (p.type === 'poll') o.votes = {};
      if (p.type === 'event') o.going = [base.from];
      if (p.type === 'payment') { o.status = p.kind === 'send' ? 'paid' : 'pending'; o.paidBy = p.split ? [base.from] : []; }
      if (p.type === 'contact') { o.userId = cuid(p.user); delete o.user; }
      return o;
    }
    case 'image': return { ...base, ...media, type: 'image', src: url || '', art: { bg: 'linear-gradient(135deg,#cfd8dc,#eceff1)', emoji: '🖼️' } };
    case 'video': return { ...base, ...media, type: 'video', src: url || '' };
    case 'voice': return { ...base, ...media, type: 'voice', dur: r.duration || 1, src: url || '' };
    case 'doc': return { ...base, ...media, type: 'doc', name: r.media_name || 'file', ext: extOf(r.media_name || 'file'), url: url || '' };
  }
  return { ...base, type: 'text', text: r.body || '' };
}
/** Private files are read through short-lived signed links. */
export async function signMedia(paths: (string | null)[]) {
  const need = [...new Set(paths.filter((p): p is string => !!p && !CL.urls.has(p)))];
  for (let i = 0; i < need.length; i += 100) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), 60 * 60 * 12);
    (data || []).forEach((d: any) => { if (d.signedUrl && d.path) { CL.urls.set(d.path, d.signedUrl); ui.blobs.push(d.signedUrl); } });
  }
}
export function applyReaction(ch: Chat | undefined, r: any) {
  const m = ch?.messages.find((x) => x.sbId === r.message_id);
  if (!m) return false;
  const who = r.user_id === CL.user!.id ? 'me' : cuid(r.user_id);
  const rx = (m.reactions ||= {});
  Object.keys(rx).forEach((k) => { rx[k] = rx[k].filter((x) => x !== who); if (!rx[k].length) delete rx[k]; });
  if (r.emoji) (rx[r.emoji] ||= []).push(who);
  return true;
}
/** Blue ticks: my message is read once everyone else has read up to it (and only if I share receipts too). */
export function applyReads(ch: Chat | undefined) {
  if (!ch?.cloud) return;
  const others = ch.type === 'direct' ? [ch.contactId!] : ch.members || [];
  const upTo = S.settings.privacy.readReceipts && others.length ? Math.min(...others.map((id) => ch.readBy?.[id] || 0)) : 0;
  ch.messages.forEach((m) => { if (m.from === 'me' && m.sbId && m.status !== 'failed' && m.status !== 'sent') m.status = m.t <= upTo ? 'read' : 'delivered'; });
}

// ---------- polls, events, payment requests: everyone's votes / RSVPs / payments (demo wallets only)
export function creditOnce(key: string, amount: number, who: string, note?: string) {
  const cr = (S2().cloudCredits ||= {});
  if (cr[key]) return;
  cr[key] = Date.now();
  S2().wallet += amount;
  S2().payments.push({ id: uid(), dir: 'in', amount, with: who, note: note || 'Payment', t: Date.now() });
}
export function creditIncomingSend(ch: Chat, m: Message) {
  if (ch.type === 'direct' && m.type === 'payment' && m.kind === 'send' && m.from !== 'me' && m.sbId) creditOnce('send:' + m.sbId, m.amount, senderName(m.from), m.note);
}
export function applyAction(ch: Chat | undefined, a: any) {
  const m = ch?.messages.find((x) => x.sbId === a.message_id);
  if (!ch || !m) return false;
  const who = a.user_id === CL.user!.id ? 'me' : cuid(a.user_id);
  if (a.action === 'vote' && m.type === 'poll') {
    const v = (m.votes ||= {});
    Object.keys(v).forEach((k) => { v[k] = v[k].filter((x: string) => x !== who); if (!v[k].length) delete v[k]; });
    (Array.isArray(a.value) ? a.value : []).forEach((i: any) => { if (Number.isInteger(i) && i >= 0 && i < (m.options || []).length) (v[i] ||= []).push(who); });
  } else if (a.action === 'rsvp' && m.type === 'event') {
    m.going = (m.going || []).filter((x: string) => x !== who);
    if (a.value === true) m.going.push(who);
  } else if (a.action === 'pay' && m.type === 'payment') {
    m.paidBy ||= [];
    if (!m.paidBy.includes(who)) m.paidBy.push(who);
    const done = m.split ? m.paidBy.length >= m.split.people : m.paidBy.some((x: string) => x !== m.from);
    if (done) m.status = 'paid';
    if (m.from === 'me' && who !== 'me') creditOnce(`${m.sbId}:${who}`, m.amount, senderName(who), m.note);
  } else if (a.action === 'decline' && m.type === 'payment' && ch.type === 'direct') {
    m.status = 'declined';
  } else return false;
  return true;
}

// ---------- full sync: my conversations, members, recent messages, reactions and files
export function cloudSync(): Promise<void> {
  if (!cloudOn()) return Promise.resolve();
  if (CL.syncing) return CL.syncing;
  CL.syncing = (async () => {
    const me = CL.user!.id;
    const { data: mine, error } = await sb.from('members').select('conversation_id, conversations(id, kind, name, emoji, color, created_at)').eq('user_id', me);
    if (error) { toast('Could not load your chats: ' + error.message); return; }
    const convs: any[] = (mine || []).map((r: any) => r.conversations).filter(Boolean);
    const ids = convs.map((c) => c.id);
    let members: any[] = [], msgs: any[] = [], reacts: any[] = [], acts: any[] = [];
    if (ids.length) {
      const [mr, gr, rr, ar] = await Promise.all([
        sb.from('members').select('conversation_id, user_id, role, last_read_at').in('conversation_id', ids),
        sb.from('messages').select(MSG_COLS).in('conversation_id', ids).order('created_at', { ascending: false }).limit(1500),
        sb.from('reactions').select('message_id, user_id, conversation_id, emoji').in('conversation_id', ids).not('emoji', 'is', null),
        sb.from('message_actions').select('message_id, user_id, conversation_id, action, value').in('conversation_id', ids),
      ]);
      members = mr.data || []; msgs = (gr.data || []).reverse(); reacts = rr.data || []; acts = ar.data || [];
    }
    await Promise.all([
      fetchProfiles([...members.map((m) => m.user_id), ...msgs.filter((m) => m.payload?.type === 'contact').map((m) => m.payload.user)]),
      signMedia(msgs.map((m) => m.media_path)),
    ]);
    if (!cloudOn()) return; // signed out meanwhile
    const read = (S2().cloudRead ||= {});
    const old = new Map(S.chats.filter((c) => c.cloud).map((c) => [c.id, c]));
    S.chats = S.chats.filter((c) => !c.cloud);
    convs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).forEach((cv) => {
      const mem = members.filter((m) => m.conversation_id === cv.id);
      const others = mem.filter((m) => m.user_id !== me);
      const prev = old.get(chid(cv.id));
      const prevById = new Map((prev?.messages || []).map((m) => [m.id, m]));
      const list = msgs.filter((m) => m.conversation_id === cv.id).map((r) => {
        const m = mapCloudMsg(r), p = prevById.get(m.id);
        // keep my own local copies of files (instant, works offline) and per-device flags
        if (p && m.from === 'me' && (p.src || p.url) && m.type !== 'deleted') { if (p.src) m.src = p.src; if (p.url) m.url = p.url; if (p.data) m.data = p.data; if (p.content) m.content = p.content; }
        if (p) ['starred', 'pinned', 'played'].forEach((k) => { if (p[k]) m[k] = p[k]; });
        return m;
      });
      (prev?.messages || []).forEach((m) => { if ((m.localOnly || (m.from === 'me' && m.status === 'sent')) && !list.some((x) => x.id === m.id)) list.push(m); });
      list.sort((a, b) => a.t - b.t);
      const base: any = { id: chid(cv.id), sbId: cv.id, cloud: true, unread: list.filter((m) => m.from !== 'me' && m.t > (read[cv.id] || 0)).length, readBy: {}, messages: [{ id: 'sys_' + cv.id, type: 'system', from: 'system', t: Date.parse(cv.created_at), text: SYS_E2E }, ...list] };
      others.forEach((m) => { if (m.last_read_at) base.readBy[cuid(m.user_id)] = Date.parse(m.last_read_at); });
      ['pinned', 'muted', 'archived', 'translate', 'live', 'privacy', 'draft'].forEach((k) => { if (prev && prev[k] !== undefined) base[k] = prev[k]; });
      let ch: Chat;
      if (cv.kind === 'direct') {
        const other = others[0]; if (!other) return;
        ch = { ...base, type: 'direct', contactId: cuid(other.user_id) };
      } else {
        ch = { ...base, type: 'group', name: cv.name, emoji: cv.emoji, color: cv.color, description: '', members: others.map((m) => cuid(m.user_id)), admins: mem.filter((m) => m.role === 'admin').map((m) => (m.user_id === me ? 'me' : cuid(m.user_id))) };
      }
      reacts.filter((r) => r.conversation_id === cv.id).forEach((r) => applyReaction(ch, r));
      acts.filter((a) => a.conversation_id === cv.id).forEach((a) => applyAction(ch, a));
      if (ch.type === 'direct') ch.messages.forEach((m) => creditIncomingSend(ch, m));
      applyReads(ch);
      S.chats.push(ch);
    });
    if (ui.active?.startsWith('sb_') && !chatById(ui.active)) ui.active = null;
    commit();
    ensureConvChannels();
    if (ui.active?.startsWith('sb_')) markRead(chatById(ui.active));
    afterSync.forEach((f) => f());
  })().finally(() => { CL.syncing = null; });
  return CL.syncing;
}

// ---------- live updates
export function cloudSubscribe() {
  cloudUnsubscribe();
  const me = CL.user!.id;
  CL.channel = sb.channel('wm-' + me)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p: any) => { onCloudMessage(p.new); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p: any) => onCloudMessageUpdate(p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (p: any) => { if (p.new?.message_id && applyReaction(chatById(chid(p.new.conversation_id)), p.new)) commit(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_actions' }, (p: any) => { if (p.new?.message_id && applyAction(chatById(chid(p.new.conversation_id)), p.new)) commit(); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members' }, (p: any) => onMemberUpdate(p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: 'user_id=eq.' + me }, () => { cloudSync().then(() => toast('🌐 You were added to a new chat')); })
    .subscribe();
}
export function cloudUnsubscribe() {
  if (CL.channel) { sb.removeChannel(CL.channel); CL.channel = null; }
  CL.conv.forEach((c) => sb.removeChannel(c)); CL.conv.clear();
}
async function onCloudMessage(r: any) {
  let ch = chatById(chid(r.conversation_id));
  if (!ch) { await cloudSync(); ch = chatById(chid(r.conversation_id)); if (!ch) return; }
  if (ch.messages.some((m) => m.sbId === r.id)) return;
  if (r.sender_id !== CL.user!.id && !contact(cuid(r.sender_id))) await fetchProfiles([r.sender_id]);
  if (r.media_path) await signMedia([r.media_path]);
  if (r.payload?.type === 'contact' && !contact(cuid(r.payload.user))) await fetchProfiles([r.payload.user]);
  if (ch.messages.some((m) => m.sbId === r.id)) return; // arrived during the awaits
  if (ch.type === 'group' && r.sender_id !== CL.user!.id && !ch.members!.includes(cuid(r.sender_id))) ch.members!.push(cuid(r.sender_id));
  const m = mapCloudMsg(r);
  delete ui.typing[ch.id];
  ch.messages.push(m);
  creditIncomingSend(ch, m);
  if (m.from !== 'me') {
    if (ui.active === ch.id && document.visibilityState === 'visible') { (S2().cloudRead ||= {})[ch.sbId!] = m.t; markRead(ch); }
    else { ch.unread = (ch.unread || 0) + 1; notify(ch, m.from, preview(m)); }
  }
  commit();
}
function onCloudMessageUpdate(r: any) {
  const ch = chatById(chid(r.conversation_id));
  const i = ch ? ch.messages.findIndex((m) => m.sbId === r.id) : -1;
  if (!ch || i < 0) return;
  const cur = ch.messages[i], next = mapCloudMsg(r);
  ['reactions', 'starred', 'pinned', 'played', 'status'].forEach((k) => { if (cur[k] !== undefined) next[k] = cur[k]; });
  if (next.type !== 'deleted' && cur.from === 'me') { if (cur.src) next.src = cur.src; if (cur.url) next.url = cur.url; }
  ch.messages[i] = next;
  commit();
}
function onMemberUpdate(r: any) {
  if (r.user_id === CL.user!.id || !r.last_read_at) return;
  const ch = chatById(chid(r.conversation_id));
  if (!ch) return;
  (ch.readBy ||= {})[cuid(r.user_id)] = Date.parse(r.last_read_at);
  applyReads(ch); commit();
}
/** Tell others I've read this chat (skipped when I've turned read receipts off). */
export function markRead(ch: Chat | undefined) {
  if (!ch?.cloud || !cloudOn() || document.visibilityState !== 'visible') return;
  (S2().cloudRead ||= {})[ch.sbId!] = lastTime(ch);
  save();
  if (!S.settings.privacy.readReceipts) return;
  clearTimeout(CL.readT[ch.sbId!]);
  CL.readT[ch.sbId!] = setTimeout(() => { sb.rpc('mark_read', { c: ch.sbId }); }, 400);
}

// ---------- typing and online: Realtime broadcast + presence, one channel per conversation
export function ensureConvChannels() {
  if (!cloudOn()) return;
  const want = new Set(S.chats.filter((c) => c.cloud).map((c) => c.sbId!));
  CL.conv.forEach((chn, id) => { if (!want.has(id)) { sb.removeChannel(chn); CL.conv.delete(id); } });
  want.forEach((id) => {
    if (CL.conv.has(id)) return;
    const chn = sb.channel('wm-conv-' + id, { config: { presence: { key: CL.user!.id }, broadcast: { self: false } } });
    chn.on('broadcast', { event: 'typing' }, ({ payload }) => onTyping(id, payload))
      .on('broadcast', { event: 'rtc' }, ({ payload }) => rtcSignalHooks.forEach((f) => f(id, payload)))
      .on('presence', { event: 'sync' }, () => onPresence())
      .subscribe((st) => { if (st === 'SUBSCRIBED' && S.settings.privacy.lastSeen !== 'nobody') chn.track({ at: Date.now() }); });
    CL.conv.set(id, chn);
  });
}
function onTyping(convId: string, p: any) {
  const ch = chatById(chid(convId));
  if (!ch || !p?.uid || p.uid === CL.user?.id) return;
  ui.typing[ch.id] = String(p.name || 'Someone').split(' ')[0];
  clearTimeout(CL.typingT[ch.id]);
  CL.typingT[ch.id] = setTimeout(() => { delete ui.typing[ch.id]; refresh(); }, 3500);
  refresh();
}
function onPresence() {
  const online = new Set<string>();
  CL.conv.forEach((chn) => Object.keys(chn.presenceState()).forEach((k) => online.add(k)));
  let changed = false;
  S.contacts.forEach((c) => {
    if (!c.cloud) return;
    const on = online.has(rawId(c.id));
    if (c.online !== on) { if (c.online && !on) c.lastSeen = Date.now(); c.online = on; changed = true; }
  });
  if (changed) commit();
}
/** Called on input in the composer of a live chat. */
export function sendTyping() {
  if (!ui.active?.startsWith('sb_')) return;
  const ch = chatById(ui.active), chn = ch && CL.conv.get(ch.sbId!);
  if (!chn || Date.now() - CL.typingSent < 2500) return;
  CL.typingSent = Date.now();
  chn.send({ type: 'broadcast', event: 'typing', payload: { uid: CL.user!.id, name: S.me.name } });
}
