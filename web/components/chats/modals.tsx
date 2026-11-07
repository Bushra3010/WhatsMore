'use client';
// Chat modals: payments, polls, events, contacts, catalogue, scheduling, AI summary, translation,
// chat privacy, live translation, location, reports, scams, AI photo enhance, media sending.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from 'react';
import { S, ui, commit, useRender } from '@/lib/state';
import type { Chat, Contact, Message } from '@/lib/types';
import { modal, toast, confirmModal, readImage, pickFile } from '@/lib/overlay';
import { uid, money, contact, senderName, chatTitle, firstName, isAdmin, preview, sample, dayLabel, fmtTime, MIN, HOUR, DAY } from '@/lib/util';
import { sendMsg, scheduleReply, simulateIncoming, openChat, fire } from '@/lib/actions';
import { act } from '@/lib/registry';
import { LANG_LIST, langName, translateText, readAloud } from '@/lib/translate';
import { scamCheck } from '@/lib/scam';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Note } from '@/components/ui/Bits';
import { MS, rawId, curChat, summarize, runScheduled, composer, setInput, sysMsg } from './core';

const q = <T extends Element = HTMLInputElement>(root: Element, sel: string) => root.querySelector(sel) as T | null;
const val = (root: Element, sel: string) => (q<HTMLInputElement>(root, sel)?.value || '');

// ---------- payments
export function payRequest(ch: Chat, m: Message) {
  if (fire('payRequest', ch, m)) return;
  if (S.wallet < m.amount) return toast('Insufficient demo balance');
  const to = m.from;
  modal({
    title: 'Confirm payment',
    body: (
      <div className="pay-confirm"><Avatar o={contact(to)} size={56} /><div className="muted">Paying {senderName(to)}</div><div className="pay-amount big">{money(m.amount)}</div>{m.note ? <div className="muted">{m.note}</div> : null}
        <div className="hint-box"><Icon name="info" size={16} /><span>Demo payment — no real money moves. Balance after: {money(S.wallet - m.amount)}</span></div></div>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Pay ' + money(m.amount), primary: true, onClick: () => {
        m.paidBy = [...(m.paidBy || []), 'me'];
        if (!m.split || m.paidBy.length >= m.split.people) m.status = 'paid';
        S.wallet -= m.amount;
        S.payments.push({ id: uid(), dir: 'out', amount: m.amount, with: senderName(to), note: m.note || 'Payment', t: Date.now() });
        commit();
        toast(`Paid ${money(m.amount)} to ${senderName(to)} ✅`);
        if (m.orderId) {
          simulateIncoming(ch, to, [
            { type: 'invoice', orderId: m.orderId, items: m.items, total: m.amount, bot: true },
            { text: 'Payment received ✅ Your order will be ready for pickup in 2 hours. Thank you! 🧁', bot: true },
          ], 900);
        }
      },
    }],
  });
}

function PayBody({ ch, init, onMode }: { ch: Chat; init: string; onMode: (k: string) => void }) {
  const group = ch.type === 'group';
  const n = group ? (ch.members || []).length + 1 : 2;
  const [mode, setMode] = useState(init);
  const [amt, setAmt] = useState('');
  const tabs: [string, string][] = group ? [['split', 'Split bill'], ['send', 'Send']] : [['send', 'Send'], ['request', 'Request']];
  const a = parseFloat(amt) || 0;
  const info = mode === 'split' ? `${money(Math.round((a / n) * 100) / 100)} each · split between ${n} people (including you)` : mode === 'request' ? `${senderName(ch.contactId!)} will get a request to pay you` : '';
  const pick = (k: string) => { onMode(k); setMode(k); };
  return (
    <>
      <div className="seg">{tabs.map(([k, l]) => <button key={k} className={k === mode ? 'on' : ''} data-mode={k} onClick={() => pick(k)}>{l}</button>)}</div>
      {group ? <label className="field" id="pm-to-wrap" hidden={mode !== 'send'}><span>Send to</span><select id="pm-to">{(ch.members || []).slice(0, 500).map((id) => <option key={id} value={id}>{senderName(id)}</option>)}</select></label> : null}
      <label className="field"><span id="pm-amt-label">{mode === 'split' ? 'Total bill amount (₹)' : 'Amount (₹)'}</span><input id="pm-amt" type="number" min="1" step="1" inputMode="decimal" placeholder="0" autoFocus value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
      <label className="field"><span>Note</span><input id="pm-note" maxLength={60} placeholder="e.g. Dinner bill" /></label>
      <div className="muted small" id="pm-info">{info}</div>
      <div className="hint-box"><Icon name="info" size={16} /><span>Demo wallet: {money(S.wallet)}. Payments are simulated; production requires licensed payment partners.</span></div>
    </>
  );
}
export function payModal(ch: Chat) {
  const group = ch.type === 'group';
  const n = group ? (ch.members || []).length + 1 : 2;
  const st = { mode: group ? 'split' : 'send' };
  modal({
    title: 'Payments',
    body: <PayBody ch={ch} init={st.mode} onMode={(k) => { st.mode = k; }} />,
    actions: [{ label: 'Cancel' }, {
      label: 'Continue', primary: true, onClick: (root) => {
        const amt = Math.round(parseFloat(val(root, '#pm-amt')) * 100) / 100;
        const note = val(root, '#pm-note').trim();
        if (!(amt > 0)) { toast('Enter an amount'); return false; }
        if (st.mode === 'send') {
          if (amt > S.wallet) { toast('Insufficient demo balance'); return false; }
          const to = group ? q<HTMLSelectElement>(root, '#pm-to')!.value : ch.contactId!;
          S.wallet -= amt;
          S.payments.push({ id: uid(), dir: 'out', amount: amt, with: senderName(to), note: note || 'Payment', t: Date.now() });
          const m = sendMsg(ch, { type: 'payment', kind: 'send', amount: amt, note: group ? `To ${senderName(to)}${note ? ' · ' + note : ''}` : note, status: 'paid' });
          scheduleReply(ch, m);
        } else if (st.mode === 'request') {
          const m = sendMsg(ch, { type: 'payment', kind: 'request', amount: amt, note, status: 'pending', paidBy: [] });
          scheduleReply(ch, m);
        } else {
          const share = Math.round((amt / n) * 100) / 100;
          const m = sendMsg(ch, { type: 'payment', kind: 'request', amount: share, note: note || 'Split bill', split: { total: amt, people: n }, status: 'pending', paidBy: ['me'] });
          scheduleReply(ch, m);
        }
      },
    }],
  });
}

// ---------- polls / events
function PollBody() {
  const [n, setN] = useState(2);
  return (
    <>
      <label className="field"><span>Question</span><input id="pl-q" maxLength={120} placeholder="Ask a question" autoFocus /></label>
      <div className="field"><span>Options</span><div id="pl-opts">{Array.from({ length: n }, (_, i) => <input key={i} className="pl-opt" maxLength={60} placeholder={`Option ${i + 1}`} autoFocus={i >= 2 && i === n - 1} />)}</div>
        <button className="link-btn" id="pl-add" onClick={() => setN((x) => Math.min(8, x + 1))}>+ Add option</button></div>
      <label className="set-row plain"><span>Allow multiple answers</span><input type="checkbox" className="switch" id="pl-multi" /></label>
    </>
  );
}
export function pollModal(ch: Chat) {
  modal({
    title: 'Create poll',
    body: <PollBody />,
    actions: [{ label: 'Cancel' }, {
      label: 'Send', primary: true, onClick: (root) => {
        const qn = val(root, '#pl-q').trim();
        const opts = [...root.querySelectorAll<HTMLInputElement>('.pl-opt')].map((i) => i.value.trim()).filter(Boolean);
        if (!qn || opts.length < 2) { toast('Add a question and at least 2 options'); return false; }
        const m = sendMsg(ch, { type: 'poll', question: qn, options: opts, votes: {}, multi: q<HTMLInputElement>(root, '#pl-multi')!.checked });
        scheduleReply(ch, m);
      },
    }],
  });
}
const toLocal = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * MIN).toISOString().slice(0, 16);
export function eventModal(ch: Chat) {
  const d = new Date(Date.now() + DAY); d.setHours(18, 0, 0, 0);
  modal({
    title: 'Create event',
    body: (
      <>
        <label className="field"><span>Event name</span><input id="ev-t" maxLength={60} placeholder="e.g. Team dinner" autoFocus /></label>
        <label className="field"><span>Date &amp; time</span><input id="ev-d" type="datetime-local" defaultValue={toLocal(d.getTime())} /></label>
        <label className="field"><span>Location (optional)</span><input id="ev-p" maxLength={60} placeholder="Add a place" /></label>
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Send', primary: true, onClick: (root) => {
        const title = val(root, '#ev-t').trim(), when = new Date(val(root, '#ev-d')).getTime();
        if (!title || !when) { toast('Add a name and date'); return false; }
        const m = sendMsg(ch, { type: 'event', title, when, place: val(root, '#ev-p').trim(), going: ['me'] });
        if (!m || ch.cloud) return;
        (ch.type === 'group' ? sample(ch.members || [], 25) : [ch.contactId!]).forEach((p, i) => setTimeout(() => { if (Math.random() < 0.7) { m.going.push(p); commit(); } }, 2000 + i * 1500));
      },
    }],
  });
}

// ---------- contacts, catalogue
export function shareContactModal(ch: Chat) {
  const people = S.contacts.filter((c) => c.isContact && c.id !== ch.contactId);
  modal({
    title: 'Share contact',
    body: <div className="pick-list">{people.map((c, i) => <label key={c.id} className="chat-item check-row"><Avatar o={c} size={40} /><div className="ci-body"><div className="ci-name">{c.name}</div><div className="ci-preview">@{c.username}</div></div><input type="radio" name="sc" className="check" value={c.id} defaultChecked={i === 0} /></label>)}</div>,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const id = q<HTMLInputElement>(root, 'input[name=sc]:checked')?.value; if (id) sendMsg(ch, { type: 'contact', userId: id }); } }],
  });
}
export function catalogModal(ch: Chat) {
  const c = contact(ch.contactId)!, items = S.catalog[c.id] || [];
  let close = () => {};
  const order = (pid: string) => {
    close();
    if (ui.active !== ch.id) openChat(ch.id);
    const m = sendMsg(ch, { type: 'product', productId: pid, text: "Hi! I'd like to order this 🙂" });
    scheduleReply(ch, m);
  };
  close = modal({
    title: `${c.name} · Catalogue`,
    wide: true,
    body: (
      <>
        <div className="catalog">{items.map((p) => (
          <div key={p.id} className="cat-item"><div className="prod-art big" style={{ background: p.bg }}>{p.emoji}</div><div className="ev-title">{p.name}</div><div className="ci-sub">{p.desc}</div>
            <div className="cat-foot"><b>{money(p.price)}</b>{p.stock ? <button className="btn sm primary" data-order={p.id} onClick={() => order(p.id)}>Order</button> : <span className="pill">Sold out</span>}</div></div>
        ))}</div>
        <p className="muted small">Product → Chat → Order → Payment → Invoice, all inside WHATSMORE.</p>
      </>
    ),
  }).close;
}

// ---------- scheduled messages
function ScheduleBody({ draft, chips }: { draft: string; chips: [string, number][] }) {
  const [at, setAt] = useState(() => toLocal(chips[0][1]));
  return (
    <>
      <label className="field"><span>Message</span><textarea id="sc-text" rows={3} maxLength={1000} placeholder="Type your message" autoFocus defaultValue={draft} /></label>
      <div className="chips">{chips.map(([l, t]) => <button key={l} className="chip" data-at={toLocal(t)} onClick={() => setAt(toLocal(t))}>{l}</button>)}</div>
      <label className="field"><span>Send at</span><input id="sc-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
    </>
  );
}
export function scheduleModal(ch: Chat) {
  const draft = ui.active === ch.id ? composer.get().trim() : '';
  const now = Date.now();
  const tonight = new Date(); tonight.setHours(21, 0, 0, 0); if (tonight.getTime() < now) tonight.setDate(tonight.getDate() + 1);
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1); tmrw.setHours(9, 0, 0, 0);
  const chips: [string, number][] = [['In 1 min', now + MIN], ['In 1 hour', now + HOUR], ['Tonight 9 PM', tonight.getTime()], ['Tomorrow 9 AM', tmrw.getTime()]];
  modal({
    title: 'Schedule message',
    body: <ScheduleBody draft={draft} chips={chips} />,
    actions: [{ label: 'Cancel' }, {
      label: 'Schedule', primary: true, onClick: (root) => {
        const text = q<HTMLTextAreaElement>(root, '#sc-text')!.value.trim(), at = new Date(val(root, '#sc-at')).getTime();
        if (!text) { toast('Write a message first'); return false; }
        if (!(at > Date.now())) { toast('Pick a time in the future'); return false; }
        S.scheduled.push({ id: uid(), chatId: ch.id, text, at });
        if (draft) setInput('');
        commit(); toast(`Scheduled for ${dayLabel(at).toLowerCase()} at ${fmtTime(at)}`);
      },
    }],
  });
}
export function scheduledListModal(ch: Chat) {
  const list = S.scheduled.filter((s) => s.chatId === ch.id).sort((a, b) => a.at - b.at);
  let close = () => {};
  const now = (id: string) => { const s = S.scheduled.find((x) => x.id === id); if (s) s.at = Date.now() - 1; runScheduled(); close(); };
  const del = (id: string) => { S.scheduled = S.scheduled.filter((x) => x.id !== id); commit(); close(); toast('Scheduled message cancelled'); };
  close = modal({
    title: 'Scheduled messages',
    body: list.length ? <>{list.map((s) => (
      <div key={s.id} className="sched-row"><div className="grow"><div>{s.text}</div><div className="ci-sub">{dayLabel(s.at)} at {fmtTime(s.at)}</div></div>
        <button className="btn sm" data-now={s.id} onClick={() => now(s.id)}>Send now</button><button className="icon-btn sm" data-del={s.id} aria-label="Cancel" onClick={() => del(s.id)}><Icon name="delete" size={18} /></button></div>
    ))}</> : <p className="muted">Nothing scheduled.</p>,
    actions: [{ label: 'Done', primary: true }],
  }).close;
}

// ---------- AI summary
export function aiSummaryModal(ch: Chat) {
  if (!ch) return;
  const s = summarize(ch);
  const li = (arr: { m: Message; s: string }[]) => (arr.length ? arr.map((l, i) => <li key={i}><b>{firstName(l.m.from)}:</b> {l.s}</li>) : null);
  const strs = (arr: string[]) => (arr.length ? arr.map((p, i) => <li key={i}>{p}</li>) : null);
  const sec = (ic: string, title: string, items: ReactNode) => (items ? <div className="sum-sec"><div className="sum-title">{ic} {title}</div><ul>{items}</ul></div> : null);
  modal({
    title: '✨ AI summary',
    wide: true,
    body: (
      <>
        <p className="muted">{chatTitle(ch)} · {s.count} messages · {s.people.join(', ')}</p>
        {sec('💬', 'Key discussions', li(s.key))}
        {sec('📢', 'Important announcements', li(s.announcements))}
        {sec('✅', 'Decisions', li(s.decisions))}
        {sec('📝', 'Pending tasks', li(s.tasks))}
        {sec('📅', 'Dates & meetings', li(s.dates))}
        {sec('📊', 'Polls', strs(s.polls))}
        {sec('💳', 'Payments', strs(s.pays))}
        {sec('📎', 'Shared files', strs(s.files))}
        {sec('🔗', 'Important links', s.links.length ? s.links.map((p, i) => <li key={i}><a href={p} target="_blank" rel="noopener noreferrer">{p}</a></li>) : null)}
        {sec('👤', 'Mentioned people', strs(s.mentions))}
        {sec('🎯', 'Action items', s.actions.length ? s.actions.map((l, i) => <li key={i}><b>{l.who}</b> raised: {l.s}</li>) : null)}
        <div className="hint-box"><Icon name="sparkle" size={16} /><span>Demo summary generated on your device with simple rules. A production build would use an on-device or privacy-preserving AI model so encrypted chats stay private.</span></div>
      </>
    ),
    actions: [{ label: 'Done', primary: true }],
  });
}

// ---------- translate a message
function TranslateBody({ m }: { m: Message }) {
  const [sel, setSel] = useState<string | null>(null);
  const src = m.tr || m.text;
  const label = sel ? langName(sel) : '';
  const r = sel ? (sel === 'en' && m.tr ? { text: m.tr } : translateText(src, sel)) : null;
  return (
    <>
      <div className="quote" style={{ ['--qc' as string]: 'var(--accent)' }}><div className="q-main"><div className="q-text">{m.text}</div></div></div>
      <div className="chips wrap">{LANG_LIST.map(([k, l]) => <button key={k} className={`chip ${sel === k ? 'on' : ''}`} data-tl={k} onClick={() => setSel(k)}>{l}</button>)}</div>
      <div id="tl-out">{sel ? (r ? (
        <div className="tl-res"><div className="tr-label"><Icon name="translate" size={12} /> {label}</div><div className="tl-text">{r.text}</div><button className="link-btn" id="tl-say" onClick={() => readAloud(r.text)}>🔊 Listen</button></div>
      ) : (
        <div className="hint-box flat"><Icon name="info" size={16} /><span>The demo translates common phrases (try “How are you?”, “I will come tomorrow”, “Thank you”). Production WHATSMORE translates any message into 100+ languages with an on-device model, so encrypted chats stay private.</span></div>
      )) : null}</div>
    </>
  );
}
export function translateMsgModal(m: Message) {
  modal({ title: 'Translate message', body: <TranslateBody m={m} />, actions: [{ label: 'Done', primary: true }] });
}

// ---------- per-chat privacy
function PrivacyBody({ ch }: { ch: Chat }) {
  useRender();
  const p = (ch.privacy ||= {});
  const direct = ch.type === 'direct';
  const canEdit = direct || isAdmin(ch);
  const change = (k: string, v: boolean) => {
    p[k] = v;
    if (k === 'noForward' || k === 'screenshotAlert') sysMsg(ch, `You turned ${v ? 'on' : 'off'} ${k === 'noForward' ? 'forwarding & copying restrictions' : 'screenshot alerts'} for this chat`);
    commit();
  };
  const row = (k: string, label: string, sub: string, locked?: boolean) => (
    <label className="set-row plain"><div className="grow"><div className="ci-name">{label}</div><div className="ci-sub">{sub}</div></div>
      <input type="checkbox" className="switch" data-cp={k} checked={!!(p[k] || (locked && ch.secret))} disabled={!canEdit || !!(locked && ch.secret)} onChange={(e) => change(k, e.target.checked)} /></label>
  );
  return (
    <>
      {ch.secret ? <p className="muted small"><Icon name="lock" size={14} /> This is a secret chat — forwarding, copying and screenshot alerts are always on.</p> : null}
      {!canEdit ? <p className="muted small">Only group admins can change these settings.</p> : null}
      {row('noForward', direct ? 'Disable forwarding & copying' : 'Members can’t forward or copy', 'Messages from this chat can’t be forwarded to other chats or copied', true)}
      {row('screenshotAlert', 'Screenshot alerts', 'Notify the chat when a screenshot is detected', true)}
      {row('hideReceipts', 'Hide my read receipts here', 'They won’t see blue ticks from you in this chat only')}
      {direct ? row('hideLastSeen', 'Hide my last seen & online', 'Only for this person — your global setting stays the same') : null}
      {row('noSave', 'Don’t save media to gallery', 'Photos and videos from this chat stay inside WHATSMORE')}
      <div className="hint-box flat"><Icon name="info" size={16} /><span>Screenshot detection depends on the device. Android apps can block screenshots; iOS and browsers can only detect some of them, so alerts are best-effort.</span></div>
    </>
  );
}
export function chatPrivacyModal(ch: Chat) {
  if (!ch) return;
  modal({ title: 'Chat privacy', body: <PrivacyBody ch={ch} />, actions: [{ label: 'Done', primary: true }] });
}

// ---------- two-way live translation
export function liveTranslateModal(ch: Chat) {
  if (!ch) return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  const cur = ch.live || { my: S.settings.myLang || 'te', their: c?.lang || 'en' };
  const opts = LANG_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>);
  modal({
    title: '🌐 Live translation',
    body: (
      <>
        <p className="muted small">Each person writes and reads in their own language. The original message is always kept.</p>
        <label className="field"><span>I read and write in</span><select id="lt-my" defaultValue={cur.my}>{opts}</select></label>
        <label className="field"><span>{c ? c.name + ' reads' : 'Group members read'} in</span><select id="lt-their" defaultValue={cur.their}>{opts}</select></label>
        <div className="hint-box flat"><Icon name="sparkle" size={16} /><span>Try it: write “ఎలా ఉన్నారు?” (Telugu) — they receive “How are you?”, and their English reply reaches you in Telugu. The demo uses a phrasebook (how are you, I am fine, thank you, good morning, where are you, I will come tomorrow, see you soon). Production uses an on-device model for 100+ languages so encrypted chats stay private.</span></div>
      </>
    ),
    actions: [
      ch.live && { label: 'Turn off', danger: true, onClick: () => { ch.live = null; commit(); toast('Live translation off'); } },
      { label: 'Cancel' },
      {
        label: ch.live ? 'Save' : 'Turn on', primary: true, onClick: (root) => {
          ch.live = { my: q<HTMLSelectElement>(root, '#lt-my')!.value, their: q<HTMLSelectElement>(root, '#lt-their')!.value };
          S.settings.myLang = ch.live.my;
          commit();
          toast(`Live translation on · you ${langName(ch.live.my)} ⇄ them ${langName(ch.live.their)}`);
        },
      },
    ],
  });
}

// ---------- location sharing (current or live)
const PLACES: [string, number, number][] = [['Hitech City Metro Station', 17.4504, 78.3809], ['Inorbit Mall, Madhapur', 17.4344, 78.3866], ['Gachibowli Stadium', 17.4474, 78.3486], ['Charminar', 17.3616, 78.4747]];
function getPosition(): Promise<{ lat: number; lng: number; acc: number; demo?: boolean }> {
  return new Promise((res) => {
    const demo = () => res({ lat: 17.4401, lng: 78.3489, acc: 20, demo: true });
    if (!navigator.geolocation) return demo();
    const t = setTimeout(demo, 6000);
    navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); }, () => { clearTimeout(t); toast('Location unavailable · sending a demo location'); demo(); }, { timeout: 5500, maximumAge: 60000 });
  });
}
export function locationModal(ch: Chat) {
  let close = () => {};
  const place = (i: number) => { const [name, lat, lng] = PLACES[i]; close(); sendMsg(ch, { type: 'location', lat, lng, name }); };
  const current = async (live?: [number, string]) => {
    if (!S.settings.perms?.location) { toast('Location access is off · turn it on in Settings → Your data & privacy'); return; }
    close();
    const pos = await getPosition();
    sendMsg(ch, { type: 'location', lat: pos.lat, lng: pos.lng, name: pos.demo ? 'Current location (demo)' : 'Current location', acc: pos.acc, live: live ? Date.now() + live[0] * MIN : 0 });
    if (live) toast(`📍 Sharing live location for ${live[1]}`);
  };
  const lives: [number, string][] = [[15, '15 min'], [60, '1 hour'], [480, '8 hours']];
  close = modal({
    title: 'Share location',
    body: (
      <>
        <div className="loc-opts">
          <button className="ob-method" data-loc="now" onClick={() => current()}><Icon name="place" size={22} /><div className="grow"><b>Send your current location</b><span>Accurate to about 20 m</span></div></button>
          <div className="ob-method static"><Icon name="timer" size={22} /><div className="grow"><b>Share live location</b><span>Updates until you stop sharing</span><div className="chips wrap mt">{lives.map((l) => <button key={l[0]} className="chip" data-live={l[0]} onClick={() => current(l)}>{l[1]}</button>)}</div></div></div>
          <div className="list-label pad0">Nearby places</div>
          {PLACES.map(([n, la, lo], i) => <button key={n} className="nc-row" data-place={i} onClick={() => place(i)}><span className="nc-ic"><Icon name="place" size={18} /></span><span className="grow"><b>{n}</b><span className="ci-sub">{la.toFixed(4)}, {lo.toFixed(4)}</span></span></button>)}
        </div>
        <Note ic="lock" flat={false}>Location is shared only when you choose to, end-to-end encrypted, and live sharing stops automatically. You can turn location access off in Settings → Your data &amp; privacy.</Note>
      </>
    ),
    actions: [{ label: 'Cancel' }],
  }).close;
}

// ---------- reporting: users, messages, groups, businesses, channels, scams
const REPORT_CATS = ['Spam', 'Harassment', 'Fraud', 'Impersonation', 'Illegal content', 'Security concern', 'Other'];
export interface ReportOpts { kind: string; name: string; excerpt?: string; blockable?: (() => void) | null; leaveable?: (() => void) | null; defaultCat?: string; details?: boolean; cloud?: Record<string, unknown> | null }
export function reportTargetModal({ kind, name, excerpt = '', blockable = null, leaveable = null, defaultCat = 'Spam', details = false, cloud = null }: ReportOpts) {
  modal({
    title: kind === 'scam' ? 'Report a scam or problem' : `Report ${kind === 'message' ? 'this message' : name}?`,
    body: (
      <>
        {excerpt ? <div className="quote" style={{ ['--qc' as string]: 'var(--danger)' }}><div className="q-main"><div className="q-name">{name}</div><div className="q-text">{excerpt}</div></div></div> : null}
        <p className="muted small">{kind === 'message' ? 'This message and the 4 before it are sent to WHATSMORE Trust & Safety.' : kind === 'scam' ? 'Tell us what happened. Our Trust & Safety team reviews every report.' : 'Recent messages are sent to WHATSMORE Trust & Safety for review.'} They won&apos;t know who reported them.</p>
        {REPORT_CATS.map((c) => <label key={c} className="radio-row"><input type="radio" name="rc" value={c} defaultChecked={c === defaultCat} /> {c}</label>)}
        {details ? <label className="field"><span>What happened? (optional)</span><textarea id="rc-d" rows={3} maxLength={500} /></label> : null}
        {blockable ? <label className="radio-row"><input type="checkbox" id="rc-b" defaultChecked /> Also block {name}</label> : null}
        {leaveable ? <label className="radio-row"><input type="checkbox" id="rc-l" /> Also exit this group</label> : null}
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Report', danger: true, onClick: (root) => {
        const cat = q<HTMLInputElement>(root, '[name="rc"]:checked')?.value || defaultCat;
        const rec = { id: uid(), kind, name, cat, t: Date.now(), status: 'Under review' };
        (S.reports ||= []).push(rec);
        // live accounts: the live layer sends the report to the real Trust & Safety queue and updates rec.status
        fire('reportTarget', { kind, name, cat, details: q<HTMLTextAreaElement>(root, '#rc-d')?.value.trim() || null, cloud, rec });
        const adm = MS('admin', () => ({ reports: [] as any[], verif: [] as any[] }));
        (adm.reports ||= []).unshift([cat === 'Fraud' ? 'Fraud' : cat, name, `Reported by @${S.me.username} · ${kind}${excerpt ? ' · “' + excerpt.slice(0, 50) + '”' : ''}`]);
        if (q<HTMLInputElement>(root, '#rc-b')?.checked) blockable?.();
        if (q<HTMLInputElement>(root, '#rc-l')?.checked) leaveable?.();
        commit();
        act.logNotif('security', 'Report received', `${cat} · ${name} · we'll update you in Your data & privacy`);
        toast('Report sent. Thanks for keeping WHATSMORE safe.');
      },
    }],
  });
}
export function reportModal(c: Contact) {
  if (!c) return;
  reportTargetModal({ kind: c.business ? 'business' : 'user', name: c.name, cloud: c.cloud ? { target_user: rawId(c.id) } : null, blockable: c.blocked ? null : () => { c.blocked = true; commit(); } });
}
export function reportUser(contactId: string) { const c = contact(contactId); if (c) reportModal(c); }
export function reportMessage(ch: Chat, m: Message) {
  const c = contact(m.from);
  reportTargetModal({
    kind: 'message', name: senderName(m.from), excerpt: preview(m),
    cloud: ch.cloud && m.sbId ? { target_message: m.sbId, target_conversation: ch.sbId, target_user: c?.cloud ? rawId(m.from) : null } : null,
    defaultCat: scamCheck(m.text || '').length ? 'Fraud' : 'Spam',
    blockable: ch.type === 'direct' && c && !c.blocked ? () => { c.blocked = true; commit(); } : null,
  });
}
export function reportGroup(ch: Chat) {
  reportTargetModal({ kind: 'group', name: ch.name || '', cloud: ch.cloud ? { target_conversation: ch.sbId } : null, leaveable: () => { ch.left = true; sysMsg(ch, 'You left'); commit(); } });
}
export function reportScamProblem() { reportTargetModal({ kind: 'scam', name: 'Scam or problem', defaultCat: 'Fraud', details: true }); }
export function reportScam(ch: Chat, m: Message) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : contact(m.from);
  confirmModal('Report scam?', `This message will be sent to the WHATSMORE Trust & Safety team${c ? ' and ' + c.name + ' will be blocked' : ''}.`, 'Report & block', () => {
    if (c) c.blocked = true;
    m.reported = true;
    commit();
    toast('🛡️ Reported. Thanks for keeping WHATSMORE safe.');
  });
}
/** Links inside a flagged message ask before opening. */
export function confirmSuspiciousLink(href: string) {
  confirmModal('Open this link?', `${href}\n\nWHATSMORE AI flagged this message as potentially suspicious. Never enter OTPs, PINs or passwords on pages opened from messages like this.`, 'Open anyway', () => window.open(href, '_blank', 'noopener'));
}

// ---------- AI image enhancement
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
export async function enhanceImage(ch: Chat, m: Message) {
  if (!m.src) return toast('Send a real photo to try AI enhance — demo pictures are illustrations');
  let img: HTMLImageElement;
  try { img = await loadImg(m.src); } catch { return toast('Could not open this photo'); }
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d')!;
  cx.filter = 'contrast(1.14) saturate(1.3) brightness(1.06)';
  cx.drawImage(img, 0, 0);
  // light sharpen: overlay a slightly offset, low-opacity copy with "overlay" blending
  cx.filter = 'none'; cx.globalAlpha = 0.18; cx.globalCompositeOperation = 'overlay'; cx.drawImage(cv, -1, -1); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  const out = cv.toDataURL('image/jpeg', 0.88);
  modal({
    title: '✨ AI photo enhance', wide: true,
    body: (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="ba"><figure><img src={m.src} alt="Original" /><figcaption>Original</figcaption></figure><figure><img src={out} alt="Enhanced" /><figcaption>Enhanced · colour, contrast, light, sharpness</figcaption></figure></div>
        <p className="muted small">Demo uses on-device filters. Production adds AI upscaling, denoise and low-light repair.</p>
      </>
    ),
    actions: [{ label: 'Cancel' }, { label: 'Send enhanced copy', primary: true, onClick: () => { sendMsg(ch, { type: 'image', src: out, caption: (m.caption ? m.caption + ' ' : '') + '✨ Enhanced' }); } }],
  });
}

// ---------- photos & videos
export async function sendMedia() {
  const files = await pickFile({ accept: 'image/*,video/*' });
  const ch = curChat();
  if (!files.length || !ch) return;
  const f = files[0];
  let src: string, type: string;
  if (f.type.startsWith('video/')) { src = URL.createObjectURL(f); ui.blobs.push(src); type = 'video'; }
  else if (f.type.startsWith('image/')) { try { src = await readImage(f); } catch { return toast('Could not read that image'); } type = 'image'; }
  else return toast('Unsupported file type');
  modal({
    title: 'Send ' + (type === 'image' ? 'photo' : 'video'),
    // eslint-disable-next-line @next/next/no-img-element
    body: <><div className="media-preview">{type === 'image' ? <img src={src} alt="" /> : <video src={src} controls />}</div><label className="field"><span>Caption</span><input id="cap" maxLength={300} placeholder="Add a caption…" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget.closest('.modal')?.querySelector('[data-mact="1"]') as HTMLElement | null)?.click(); }} /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const m = sendMsg(ch, { type, src, caption: val(root, '#cap').trim(), size: f.size }); scheduleReply(ch, m); } }],
  });
}
export async function pasteImage(ch: Chat, file: File) {
  try { const src = await readImage(file); const m = sendMsg(ch, { type: 'image', src, size: file.size }); scheduleReply(ch, m); } catch { toast('Could not paste image'); }
}


