'use client';
// Sending in live chats (ported from js/cloud.js + the suspension guard in js/moderation.js): uploads
// messages and files, syncs edits / deletes / reactions / votes / RSVPs / payments, and turns off the
// demo's simulated ticks and bot replies for real people.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { S, ui, commit } from '@/lib/state';
import type { Chat, Message } from '@/lib/types';
import { modal, toast } from '@/lib/overlay';
import { contact, money, senderName, uid } from '@/lib/util';
import { afterSend, beforeSend, tickHooks, replyGuards, onOpenChat, on, refreshMsg, createGroupHooks, addMembersHooks, openChat } from '@/lib/actions';
import { act, chatBars } from '@/lib/registry';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/Icon';
import { Note } from '@/components/ui/Bits';
import { CL, sb, cloudOn, rawId, chid, RICH, MEDIA_KINDS, BUCKET, MAX_MEDIA, applyReads, applyAction, cloudSync, markRead, refusalHooks, upsertCloudContact } from './core';

export const suspendedText = () => `Your account is suspended until ${new Date(CL.suspended!.until).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${CL.suspended!.reason ? ' · ' + CL.suspended!.reason : ''}. You can read chats but can't send messages, post statuses or start chats.`;
export const isSuspended = () => !!(cloudOn() && CL.suspended && CL.suspended.until > Date.now());

// ---------- suspension: sending in live chats is blocked (the database refuses it too)
beforeSend.push((ch) => {
  if (ch?.cloud && isSuspended()) { toast('🚫 ' + suspendedText(), null, { ms: 6000 }); return false; }
});

// ---------- upload every message sent in a live chat
afterSend.push((ch, m) => {
  if (!ch?.cloud) return;
  const kind = m.type;
  const localUrl = kind === 'doc' ? m.url : m.src;
  const syncable = cloudOn() && (kind === 'text' || (RICH[kind] && (kind !== 'contact' || contact(m.userId)?.cloud)) || (MEDIA_KINDS.includes(kind) && localUrl));
  if (!syncable) {
    m.localOnly = true;
    if (!CL.noted.has(ch.id + kind)) {
      CL.noted.add(ch.id + kind);
      toast(cloudOn() ? (kind === 'contact' ? 'Only contacts with WHATSMORE accounts can be shared in a live chat — this one stays on this device' : 'This item stays on this device') : 'Sign in to send live messages');
    }
    commit();
    return;
  }
  const sid = crypto.randomUUID();
  const oldId = m.id;
  m.id = 'sm_' + sid; m.sbId = sid; m.status = 'sent';
  if (ui.replyTo === oldId) ui.replyTo = m.id;
  const reply_to = m.replyTo?.startsWith('sm_') ? rawId(m.replyTo) : null;
  commit();
  (async () => {
    let row: any;
    if (kind === 'text') row = { kind: 'text', body: m.text };
    else if (RICH[kind]) {
      const payload: any = { type: kind };
      RICH[kind].forEach((k) => { if (m[k] !== undefined) payload[k] = m[k]; });
      if (kind === 'contact') payload.user = rawId(m.userId);
      row = { kind: 'rich', payload };
    } else {
      const blob = await (await fetch(localUrl)).blob();
      if (blob.size > MAX_MEDIA) throw new Error('files must be 25 MB or smaller');
      const name = kind === 'doc' ? m.name : kind === 'voice' ? 'voice-note.webm' : kind === 'video' ? 'video' + (blob.type.includes('mp4') ? '.mp4' : '.webm') : 'photo.jpg';
      const path = `${ch.sbId}/${sid}-${String(name).replace(/[^\w.\-]+/g, '_').slice(-80)}`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
      if (up.error) throw up.error;
      m.mediaPath = path;
      row = { kind, media_path: path, media_name: name, media_size: blob.size, media_mime: blob.type || null, duration: kind === 'voice' ? Math.round(m.dur || 1) : null, caption: m.caption || null };
    }
    const { data, error } = await sb.from('messages').insert({ id: sid, conversation_id: ch.sbId, reply_to, ...row }).select('created_at').single();
    if (error) throw error;
    m.t = Date.parse(data.created_at); m.status = 'delivered';
    applyReads(ch); refreshMsg(ch);
  })().catch((err) => {
    m.status = 'failed'; refreshMsg(ch);
    // refused by the database: most likely a suspension made after this page loaded
    if (/row-level security/i.test(err?.message || '')) refusalHooks.forEach((f) => f());
    else toast('Not sent: ' + (err?.message || err));
  });
});

// Real chats have real people: no simulated ticks, typing or bot replies
tickHooks.push((ch) => !!ch?.cloud);
replyGuards.push((ch) => !!ch?.cloud);
onOpenChat.push((ch) => { if (ch.cloud) markRead(ch); });

chatBars.push((ch: Chat) => [
  ch.cloud && isSuspended() ? <div key="suspend" className="bar suspendbar"><Icon name="block" size={18} /><span className="grow">{suspendedText()}</span></div> : null,
  ch.cloud ? <div key="cloud" className="bar cloudbar"><Icon name="cloud" size={18} /><span className="grow">Live chat · messages, photos, voice notes, files, polls, events and payment requests sync instantly. Payments use demo money.</span></div> : null,
]);

// ---------- edits, deletes, reactions (events fired by the chat screen)
const live = (ch: Chat, m: Message) => !!(ch?.cloud && m?.sbId && !m.localOnly && cloudOn());
on('edit', (ch: Chat, m: Message, before: string) => {
  if (!live(ch, m) || m.text === before) return;
  sb.rpc('edit_message', { m: m.sbId, new_body: m.text }).then(({ error }) => {
    if (!error) return;
    m.text = before; m.edited = false; refreshMsg(ch); toast('Not edited: ' + error.message);
  });
});
on('deleteForEveryone', (ch: Chat, m: Message) => {
  if (!live(ch, m)) return;
  sb.rpc('delete_message', { m: m.sbId }).then(({ data: path, error }) => {
    if (error) return toast('Not deleted: ' + error.message);
    if (path) sb.storage.from(BUCKET).remove([path]);
    const keep = { id: m.id, sbId: m.sbId, from: m.from, t: m.t, status: m.status, reactions: {} };
    Object.keys(m).forEach((k) => delete (m as any)[k]); Object.assign(m, keep, { type: 'deleted' });
    commit();
  });
  return true;
});
on('react', (ch: Chat, m: Message) => {
  if (!live(ch, m)) return;
  const mine = Object.entries(m.reactions || {}).find(([, v]) => v.includes('me'))?.[0] || null;
  sb.rpc('set_reaction', { m: m.sbId, e: mine }).then(({ error }) => { if (error) toast('Reaction not saved: ' + error.message); });
});

// ---------- polls, events, payment requests
function sendAction(ch: Chat, m: Message, action: string, value: any, undo?: () => void) {
  if (!live(ch, m)) return;
  sb.rpc('set_action', { m: m.sbId, a: action, v: value }).then(({ error }) => {
    if (!error) return;
    toast('Not saved: ' + error.message);
    if (undo) { undo(); refreshMsg(ch); }
  });
}
on('vote', (ch: Chat, m: Message, before?: string) => {
  const mine = Object.entries(m.votes || {}).filter(([, v]) => (v as string[]).includes('me')).map(([k]) => +k);
  sendAction(ch, m, 'vote', mine, before ? () => { m.votes = JSON.parse(before); } : undefined);
});
on('rsvp', (ch: Chat, m: Message, going: boolean) => {
  sendAction(ch, m, 'rsvp', !!going, () => { m.going = going ? (m.going || []).filter((x: string) => x !== 'me') : [...(m.going || []), 'me']; });
});
on('payDecline', (ch: Chat, m: Message) => sendAction(ch, m, 'decline', true, () => { m.status = 'pending'; }));
on('payRequest', (ch: Chat, m: Message) => {
  if (!live(ch, m)) return;
  const s = S as any;
  if (s.wallet < m.amount) { toast('Insufficient demo balance'); return true; }
  modal({
    title: 'Confirm payment',
    body: <>
      <div className="pay-confirm"><Avatar o={contact(m.from) as any} size={56} /><div className="muted">Paying {senderName(m.from)}</div><div className="pay-amount big">{money(m.amount)}</div>{m.note ? <div className="muted">{m.note}</div> : null}</div>
      <Note ic="info">Demo wallet: the amount moves between demo wallets only. No real money moves.</Note>
    </>,
    actions: [{ label: 'Cancel' }, { label: 'Pay ' + money(m.amount), primary: true, onClick: () => {
      s.wallet -= m.amount;
      const rec = { id: uid(), dir: 'out', amount: m.amount, with: senderName(m.from), note: m.note || 'Payment', t: Date.now() };
      s.payments.push(rec);
      applyAction(ch, { message_id: m.sbId, user_id: CL.user!.id, action: 'pay', value: { amount: m.amount } });
      commit();
      toast(`Paid ${money(m.amount)} to ${senderName(m.from)} ✅`);
      sendAction(ch, m, 'pay', { amount: m.amount }, () => {
        s.wallet += m.amount; s.payments = s.payments.filter((x: any) => x !== rec);
        m.paidBy = (m.paidBy || []).filter((x: string) => x !== 'me'); m.status = 'pending';
      });
    } }],
  });
  return true;
});

// ---------- reports go to the real Trust & Safety queue (the Command Center)
on('reportTarget', (o: { kind: string; name: string; cat: string; details?: string | null; cloud?: any; rec?: any }) => {
  if (!cloudOn() || !(o.cloud || o.kind === 'scam')) return;
  sb.from('reports').insert({ target_kind: o.kind, category: o.cat, target_label: String(o.name).slice(0, 120), details: o.details || null, ...(o.cloud || {}) })
    .then(({ error }) => {
      if (o.rec) { o.rec.status = error ? 'Not sent: ' + error.message : 'Sent to Trust & Safety'; commit(); }
      if (error) toast('Report not sent: ' + error.message);
    });
  return true;
});

// ---------- start a 1:1 chat, create and grow groups
export async function startCloudDM(userId: string) {
  if (!cloudOn()) return act.openAccountFlow('acct-signin');
  const p = CL.found.get(userId); if (p) upsertCloudContact(p);
  const { data, error } = await sb.rpc('start_direct', { other: userId });
  if (error) return toast('Could not start the chat: ' + error.message);
  await cloudSync();
  ui.page = null; ui.tab = 'chats';
  openChat(chid(data));
}
createGroupHooks.push(async (name, picked) => {
  const real = picked.filter((id) => contact(id)?.cloud);
  if (!real.length) return false;
  if (real.length !== picked.length) { toast('A live group can only include people with WHATSMORE accounts. Untick the demo contacts, or make a separate demo group.'); return true; }
  if (!cloudOn()) { act.openAccountFlow('acct-signin'); return true; }
  const { data, error } = await sb.rpc('create_group', { p_name: name, p_emoji: '👥', p_members: real.map(rawId) });
  if (error) { toast('Could not create the group: ' + error.message); return true; }
  ui.ngName = ''; ui.ngQuery = ''; ui.ngPick = []; ui.page = null;
  await cloudSync();
  openChat(chid(data));
  toast(`Live group “${name}” created`);
  return true;
});
addMembersHooks.push((ch, ids) => {
  if (!ch?.cloud) return undefined;
  const real = ids.filter((id) => contact(id)?.cloud && !ch.members!.includes(id));
  if (real.length !== ids.length) toast('Only people with WHATSMORE accounts can join a live group');
  if (!real.length) return 0;
  sb.rpc('add_group_members', { c: ch.sbId, p_members: real.map(rawId) }).then(({ error }) => { if (error) toast('Could not add: ' + error.message); else cloudSync(); });
  return real.length;
});

