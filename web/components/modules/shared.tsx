'use client';
// Shared pieces of the super-app layer (ported from js/modules.js): module list, module state (MS),
// navigation helpers, the payment flow, chat picker and a small serialisable rich-text format for AI answers.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, useState, type ReactNode } from 'react';
import { S, ui, commit, refresh } from '@/lib/state';
import { goTab, openView } from '@/lib/nav';
import { modal, toast, type ModalOpts } from '@/lib/overlay';
import { openChat } from '@/lib/actions';
import { act } from '@/lib/registry';
import { uid, money, chatTitle, lastTime, isAdmin, chatById } from '@/lib/util';
import type { Chat } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { ChatAvatar } from '@/components/ui/Avatar';
import { onTabOpen } from '@/components/app/Rail';

/** Module state kept in S.mod[key] (created on first use). */
export const MS = <T = any,>(k: string, init: () => T): T => (S.mod[k] ??= init());

export interface ModDef { id: string; name: string; ic: string; color: string; pillar: string; sub: string }
export const MODULES: ModDef[] = [
  { id: 'pay', name: 'WHATSMORE Pay', ic: 'rupee', color: '#00a884', pillar: 'Pay', sub: 'Scan & pay, send, recharge, bills' },
  { id: 'business', name: 'Business', ic: 'store', color: '#f4511e', pillar: 'Business', sub: 'Dashboard, orders, AI assistant' },
  { id: 'market', name: 'Marketplace', ic: 'cart', color: '#e91e63', pillar: 'Business', sub: 'Shop, food, travel, tickets' },
  { id: 'citizen', name: 'Citizen Services', ic: 'bank', color: '#3949ab', pillar: 'Services', sub: 'Certificates, bills, grievances' },
  { id: 'sos', name: 'Emergency SOS', ic: 'warning', color: '#e53935', pillar: 'Services', sub: 'One tap alert to family' },
  { id: 'family', name: 'Family Hub', ic: 'heart', color: '#d81b60', pillar: 'Services', sub: 'Calendar, reminders, documents' },
  { id: 'learn', name: 'WHATSMORE Learn', ic: 'school', color: '#1e88e5', pillar: 'Community', sub: 'AI tutor, quizzes, study groups' },
  { id: 'news', name: 'News & Channels', ic: 'news', color: '#6d4c41', pillar: 'Community', sub: 'Verified news and channels' },
  { id: 'area', name: 'My Area', ic: 'place', color: '#43a047', pillar: 'Community', sub: 'Jobs, events, shops near you' },
  { id: 'creator', name: 'Creator Studio', ic: 'trend', color: '#8e24aa', pillar: 'Community', sub: 'Followers, revenue, go live' },
  { id: 'voice', name: 'Voice Rooms', ic: 'mic', color: '#00897b', pillar: 'Community', sub: 'Live audio and podcasts' },
  { id: 'wellbeing', name: 'Digital Wellbeing', ic: 'timer', color: '#5e35b1', pillar: 'Life', sub: 'Screen time, focus, quiet hours' },
  { id: 'admin', name: 'Command Center', ic: 'dashboard', color: '#37474f', pillar: 'Admin', sub: 'Admin panel preview' },
];

export const fmtStamp = (t: number) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------- navigation (XA.svc / gotab / gochat)
export function svc(mod: string) {
  ui.tab = ui.tab === 'settings' || ui.tab === 'home' ? ui.tab : 'services';
  openView('mod:' + mod);
}
export function gotab(tab: string, page: string | null = null) {
  goTab(tab, page);
  onTabOpen.forEach((f) => f(tab));
}
export function gochat(id: string) {
  ui.tab = 'chats'; ui.page = null;
  openChat(id);
}

export function ModTile({ m }: { m: ModDef }) {
  return (
    <button className="mod-tile" data-act="svc" data-mod={m.id} onClick={() => svc(m.id)}>
      <span className="mod-ic" style={{ background: m.color }}><Icon name={m.ic} size={22} /></span>
      <span className="mt-name">{m.name}</span><span className="mt-sub">{m.sub}</span>
    </button>
  );
}

export function UL({ items }: { items: ReactNode[] }) {
  return <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

/** Opens a modal whose body needs to close it (body is built with the close function). */
export function modalWith(opts: Omit<ModalOpts, 'body'>, body: (close: () => void) => ReactNode) {
  const h = { close: () => {} };
  const m = modal({ ...opts, body: body(() => h.close()) });
  h.close = m.close;
  return m;
}
/** Reads an input/select/textarea value inside a modal root. */
export const val = (root: HTMLElement, sel: string) => (root.querySelector(sel) as HTMLInputElement | null)?.value ?? '';
/** Press the primary (second) modal button on Enter. */
export const enterClicks = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.currentTarget.closest('.modal')?.querySelector<HTMLButtonElement>('[data-mact="1"]')?.click();
};

// ---------- rich text for AI answers (serialisable, stored in S.mod.ai; rendered without innerHTML)
export type RN = string | [string, Record<string, string> | null, ...RN[]];
export const h = (tag: string, attrs: Record<string, string> | null, ...kids: RN[]): RN => [tag, attrs, ...kids];
export const b = (t: string): RN => h('b', null, t);
export const ul = (items: RN[]): RN => h('ul', null, ...items.map((x) => h('li', null, x)));
const TAGS = new Set(['b', 'i', 'p', 'ul', 'li', 'div', 'span', 'br', 'button']);
/** Handlers for buttons inside rich text, keyed by data-act (registered by the AI module). */
export const richActs: Record<string, (attrs: Record<string, string>, el: HTMLElement) => void> = {};
export function renderRich(n: RN, key?: number | string): ReactNode {
  if (typeof n === 'string') return n;
  if (!Array.isArray(n)) return null;
  const [tag, attrs, ...kids] = n;
  if (!TAGS.has(tag)) return null;
  const props: Record<string, unknown> = { key };
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') props.className = v;
    else if (k.startsWith('data-') || k === 'title' || k === 'aria-label') props[k] = v;
  });
  if (tag === 'button' && attrs?.['data-act']) {
    const a = attrs;
    props.onClick = (e: React.MouseEvent<HTMLElement>) => richActs[a['data-act']]?.(a, e.currentTarget);
  }
  if (tag === 'br') return createElement('br', props);
  return createElement(tag, props, ...kids.map((k, i) => renderRich(k, i)));
}

// ---------- payments (payFlow / amountModal)
export function payFlow({ to, amount, note, onDone }: { to: string; amount: number; note?: string; onDone?: () => void }) {
  if (!(amount > 0)) return toast('Enter an amount');
  if (amount > S.wallet) return toast('Insufficient demo balance');
  modal({
    title: 'Confirm payment',
    body: (
      <div className="pay-confirm"><div className="muted">Paying {to}</div><div className="pay-amount big">{money(amount)}</div>{note ? <div className="muted">{note}</div> : null}
        <label className="field"><span>Enter UPI PIN (any 4–6 digits)</span><input id="upi-pin" className="pin-input" type="password" inputMode="numeric" maxLength={6} autoComplete="off" autoFocus onKeyDown={enterClicks} /></label>
        <p className="muted small"><Icon name="shield" size={14} /> Payments use separate, hardened authorisation — never your chat login.</p></div>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Pay ' + money(amount), primary: true, onClick: (root) => {
        if (!/^\d{4,6}$/.test(val(root, '#upi-pin'))) { toast('Enter your 4–6 digit UPI PIN'); return false; }
        S.wallet -= amount;
        S.payments.push({ id: uid(), dir: 'out', amount, with: to, note: note || 'Payment', t: Date.now() });
        commit();
        setTimeout(() => {
          modal({ title: 'Payment successful', body: <div className="pay-done"><div className="tick-anim"><Icon name="check" size={46} /></div><div className="pay-amount big">{money(amount)}</div><div className="muted">Paid to {to}</div><div className="ci-sub">UPI ref {Math.floor(1e11 + Math.random() * 8e11)} · {fmtStamp(Date.now())}</div></div>, actions: [{ label: 'Done', primary: true }] });
          onDone?.();
          refresh();
        }, 0);
      },
    }],
  });
}
export function amountModal(title: string, cb: (amount: number, note: string) => void) {
  modal({
    title,
    body: <><label className="field"><span>Amount (₹)</span><input id="am-v" type="number" min={1} inputMode="decimal" autoFocus /></label><label className="field"><span>Note</span><input id="am-n" maxLength={60} /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Continue', primary: true, onClick: (root) => { const a = +val(root, '#am-v'); if (!(a > 0)) { toast('Enter an amount'); return false; } const n = val(root, '#am-n').trim(); setTimeout(() => cb(a, n), 0); } }],
  });
}

// ---------- chat picker (features.js chatPicker)
function PickList({ chats, single }: { chats: Chat[]; single?: boolean }) {
  const [q, setQ] = useState('');
  return (
    <>
      <div className="search modal-search"><Icon name="search" size={18} /><input id="pk-q" placeholder="Search chats" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pick-list">
        {chats.map((c) => (
          <label key={c.id} className="chat-item check-row" data-name={chatTitle(c).toLowerCase()} hidden={!chatTitle(c).toLowerCase().includes(q.toLowerCase())}>
            <ChatAvatar ch={c} size={40} /><div className="ci-body"><div className="ci-name">{chatTitle(c)}</div></div>
            <input type={single ? 'radio' : 'checkbox'} name="pk" className="check" value={c.id} />
          </label>
        ))}
      </div>
    </>
  );
}
export function chatPicker(title: string, cb: (chats: Chat[]) => boolean | void, opts: { single?: boolean; label?: string } = {}) {
  const chats = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  modal({
    title,
    body: <PickList chats={chats} single={opts.single} />,
    actions: [{ label: 'Cancel' }, {
      label: opts.label || 'Send', primary: true, onClick: (root) => {
        const ids = [...root.querySelectorAll<HTMLInputElement>('input[name=pk]:checked')].map((i) => i.value);
        if (!ids.length) { toast('Select at least one chat'); return false; }
        if (cb(ids.map((id) => chatById(id)!).filter(Boolean)) === false) return false;
      },
    }],
  });
}

// ---------- PIN check (features.js withPin) — uses the chat area's version when it is registered
export function withPin(cb: () => void) {
  if ('withPin' in act) return act.withPin(cb);
  if (!S.settings.lockPin) {
    modal({
      title: 'Create chat lock PIN',
      body: <><p className="muted">Locked chats are hidden from your chat list and need this PIN to open.</p><input id="pin-a" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus /><input id="pin-b" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="Confirm" /><div className="err" id="pin-err" /></>,
      actions: [{ label: 'Cancel' }, {
        label: 'Save PIN', primary: true, onClick: (root) => {
          const a = val(root, '#pin-a'), bb = val(root, '#pin-b'), err = root.querySelector('#pin-err')!;
          if (!/^\d{4}$/.test(a)) { err.textContent = 'PIN must be 4 digits'; return false; }
          if (a !== bb) { err.textContent = "PINs don't match"; return false; }
          S.settings.lockPin = a; commit(); toast('Chat lock PIN saved');
          setTimeout(cb, 0);
        },
      }],
    });
    return;
  }
  modal({
    title: 'Locked chat',
    body: <><p className="muted">Enter your 4-digit chat lock PIN.</p><input id="pin-in" className="pin-input" type="password" inputMode="numeric" maxLength={4} autoComplete="off" autoFocus onKeyDown={enterClicks} /><div className="err" id="pin-err" /><p className="muted small">Production apps would use Face ID / fingerprint here.</p></>,
    actions: [{ label: 'Cancel' }, {
      label: 'Unlock', primary: true, onClick: (root) => {
        const inp = root.querySelector<HTMLInputElement>('#pin-in')!;
        if (inp.value === S.settings.lockPin) { setTimeout(cb, 0); return; }
        root.querySelector('#pin-err')!.textContent = 'Incorrect PIN'; inp.value = '';
        const md = root.querySelector('.modal'); md?.classList.add('shake');
        setTimeout(() => md?.classList.remove('shake'), 400);
        return false;
      },
    }],
  });
}

export function getLocation(): Promise<[string, string] | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res([p.coords.latitude.toFixed(5), p.coords.longitude.toFixed(5)]), () => res(null), { timeout: 5000 });
  });
}
