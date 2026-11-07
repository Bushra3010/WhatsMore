'use client';
// Notification center, Do Not Disturb and focus mode (js/superapp.js §2/§28 + js/modules.js wellbeing).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { S, ui, commit, save, refresh, useRender } from '@/lib/state';
import { MIN, HOUR, uid, money, chatTitle, preview, lastTime, listTime, chatById, contact, firstName } from '@/lib/util';
import { openChat } from '@/lib/actions';
import type { Chat } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { modalWith } from './shared';
import { svc, gotab } from './shared';

export const NCATS: [string, string, string][] = [['messages', 'Messages', 'chat'], ['calls', 'Calls', 'call'], ['payments', 'Payments', 'rupee'], ['business', 'Business', 'store'], ['marketplace', 'Marketplace', 'cart'], ['community', 'Community', 'groups'], ['ai', 'AI', 'sparkle'], ['security', 'Security', 'shield'], ['services', 'Services', 'bank']];

export function seedNotifs() {
  const t = Date.now(), log: any[] = [];
  S.chats.filter((c) => (c.unread || 0) > 0 && !c.locked).slice(0, 3).forEach((c, i) => { const m = c.messages[c.messages.length - 1]; log.push({ cat: 'messages', title: chatTitle(c), text: m ? preview(m) : 'New message', t: lastTime(c) || t - i * 60000, chatId: c.id }); });
  const pin = S.payments.filter((p) => p.dir === 'in').sort((a, b) => b.t - a.t)[0];
  if (pin) log.push({ cat: 'payments', title: 'Payment received', text: `${money(pin.amount)} from ${pin.with}`, t: pin.t });
  log.push({ cat: 'business', title: '2 business enquiries', text: 'Sunrise Bakery customers are asking about cake orders', t: t - 50 * MIN });
  log.push({ cat: 'ai', title: 'AI summary available', text: 'Weekend Trip · 3 decisions and 2 pending tasks', t: t - 70 * MIN });
  log.push({ cat: 'security', title: 'New device alert', text: 'Your account was used on WHATSMORE Web · Chrome on macOS', t: t - 3 * HOUR });
  log.push({ cat: 'services', title: 'Electricity bill due', text: 'TSSPDCL · due in 6 days', t: t - 5 * HOUR });
  log.push({ cat: 'community', title: 'Telangana Govt Updates', text: 'New online portal for income certificates is live', t: t - 6 * HOUR });
  log.push({ cat: 'calls', title: 'Missed call', text: 'Ramesh Kumar · voice call', t: t - 8 * HOUR });
  S.notifLog = log.sort((a, b) => b.t - a.t).map((n) => ({ id: uid(), read: false, ...n }));
}

/** Defaults this area needs on fresh and saved states (part of ensureV5). Returns true when something changed. */
export function ensureModDefaults() {
  let changed = false;
  const st = S.settings;
  if (!st.wellbeing) { st.wellbeing = {}; changed = true; }
  if (st.wellbeing.dnd === undefined) { Object.assign(st.wellbeing, { dnd: false, dndPlan: 'night' }); changed = true; }
  if (!S.notifLog) { seedNotifs(); changed = true; }
  return changed;
}

export const notifUnread = () => (S.notifLog || []).filter((n: any) => !n.read).length;

export function logNotif(cat: string, title: string, text: string, extra: Record<string, unknown> = {}) {
  if (!S.notifLog) return;
  S.notifLog.unshift({ id: uid(), read: false, cat, title, text, t: Date.now(), ...extra });
  S.notifLog.length = Math.min(S.notifLog.length, 80);
  commit();
}

export function dndActive() {
  const w = S.settings.wellbeing || {};
  if (!w.dnd) return false;
  const hr = new Date().getHours(), d = new Date().getDay();
  return w.dndPlan === 'always' || (w.dndPlan === 'night' && (hr >= 22 || hr < 7)) || (w.dndPlan === 'work' && d >= 1 && d <= 5 && hr >= 9 && hr < 18) || (w.dndPlan === 'weekend' && (d === 0 || d === 6));
}

/** notifyHooks entry: every in-app notification is logged; DND and focus mode silence the toast. */
export function notifyHook(ch: Chat, from: string, text: string) {
  logNotif(contact(ch.contactId)?.business ? 'business' : 'messages', chatTitle(ch), (ch.type === 'group' ? firstName(from) + ': ' : '') + text, { chatId: ch.id });
  if (dndActive()) return true;
  if (S.settings.wellbeing?.focus) return true;
  return false;
}

function NotifCenter({ close }: { close: () => void }) {
  useRender();
  const [cat, setCat] = useState('all');
  const list = (S.notifLog || []).filter((x: any) => cat === 'all' || x.cat === cat);
  const catOf = (k: string) => NCATS.find((c) => c[0] === k) || NCATS[0];
  const open = (x: any) => {
    x.read = true; save(); close(); refresh();
    if (x.chatId && chatById(x.chatId)) return openChat(x.chatId);
    const go = ({ payments: ['svc', 'pay'], business: ['svc', 'business'], marketplace: ['svc', 'market'], services: ['svc', 'citizen'], community: ['svc', 'news'], ai: ['tab', 'ai'], calls: ['tab', 'calls'], security: ['page', 'set-security'], messages: ['tab', 'chats'] } as Record<string, string[]>)[x.cat];
    if (!go) return;
    if (go[0] === 'svc') svc(go[1]);
    else if (go[0] === 'tab') gotab(go[1]);
    else gotab('settings', go[1]);
  };
  return (
    <div id="nc-wrap">
      <div className="chips wrap">
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} data-nc="all" onClick={() => setCat('all')}>All</button>
        {NCATS.map(([k, l]) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} data-nc={k} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      <div className="nc-list">
        {list.length ? list.map((x: any) => (
          <button key={x.id} className={`nc-row ${x.read ? '' : 'unread'}`} data-nid={x.id} onClick={() => open(x)}>
            <span className="nc-ic"><Icon name={catOf(x.cat)[2]} size={18} /></span>
            <span className="grow"><b>{x.title}</b><span className="ci-sub">{x.text}</span></span>
            <span className="ci-sub nowrap">{listTime(x.t)}</span>
          </button>
        )) : <div className="empty-list small">Nothing here yet.</div>}
      </div>
    </div>
  );
}

export function openNotifCenter() {
  if (!S.notifLog) seedNotifs();
  return modalWith({
    title: 'Notifications', wide: true,
    actions: [
      { label: 'Notification settings', onClick: () => { ui.tab = 'settings'; ui.page = 'set-notify'; refresh(); } },
      { label: 'Mark all read', primary: true, onClick: () => { S.notifLog.forEach((x: any) => { x.read = true; }); commit(); } },
    ],
  }, (close) => <NotifCenter close={close} />);
}
