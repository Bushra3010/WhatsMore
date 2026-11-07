'use client';
// Messaging engine ported from js/messaging.js + js/features.js: send, delivery ticks, simulated
// replies (people + business bot), votes and payment simulation, notifications, opening chats,
// starting chats and groups. Mutate S, then commit() (or refresh() for UI-only changes).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { S, ui, commit, refresh } from './state';
import type { Chat, Message } from './types';
import { toast } from './overlay';
import {
  uid, pick, sample, MIN, DAY, money, contact, chatById, chatTitle, senderName, firstName, isBiz, productById, preview,
  directChatFor, ensureContact, namesSummary, COLORS,
} from './util';
import { act } from './registry';

export const REPLIES: Record<string, any[]> = {
  c_siva: [{ text: 'సరే అన్నా 👍', tr: 'Okay brother 👍' }, { text: 'నేను తర్వాత కాల్ చేస్తా', tr: "I'll call you later" }, { text: 'చాలా బాగుంది! 🔥', tr: 'Very nice! 🔥' }],
  c_priya: [{ text: 'ठीक है! 😊', tr: 'Okay! 😊' }, { text: 'मैं अभी बिज़ी हूँ, बाद में बात करते हैं', tr: "I'm busy right now, let's talk later" }, { text: 'बहुत बढ़िया! 🎉', tr: 'Awesome! 🎉' }],
  c_ramesh: ['Sure, noted.', "Thanks! I'll get back to you by evening.", 'Sounds good 👍'],
  c_ananya: ['Haha yes 😂', 'Omg same!!', "Let's catch up this weekend ☕"],
  c_arjun: ['Done ✅', 'On it 🙌', 'Bro 😂'],
  c_mom: ['Okay beta ❤️', 'Eat properly and sleep on time 😊', 'Call me when you are free'],
  default: ['👍', 'Got it!', 'Sounds good 😊', 'Hi! Thanks for connecting 👋'],
};
export const DISAPPEAR: Record<string, [string, number]> = { '1m': ['1 minute (demo)', MIN], '24h': ['24 hours', DAY], '7d': ['7 days', 7 * DAY], '90d': ['90 days', 90 * DAY] };

// ---------- hooks for the live layer and other areas
/** Interceptors run before a message is added; return false to cancel (e.g. suspended accounts). */
export const beforeSend: ((ch: Chat, partial: Partial<Message>) => boolean | void)[] = [];
/** Run after a message is added (e.g. the live layer uploads it to Supabase). */
export const afterSend: ((ch: Chat, m: Message) => void)[] = [];
/** Return true to stop the simulated bot reply for this chat (live chats have real people). */
export const replyGuards: ((ch: Chat, trig: Message) => boolean)[] = [];

export function sendMsg(ch: Chat, partial: Partial<Message>, opts: { useReply?: boolean } = {}): Message | null {
  for (const g of beforeSend) if (g(ch, partial) === false) return null;
  const m: Message = { id: uid(), from: 'me', t: Date.now(), status: 'sent', reactions: {}, type: 'text', ...partial } as Message;
  if (opts.useReply && ui.replyTo && ch.id === ui.active) m.replyTo = ui.replyTo;
  if (opts.useReply) ui.replyTo = null;
  if (ch.disappearing) m.exp = m.t + DISAPPEAR[ch.disappearing][1];
  ch.messages.push(m);
  commit();
  afterSend.forEach((f) => f(ch, m));
  progressTicks(ch, m);
  return m;
}
export const tickHooks: ((ch: Chat, m: Message) => boolean)[] = [];
export function progressTicks(ch: Chat, m: Message) {
  if (tickHooks.some((h) => h(ch, m))) return;
  if (ch.request === 'pending') return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  if (c?.blocked) return;
  setTimeout(() => { if (m.status === 'sent') { m.status = 'delivered'; commit(); } }, 700);
  if (S.settings.privacy.readReceipts && !ch.privacy?.hideReceipts && (ch.type === 'group' || c?.online || c?.business)) setTimeout(() => { m.status = 'read'; commit(); }, 1900);
}
export const refreshMsg = (_ch?: Chat) => commit();

// ---------- simulated other side
export function personReply(c: any, trig?: Message): any {
  const t = (trig?.text || '').toLowerCase();
  if (/how are you|how r u|kaise ho|ela unnav/.test(t)) return c.lang === 'te' ? { text: 'నేను బాగున్నా! నువ్వు?', tr: "I'm good! You?" } : c.lang === 'hi' ? { text: 'मैं ठीक हूँ! तुम कैसे हो?', tr: "I'm fine! How are you?" } : "I'm good! You? 😊";
  if (trig?.type === 'payment' && trig.kind === 'send') return 'Received, thank you! 🙏';
  if (trig?.type === 'image' || trig?.type === 'video') return pick(['Wow 😍', 'Send more pics!', 'Beautiful 🔥']);
  if (trig?.type === 'voice') return pick(['Listening now 🎧', 'Got your voice note 👍']);
  if (trig?.type === 'doc') return pick(['Got the file, thanks!', 'Downloading now 📥']);
  if (trig?.type === 'sticker' || trig?.type === 'gif') return pick(['😂😂', 'Haha', '🤣']);
  if (trig?.type === 'event') return 'Count me in! 🙌';
  return pick(REPLIES[c?.id] || REPLIES.default);
}
/** Extra reply rules registered by other areas (live translation, group translation …). Return true when handled. */
export const replyRules: ((ch: Chat, trig: Message) => boolean)[] = [];
export function scheduleReply(ch: Chat, trig?: Message | null) {
  if (!trig) return;
  if (replyGuards.some((g) => g(ch, trig))) return;
  if (replyRules.some((r) => r(ch, trig))) return;
  if (['poll', 'payment', 'contact'].includes(trig.type) && !isBiz(ch)) {
    if (trig.type === 'poll') simulateVotes(ch, trig);
    if (trig.type === 'payment' && trig.kind === 'request') simulatePayRequest(ch, trig);
    if (!(trig.type === 'payment' && trig.kind === 'send')) return;
  }
  if (ch.type === 'direct') {
    const c = contact(ch.contactId);
    if (!c || c.blocked || ch.request === 'pending') return;
    const reply = c.business ? bizReply(ch, trig) : personReply(c, trig);
    if (reply) simulateIncoming(ch, c.id, reply, 900 + Math.random() * 1200);
  } else if (!ch.readOnly && !ch.left && ch.members?.length && Math.random() < 0.7) {
    const who = pick(ch.members);
    simulateIncoming(ch, who, personReply(contact(who), trig), 1500 + Math.random() * 2000);
  }
}
export function simulateIncoming(ch: Chat, from: string, msgs: any, delay = 1000) {
  const list: any[] = Array.isArray(msgs) ? msgs : [msgs];
  setTimeout(() => {
    ui.typing[ch.id] = firstName(from);
    refresh();
    const len = typeof list[0] === 'string' ? list[0].length : (list[0]?.text || '').length;
    setTimeout(() => {
      delete ui.typing[ch.id];
      list.forEach((p, i) => {
        const mm: Message = { id: uid(), from, t: Date.now() + i, status: 'read', reactions: {}, type: 'text', ...(typeof p === 'string' ? { text: p } : p) };
        if (ch.disappearing) mm.exp = mm.t + DISAPPEAR[ch.disappearing][1];
        ch.messages.push(mm);
      });
      if (S.settings.privacy.readReceipts) ch.messages.forEach((x) => { if (x.from === 'me' && x.status !== 'read') x.status = 'read'; });
      if (ch.id !== ui.active) { ch.unread = (ch.unread || 0) + list.length; notify(ch, from, list[list.length - 1]); }
      commit();
    }, 800 + Math.min(2200, len * 28));
  }, delay);
}
/** Notification hooks (notification center log, Do Not Disturb, focus mode). Return true to silence the toast. */
export const notifyHooks: ((ch: Chat, from: string, text: string) => boolean | void)[] = [];
export function notify(ch: Chat, from: string, p: any) {
  if (ch.muted) return;
  const text = typeof p === 'string' ? p : preview({ type: 'text', ...p } as Message);
  let silent = false;
  notifyHooks.forEach((h) => { if (h(ch, from, text)) silent = true; });
  if (silent) return;
  toast(<span><b>{chatTitle(ch)}</b>{ch.type === 'group' ? ' · ' + firstName(from) : ''}: {String(text).slice(0, 80)}</span>, () => openChat(ch.id), { ms: 4500 });
}
export function simulateVotes(ch: Chat, m: Message) {
  const voters = ch.type === 'group' ? sample(ch.members || [], 25) : [ch.contactId!];
  voters.forEach((v, i) => {
    if (Math.random() < 0.25) return;
    setTimeout(() => {
      const opt = Math.floor(Math.random() * m.options.length);
      (m.votes[opt] = m.votes[opt] || []).push(v);
      commit();
    }, 1500 + i * 1300 + Math.random() * 800);
  });
}
export function simulatePayRequest(ch: Chat, m: Message) {
  const payers = ch.type === 'group' ? sample(ch.members || [], 15) : [ch.contactId!];
  payers.forEach((p, i) => setTimeout(() => {
    if (m.status !== 'pending') return;
    m.paidBy = [...(m.paidBy || []), p];
    S.wallet += m.amount;
    S.payments.push({ id: uid(), dir: 'in', amount: m.amount, with: senderName(p), note: m.note || 'Payment request', t: Date.now() });
    if (m.paidBy.length >= (m.split ? m.split.people : 1)) m.status = 'paid';
    commit();
    toast(`${senderName(p)} paid you ${money(m.amount)}`);
  }, 2500 + i * 2200));
}

// ---------- business AI assistant
const PRODUCT_KW: [RegExp, string][] = [[/cupcake/, 'p4'], [/cake/, 'p1'], [/croissant/, 'p2'], [/sourdough|bread|loaf/, 'p3']];
/** Extra business bots (marketplace sellers, services) registered by other areas. Return a reply or undefined. */
export const bizBots: ((ch: Chat, trig: Message) => any)[] = [];
export function bizReply(ch: Chat, trig: Message): any {
  for (const b of bizBots) { const r = b(ch, trig); if (r !== undefined) return r; }
  const c = contact(ch.contactId)!, products = S.catalog[c.id] || [];
  if (trig.type === 'product') {
    const p = productById(trig.productId)!;
    if (!p.stock) return { text: `Sorry, ${p.name} is sold out today 😔 It'll be back tomorrow morning.`, bot: true };
    const orderId = 'SB-' + (1000 + Math.floor(Math.random() * 9000));
    return [
      { text: `Great choice! ${p.emoji} *${p.name}* is available.\nOrder ${orderId} · Total ${money(p.price)}. Please complete the payment below 👇`, bot: true },
      { type: 'payment', kind: 'request', amount: p.price, note: `Order ${orderId} · ${p.name}`, orderId, items: [{ name: p.name, qty: 1, price: p.price }], status: 'pending', paidBy: [], bot: true },
    ];
  }
  if (trig.type === 'payment') return { text: 'Payment received, thank you! 🙏', bot: true };
  if (trig.type !== 'text') return { text: 'Thanks! 😊 How can we help you today?', bot: true };
  const t = (trig.text || '').toLowerCase();
  const kw = PRODUCT_KW.find(([re]) => re.test(t));
  const prod = kw && productById(kw[1]);
  if (/open|close|hour|timing|time|when/.test(t)) return { text: "We're open Monday–Saturday, 9:00 AM – 9:00 PM 🕘\nTomorrow we open at 9:00 AM.", bot: true };
  if (/deliver/.test(t)) return { text: 'Yes! We deliver within 5 km 🚚 Free delivery on orders above ₹500.', bot: true };
  if (/where|address|location|direction/.test(t)) return { text: `📍 ${c.business?.address}\nSee you soon!`, bot: true };
  if (/appointment|book|custom|birthday|party/.test(t)) return { text: 'We take custom cake orders with 24 hours notice 🎂 Would you like a tasting slot tomorrow at 11 AM?', bot: true };
  if (prod && !/price|cost|how much/.test(t)) return { text: prod.stock ? `Yes! ${prod.emoji} ${prod.name} is available today at ${money(prod.price)}. Tap + → Catalogue to order.` : `${prod.name} is sold out today, sorry! 😔`, bot: true };
  if (/price|cost|menu|catalog|how much|rate|list|available/.test(t)) return { text: "Here are today's prices:\n" + products.map((p) => `${p.emoji} ${p.name} — ${money(p.price)}${p.stock ? '' : ' (sold out)'}`).join('\n') + '\n\nTap + → Catalogue to order 🛍️', bot: true };
  if (/order|buy/.test(t)) return { text: 'Sure! Tap + → Catalogue and choose any item. You can pay right here in the chat 💳', bot: true };
  if (/thank/.test(t)) return { text: "You're welcome! Have a sweet day 🧁", bot: true };
  if (/^(hi|hey|hello|namaste)/.test(t)) return { text: 'Hello! 👋 Welcome to Sunrise Bakery. Ask me about hours, prices, delivery or orders.', bot: true };
  return { text: 'Thanks for your message! A team member will reply shortly. Meanwhile I can help with hours, prices, delivery and orders 🙂', bot: true };
}

// ---------- open / close chats, start chats and groups
/** Run when a chat opens (read receipts for live chats, PIN checks …). Return false to block opening. */
export const openGuards: ((ch: Chat, proceed: () => void) => boolean | void)[] = [];
export const onOpenChat: ((ch: Chat) => void)[] = [];
export function openChat(id: string, opts: { mid?: string } = {}) {
  const ch = chatById(id);
  if (!ch) return;
  const proceed = () => openChat(id, opts);
  for (const g of openGuards) if (g(ch, proceed) === false) return;
  ui.active = id; ui.view = null; ui.replyTo = null; ui.editing = null; ui.chatSearch = null; ui.emojiOpen = false;
  if (ui.drawer === 'starred') ui.drawer = null;
  ch.unread = 0;
  if (opts.mid) ui.jumpTo = opts.mid;
  commit();
  onOpenChat.forEach((f) => f(ch));
}
export function closeChat() { ui.active = null; ui.drawer = null; refresh(); }

export function startDM(userId: string) {
  let c = contact(userId);
  if (!c) {
    const u = S.directory.find((x) => x.id === userId);
    if (!u) return;
    c = { ...u, isContact: false, online: true };
    S.contacts.push(c);
  }
  let ch = directChatFor(c.id);
  if (!ch) {
    const t = Date.now();
    ch = { id: 'ch_' + uid(), type: 'direct', contactId: c.id, unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' }] };
    if (!c.isContact) {
      const chat = ch;
      chat.request = 'pending';
      chat.messages.push({ id: uid(), type: 'system', from: 'system', t: t + 1, text: `You sent a chat request to @${c.username}. Your phone number stays hidden.` });
      setTimeout(() => {
        chat.request = 'accepted';
        chat.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `@${c!.username} accepted your chat request` });
        chat.messages.forEach((m) => { if (m.from === 'me') m.status = 'read'; });
        commit();
      }, 3500);
    }
    S.chats.push(ch);
  }
  ui.page = null; ui.tab = 'chats';
  openChat(ch.id);
}

/** Group creation hooks (live groups are created on the server). Return true when handled. */
export const createGroupHooks: ((name: string, picked: string[]) => boolean | Promise<boolean>)[] = [];
export async function createGroup() {
  const name = ui.ngName.trim();
  if (!name) return toast('Enter a group name');
  if (!ui.ngPick.length) return toast('Select at least one member');
  for (const h of createGroupHooks) if (await h(name, ui.ngPick.slice())) return;
  const members = ui.ngPick.filter((id) => ensureContact(id)), t = Date.now();
  const g: Chat = {
    id: 'ch_' + uid(), type: 'group', name, emoji: '👥', color: pick(COLORS), members, admins: ['me'], description: '', unread: 0,
    messages: [
      { id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' },
      { id: uid(), type: 'system', from: 'system', t: t + 1, text: `You created group "${name}"` },
      { id: uid(), type: 'system', from: 'system', t: t + 2, text: 'You added ' + namesSummary(members, 5) },
    ],
  };
  S.chats.push(g);
  ui.ngName = ''; ui.ngQuery = ''; ui.ngPick = []; ui.page = null;
  openChat(g.id);
  simulateIncoming(g, members[0], 'Hey everyone 👋', 1500);
}
/** Add members (no participant limit). Live groups register a hook. */
export const addMembersHooks: ((ch: Chat, ids: string[], how: string) => number | undefined)[] = [];
export function addMembers(ch: Chat, ids: string[], how = 'You added'): number {
  for (const h of addMembersHooks) { const r = h(ch, ids, how); if (r !== undefined) return r; }
  const have = new Set(ch.members);
  ids = ids.filter((id) => !have.has(id) && ensureContact(id));
  if (!ids.length) return 0;
  ch.members = [...(ch.members || []), ...ids];
  ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: how === 'joined' ? `${namesSummary(ids, 3)} joined using this group's invite link` : 'You added ' + namesSummary(ids, 5) });
  commit();
  return ids.length;
}

export const allChats = () => S.chats;
export { act };

// ---------- events between the chat UI and the live layer
// The chat UI fires these after (or instead of) a local change; the live layer listens.
// fire() returns true when a listener returned true ("handled" — skip the local/demo behaviour).
//   'react'             (ch, m, emoji | null)   after the local reaction toggle
//   'edit'              (ch, m, previousText)   after a local edit
//   'deleteForEveryone' (ch, m) → handled?      live chats delete on the server instead
//   'vote'              (ch, m)                 after the local vote change
//   'rsvp'              (ch, m, going: boolean) after the local Going toggle
//   'payRequest'        (ch, m) → handled?      live chats show their own confirm + server action
//   'payDecline'        (ch, m)                 after the local decline
//   'reportTarget'      (opts) → handled?       a report the live layer should send to the real queue
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Listener = (...args: any[]) => boolean | void;
const listeners: Record<string, Listener[]> = {};
export function on(event: string, fn: Listener) { (listeners[event] ||= []).push(fn); }
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function fire(event: string, ...args: any[]): boolean {
  let handled = false;
  (listeners[event] || []).forEach((fn) => { if (fn(...args) === true) handled = true; });
  return handled;
}
