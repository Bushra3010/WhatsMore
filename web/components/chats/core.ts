'use client';
// Open-chat logic ported from js/chat.js, js/messaging.js, js/features.js, js/privacy.js, js/devices.js,
// js/superapp.js and js/modules.js: constants, composer access, voice notes, reactions/votes, AI helpers,
// scheduled and disappearing messages, live translation and notification hooks.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { S, ui, commit, refresh } from '@/lib/state';
import type { Chat, Message } from '@/lib/types';
import { toast } from '@/lib/overlay';
import { uid, money, preview, senderName, firstName, chatById, chatTitle, contact } from '@/lib/util';
import { sendMsg, scheduleReply, simulateIncoming, beforeSend, replyRules, notifyHooks, fire } from '@/lib/actions';
import { act } from '@/lib/registry';
import { translateSentences, normPhrase, phraseKey, phraseIn } from '@/lib/translate';
import { profileMatch, profileOf, PROFILES, switchProfile } from '@/lib/profiles';

export const REACTS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
export const EMOJIS: Record<string, string[]> = {
  Smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🤯 😳 🥺 😱 🤔 🤗 🤫 😴 🙄 😬 🤝'.split(' '),
  Gestures: '👍 👎 👌 ✌️ 🤞 🙏 👏 🙌 💪 👋 🤙 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 🔥 ✨ ⭐ 🎉 🎊'.split(' '),
  Things: '☕ 🍛 🍕 🍔 🍰 🎂 🥐 🍞 🚗 ✈️ 🏖️ 🏝️ 🏠 📱 💻 📷 🎵 ⚽ 🏏 🎮 📚 💼 💸 🛍️ 🎁 📅 ⏰ ✅ ❌'.split(' '),
};
export const STICKERS = ['😺', '🐶', '🦄', '🐼', '🌈', '🎉', '💐', '🍕', '🚀', '👻', '🤖', '💯', '🥳', '😎', '🙏', '❤️‍🔥'];
export const GIFS = [
  { e: '😂', label: 'LOL', anim: 'bounce', bg: 'linear-gradient(135deg,#f6d365,#fda085)' },
  { e: '🎉', label: 'Party time', anim: 'spin', bg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { e: '🙏', label: 'Thank you', anim: 'pulse', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)' },
  { e: '😮', label: 'Wow', anim: 'shake', bg: 'linear-gradient(135deg,#fccb90,#d57eeb)' },
  { e: '👋', label: 'Hello!', anim: 'wave', bg: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)' },
  { e: '🔥', label: 'On fire', anim: 'pulse', bg: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { e: '💃', label: 'Dance', anim: 'bounce', bg: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
  { e: '😴', label: 'Sleepy', anim: 'float', bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
];

// ---------- small helpers
export const curChat = () => chatById(ui.active);
export const MS = <T,>(k: string, init: () => T): T => (S.mod[k] ??= init());
export const rawId = (id: string) => String(id).replace(/^(u_|sb_|sm_)/, '');
export const FORWARD_LIMIT = 5;
export const noForward = (ch?: Chat | null) => !!(ch && (ch.secret || ch.privacy?.noForward));
export const sysMsg = (ch: Chat, text: string) => ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text });

// ---------- composer access (the textarea lives in Composer; other code reads/writes it through here)
export const composer: { set: (t: string) => void; get: () => string; focus: () => void } = {
  set: (t) => { if (ui.active) ui.draft[ui.active] = t; },
  get: () => (ui.active ? ui.draft[ui.active] || '' : ''),
  focus: () => {},
};
export function setInput(t: string) { if (ui.active) ui.draft[ui.active] = t; composer.set(t); }
export function focusInput() { composer.focus(); }
export function setEmojiTab(t: string) { ui.emojiTab = t; refresh(); }

// ---------- sending
export function sendText(text: string) {
  const ch = curChat();
  if (!ch) return;
  text = text.trim();
  if (!text) return;
  setInput('');
  if (ui.editing) {
    const m = ch.messages.find((x) => x.id === ui.editing);
    ui.editing = null;
    if (m && m.text !== text) { const prev = m.text; m.text = text; m.edited = true; commit(); fire('edit', ch, m, prev); } else refresh();
    return;
  }
  const m = sendMsg(ch, { type: 'text', text }, { useReply: true });
  scheduleReply(ch, m);
}
export function sendQuick(partial: Partial<Message>) {
  const ch = curChat();
  if (!ch) return;
  const m = sendMsg(ch, partial, { useReply: true });
  scheduleReply(ch, m);
}

// ---------- jump / search
export function jumpTo(mid: string) {
  const row = document.querySelector<HTMLElement>(`#msgs [data-mid="${CSS.escape(mid)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
}
export function updateSearchCount(jump: boolean) {
  const rows = [...document.querySelectorAll<HTMLElement>('#msgs .msg-row')].filter((r) => r.querySelector('mark'));
  const cnt = document.getElementById('cs-count');
  if (!ui.chatSearch || !ui.chatSearch.trim()) { if (cnt) cnt.textContent = ''; return; }
  if (ui.searchIdx >= rows.length) ui.searchIdx = rows.length - 1;
  if (ui.searchIdx < 0) ui.searchIdx = 0;
  if (cnt) cnt.textContent = rows.length ? `${rows.length - ui.searchIdx} of ${rows.length}` : 'No results';
  const target = rows[rows.length - 1 - ui.searchIdx];
  if (jump && target) jumpTo(target.dataset.mid!);
}

// ---------- reactions, votes, events, payments
export function react(ch: Chat, m: Message, e: string) {
  m.reactions = m.reactions || {};
  const r = m.reactions;
  const had = (r[e] || []).includes('me');
  Object.keys(r).forEach((k) => { r[k] = r[k].filter((x) => x !== 'me'); if (!r[k].length) delete r[k]; });
  if (!had) (r[e] = r[e] || []).push('me');
  commit();
  fire('react', ch, m, had ? null : e);
}
export function vote(ch: Chat, m: Message, i: number) {
  const before = JSON.stringify(m.votes || {});
  const has = (m.votes[i] || []).includes('me');
  if (!m.multi) Object.keys(m.votes).forEach((k) => { m.votes[k] = (m.votes[k] || []).filter((v: string) => v !== 'me'); });
  if (!has) (m.votes[i] = m.votes[i] || []).push('me');
  else m.votes[i] = m.votes[i].filter((v: string) => v !== 'me');
  commit();
  fire('vote', ch, m, before);
}
export function toggleGoing(ch: Chat, m: Message) {
  const was = (m.going || []).includes('me');
  m.going = was ? m.going.filter((x: string) => x !== 'me') : [...(m.going || []), 'me'];
  commit();
  fire('rsvp', ch, m, !was);
}
export function toggleRemind(m: Message) { m.remind = !m.remind; commit(); toast(m.remind ? `We'll remind you before “${m.title}”` : 'Reminder removed'); }
export function payDecline(ch: Chat, m: Message) { m.status = 'declined'; commit(); fire('payDecline', ch, m); }
export function stopLive(m: Message) { m.live = Date.now() - 1; commit(); toast('Stopped sharing live location'); }
export function markSafe(m: Message) { m.safe = true; commit(); toast('Marked as safe'); }
export function toggleTranslate(ch: Chat) { ch.translate = !ch.translate; commit(); }
export function togglePin(m: Message) { m.pinned = !m.pinned; commit(); toast(m.pinned ? 'Message pinned' : 'Message unpinned'); }
export function toggleStar(m: Message) { m.starred = !m.starred; commit(); }
export function toggleMute(ch: Chat) { ch.muted = !ch.muted; commit(); toast(ch.muted ? 'Notifications muted' : 'Notifications unmuted'); }
export function addContact(ch: Chat) { const c = contact(ch.contactId); if (c) { c.isContact = true; commit(); toast(`${c.name} added to contacts`); } }
export function downloadInvoice(m: Message) {
  const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const rows = m.items.map((i: any) => `<tr><td>${i.qty} × ${e(i.name)}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Invoice ${e(m.orderId)}</title><body style="font-family:sans-serif;max-width:480px;margin:40px auto"><h2>${e(senderName(m.from))}</h2><p>Invoice ${e(m.orderId)} · ${new Date(m.t).toLocaleString()}</p><table style="width:100%">${rows}<tr><td><b>Total</b></td><td style="text-align:right"><b>${money(m.total)}</b></td></tr></table><p style="color:green"><b>PAID</b> via WHATSMORE Pay (demo)</p></body>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `Invoice_${m.orderId}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- voice notes: playback store (only voice bubbles re-render while playing)
export interface Playing { id: string; pos: number; dur: number; paused: boolean; audio?: HTMLAudioElement | null; tick?: ReturnType<typeof setInterval> }
export const voice: { playing: Playing | null; ver: number } = { playing: null, ver: 0 };
const voiceSubs = new Set<() => void>();
const emitVoice = () => { voice.ver++; voiceSubs.forEach((f) => f()); };
export const subscribeVoice = (f: () => void) => { voiceSubs.add(f); return () => { voiceSubs.delete(f); }; };
export function playVoice(mid: string) {
  const ch = curChat(), m = ch?.messages.find((x) => x.id === mid);
  if (!m) return;
  const p = voice.playing;
  if (p && p.id === mid) { p.paused = !p.paused; if (p.audio) { if (p.paused) p.audio.pause(); else p.audio.play().catch(() => {}); } emitVoice(); return; }
  stopVoice();
  const st: Playing = voice.playing = { id: mid, pos: 0, dur: m.dur, paused: false };
  if (m.src && (!m.src.startsWith('blob:') || ui.blobs.includes(m.src))) {
    st.audio = new Audio(m.src);
    st.audio.play().catch(() => { st.audio = null; });
    st.audio.onended = stopVoice;
  }
  st.tick = setInterval(() => {
    if (st.paused) return;
    if (st.audio) { st.pos = st.audio.currentTime; if (isFinite(st.audio.duration)) st.dur = st.audio.duration; }
    else { st.pos += 0.1; if (st.pos >= st.dur) { stopVoice(); return; } }
    emitVoice();
  }, 100);
  if (m.from !== 'me' && !m.played) { m.played = true; commit(); }
  emitVoice();
}
export function stopVoice() { const p = voice.playing; if (!p) return; clearInterval(p.tick); p.audio?.pause(); voice.playing = null; emitVoice(); }

// ---------- voice notes: recording (falls back to a simulated recording without a microphone)
export interface Rec { start: number; chunks: Blob[]; mr: MediaRecorder | null; stream: MediaStream | null; sim: boolean; ready?: boolean }
export async function startRecording() {
  const rec: Rec = { start: Date.now(), chunks: [], mr: null, stream: null, sim: false };
  ui.rec = rec;
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec.mr = new MediaRecorder(rec.stream);
    rec.mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
    rec.mr.start();
  } catch { rec.sim = true; }
  if (ui.rec !== rec) { rec.stream?.getTracks().forEach((t) => t.stop()); return; }
  rec.start = Date.now();
  rec.ready = true;
  refresh();
}
export function stopRecording(doSend: boolean) {
  const rec = ui.rec as Rec | null;
  if (!rec) return;
  ui.rec = null;
  const dur = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
  const ch = curChat();
  const finish = (src?: string) => {
    rec.stream?.getTracks().forEach((t) => t.stop());
    refresh();
    if (doSend && ch) { if (src && src.startsWith('blob:')) ui.blobs.push(src); const m = sendMsg(ch, { type: 'voice', dur, src }); scheduleReply(ch, m); }
  };
  if (rec.mr && rec.mr.state !== 'inactive') {
    const mr = rec.mr;
    mr.onstop = () => {
      if (!doSend) return finish();
      const blob = new Blob(rec.chunks, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 1.5e6) return finish(URL.createObjectURL(blob));
      const fr = new FileReader();
      fr.onload = () => finish(fr.result as string);
      fr.readAsDataURL(blob);
    };
    mr.stop();
  } else finish();
}

// ---------- voice AI
const TRANSCRIPTS: Record<string, { text: string; en?: string; sum: string }> = {
  c_siva: { text: 'అన్నా, PRD లో కొన్ని మార్పులు చేశాను, ఒకసారి చూడు. రేపు 11 గంటల మీటింగ్‌కి డెమో రెడీగా ఉంచు.', en: "Brother, I made some changes to the PRD, please check once. Keep the demo ready for tomorrow's 11 o'clock meeting.", sum: 'Review the PRD changes · Demo needed for tomorrow 11 AM meeting' },
  default: { text: 'Hi! Just wanted to check if everything is on track. Call me back when you are free.', sum: 'Check-in · wants a call back' },
};
export function transcribeVoice(_ch: Chat, m: Message) {
  if (m.transcript) { delete m.transcript; commit(); return; }
  toast('🎙️ Transcribing on your device…', null, { ms: 1200 });
  setTimeout(() => {
    const t = m.from === 'me' ? { text: '(Your voice note) Running 10 minutes late, start without me.', sum: 'Running late', en: undefined } : TRANSCRIPTS[m.from] || TRANSCRIPTS.default;
    m.transcript = t.text + (t.en ? `\n🌐 ${t.en}` : '') + `\n🧠 Summary (${Math.max(3, Math.round(m.dur / 4))}s read): ${t.sum}`;
    commit();
  }, 1100);
}

// ---------- smart replies
export function smartReplies(m: Message): string[] {
  const t = (m.tr || m.text || m.caption || '').toLowerCase();
  if (m.type === 'payment' && m.kind === 'request') return ['Paying now 💸', 'Thanks for sorting this!', 'Will pay by tonight'];
  if (m.type === 'image') return ['Wow 😍', 'Beautiful!', 'Where is this?'];
  if (m.type === 'voice') return ['Got it 👍', 'Will listen soon', 'Can you text instead?'];
  if (m.type === 'doc') return ['Received, thanks!', "I'll review it today", '👍'];
  if (m.type === 'poll') return ['Voted ✅', 'Any option works for me'];
  if (m.type === 'invoice') return ['Thank you! 🙏', 'What time can I pick it up?'];
  if (/meeting|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d\s?(am|pm)|o'clock|review/.test(t)) return ['See you then 👍', 'Can we push it by 30 min?', "I'll be there"];
  if (/thank/.test(t)) return ["You're welcome! 😊", 'Anytime 🙌', '❤️'];
  if (/^(hi|hey|hello|hii|welcome)/.test(t)) return ['Hey! 👋', 'Hi, how are you?', 'What are your opening hours?'];
  if (/eat|food|lunch|dinner/.test(t)) return ['Yes, done 😄', 'Not yet', 'On my way 🍛'];
  if (/call me/.test(t)) return ['Calling you now 📞', 'Will call in 10 min'];
  if (/\?/.test(t)) return ['Yes', 'No', 'Let me check and get back'];
  return ['👍', 'Sounds good!', 'Haha 😂'];
}

// ---------- AI writing tools (heuristic demo — swap for a real model in production)
const FIX_MAP: Record<string, string> = { u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', im: "I'm", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", isnt: "isn't", i: 'I', teh: 'the', recieve: 'receive', tommorow: 'tomorrow', tomorow: 'tomorrow', definately: 'definitely', wanna: 'want to', gonna: 'going to', btw: 'by the way', bcoz: 'because', coz: 'because' };
export const AI = {
  fix(s: string) {
    let t = s.trim().replace(/\b[\w']+\b/g, (w) => FIX_MAP[w.toLowerCase()] ?? w);
    t = t.replace(/\s+([,.!?])/g, '$1').replace(/([,.!?])(?=[A-Za-z])/g, '$1 ').replace(/\s{2,}/g, ' ');
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    if (!/[.!?…)]$/.test(t) && !/\p{Extended_Pictographic}$/u.test(t)) t += '.';
    return t;
  },
  formal(s: string) {
    let t = AI.fix(s).replace(/\p{Extended_Pictographic}️?/gu, '').replace(/!+/g, '.').trim();
    t = t.replace(/^(hey|hi+|yo|hello)\b[,!.]*\s*/i, 'Hello, ').replace(/\bthanks\b/gi, 'thank you').replace(/\b(ok|okay|k)\b/gi, 'certainly').replace(/\b(yeah|yep|ya)\b/gi, 'yes').replace(/\bnope\b/gi, 'no');
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    return t.replace(/\s+\./g, '.');
  },
  casual(s: string) {
    let t = s.trim().replace(/^hello\b/i, 'Hey').replace(/\bthank you\b/gi, 'thanks').replace(/\bcertainly\b/gi, 'sure').replace(/\.$/, '');
    if (!/\p{Extended_Pictographic}/u.test(t)) t += ' 😊';
    return t;
  },
  shorter(s: string) {
    let t = s.replace(/\b(just|really|actually|basically|very|kind of|sort of|I think that|in order to)\s+/gi, '').replace(/\s{2,}/g, ' ').trim();
    const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
    if (sentences.length > 1 && t.length > 80) t = sentences[0].trim();
    return t;
  },
  emoji(s: string) {
    const map: [RegExp, string][] = [[/\b(thanks|thank you)\b/i, '🙏'], [/\b(love|miss)\b/i, '❤️'], [/\b(party|celebrat)/i, '🎉'], [/\b(food|lunch|dinner|eat)\b/i, '🍛'], [/\b(meet|meeting|call)\b/i, '📅'], [/\b(great|awesome|super)\b/i, '🔥'], [/\b(sorry)\b/i, '😔'], [/\b(late|running)\b/i, '🏃']];
    const hit = map.find(([re]) => re.test(s));
    return s.trim() + ' ' + (hit ? hit[1] : '😊');
  },
};
export const AI_DRAFTS = ['Hi! Running about 10 minutes late — sorry, see you soon 🙏', 'Thank you so much for your help today, really appreciate it! 😊', 'Quick reminder: our meeting is tomorrow at 11 AM. Let me know if anything changes.', 'Happy birthday! 🎉 Wishing you an amazing year ahead!'];

// ---------- AI chat summary
export function summarize(ch: Chat) {
  const msgs = ch.messages.filter((m) => m.type !== 'system' && m.type !== 'deleted');
  const txt = (m: Message) => (m.type === 'text' ? m.tr || m.text : m.type === 'doc' ? 'Shared ' + m.name : m.caption || preview(m));
  const lines = msgs.map((m) => ({ m, s: String(txt(m) || '') }));
  const grab = (re: RegExp) => lines.filter((l) => re.test(l.s)).slice(-4);
  return {
    count: msgs.length,
    people: [...new Set(msgs.map((m) => senderName(m.from)))],
    key: lines.filter((l) => l.m.type === 'text' && l.s.length > 28).slice(-4),
    announcements: grab(/📢|important|announce|attention|will be off|notice|reminder/i),
    decisions: grab(/decided|decision|final|confirmed|booked|agreed|✅|we take|let's go with/i),
    tasks: grab(/please|pls|don't forget|dont forget|remember|need to|review|pay your|bring|forget/i),
    dates: grab(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2} o'?clock)\b/i),
    polls: msgs.filter((m) => m.type === 'poll').map((m) => { const best = m.options.map((o: string, i: number) => [o, (m.votes[i] || []).length] as [string, number]).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]; return `“${m.question}” — leading: ${best[0]} (${best[1]} vote${best[1] === 1 ? '' : 's'})`; }),
    pays: msgs.filter((m) => m.type === 'payment').map((m) => `${senderName(m.from)} ${m.kind === 'request' ? 'requested' : 'sent'} ${money(m.amount)}${m.note ? ' — ' + m.note : ''} (${m.status})`),
    files: msgs.filter((m) => m.type === 'doc').map((m) => m.name as string),
    links: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? (l.m.text || '').match(/https?:\/\/[^\s<]+/g) || [] : [])))].slice(-6),
    mentions: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? ((l.m.text || '').match(/@[a-z0-9._]{3,}/gi) || []).map((x) => x.toLowerCase()) : [])))],
    actions: grab(/please|pls|need to|can you|could you|will you|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow)|review|pay your|send|bring|share/i).map((l) => ({ ...l, who: firstName(l.m.from) })),
  };
}

// ---------- scheduled and disappearing messages (run from the Timers overlay)
export function runScheduled() {
  const due = S.scheduled.filter((s) => s.at <= Date.now());
  if (!due.length) return;
  S.scheduled = S.scheduled.filter((s) => s.at > Date.now());
  due.forEach((s) => { const ch = chatById(s.chatId); if (!ch) return; const m = sendMsg(ch, { type: 'text', text: s.text, scheduled: true }); scheduleReply(ch, m); toast(`Scheduled message sent to ${chatTitle(ch)}`); });
  commit();
}
export function sweepExpired() {
  const now = Date.now();
  let changed = false;
  S.chats.forEach((ch) => {
    const before = ch.messages.length;
    ch.messages = ch.messages.filter((m) => !m.exp || m.exp > now);
    if (ch.messages.length !== before) changed = true;
  });
  if (changed) commit();
}
// Best-effort screenshot detection: browsers only see some OS shortcuts
export function screenshotDetected() {
  const ch = curChat();
  if (!ch || !(ch.secret || ch.privacy?.screenshotAlert)) return;
  sysMsg(ch, '📸 You took a screenshot');
  commit();
  toast(`Screenshot alert sent to ${chatTitle(ch).replace('🔒 ', '')}`);
}

// ---------- live translation hooks (js/privacy.js two-way, js/superapp.js groups)
const memberLang = (id: string) => contact(id)?.lang || 'en';
beforeSend.push((ch, partial) => {
  // group: everyone reads in their own language
  if (ch?.type === 'group' && ch.live && partial?.type === 'text') {
    const langs = [...new Set([ch.live.their, ...(ch.members || []).map(memberLang)])].filter((l) => l !== ch.live.my);
    const outs = langs.map((lang) => ({ lang, text: translateSentences(partial.text || '', lang) })).filter((x) => x.text && normPhrase(x.text) !== normPhrase(partial.text || ''));
    if (outs.length) partial.liveOuts = outs;
  }
  // outgoing: attach the version the other person reads
  if (ch?.live && partial?.type === 'text' && ch.live.their !== ch.live.my) {
    const r = translateSentences(partial.text || '', ch.live.their);
    if (r && normPhrase(r) !== normPhrase(partial.text || '')) partial.liveOut = { lang: ch.live.their, text: r };
  }
});
replyRules.push((ch, trig) => {
  if (ch?.type === 'group' && ch.live && trig?.type === 'text' && !ch.readOnly) {
    const k = phraseKey((trig.text || '').split(/(?<=[.?!।])\s+/)[0]);
    const reply = k === 'how are you' ? 'i am fine' : k === 'good morning' ? 'good morning' : k === 'where are you' ? 'i will come tomorrow' : k === 'thank you' ? 'see you soon' : null;
    if (reply) {
      const byLang: Record<string, string> = {};
      (ch.members || []).forEach((id) => { const l = memberLang(id); if (!byLang[l] && contact(id)) byLang[l] = id; });
      const speakers = Object.entries(byLang).filter(([l]) => l !== ch.live.my).slice(0, 2);
      speakers.forEach(([l, id], i) => simulateIncoming(ch, id, { text: phraseIn(reply, l) }, 900 + i * 2600));
      if (speakers.length) return true;
    }
  }
  return false;
});
replyRules.push((ch, trig) => {
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  if (ch?.live && ch.type === 'direct' && trig?.type === 'text' && !c?.business && !c?.blocked) {
    const k = phraseKey((trig.text || '').split(/(?<=[.?!।])\s+/)[0]);
    const reply = k === 'how are you' ? ['i am fine', 'how are you'] : k === 'thank you' ? ['see you soon'] : k === 'good morning' ? ['good morning', 'how are you'] : k === 'where are you' ? ['i will come tomorrow'] : null;
    if (reply) { simulateIncoming(ch, ch.contactId!, { text: reply.map((x) => phraseIn(x, ch.live.their)).join(' ') }, 900); return true; }
  }
  return false;
});

// ---------- notification layers: notification center + Do Not Disturb (superapp.js), profiles (privacy.js), focus mode (modules.js)
export function dndActive() {
  const w = S.settings.wellbeing || {};
  if (!w.dnd) return false;
  const h = new Date().getHours(), d = new Date().getDay();
  return w.dndPlan === 'always' || (w.dndPlan === 'night' && (h >= 22 || h < 7)) || (w.dndPlan === 'work' && d >= 1 && d <= 5 && h >= 9 && h < 18) || (w.dndPlan === 'weekend' && (d === 0 || d === 6));
}
notifyHooks.push((ch, from, text) => {
  act.logNotif(contact(ch.contactId)?.business ? 'business' : 'messages', chatTitle(ch), (ch.type === 'group' ? firstName(from) + ': ' : '') + text, { chatId: ch.id });
  if (dndActive()) return true;
  if (!profileMatch(ch)) {
    const [name, e] = PROFILES[profileOf(ch)] || PROFILES.personal;
    toast(`${e} New message in your ${name} profile`, () => switchProfile(profileOf(ch)));
    return true;
  }
  if (S.settings.wellbeing?.focus) return true;
  return false;
});

