'use client';
/* eslint-disable react-hooks/purity -- views read the clock (progress of orders, events) */
// Home (personal dashboard) and the Services hub. Ported from js/modules.js tabHome/tabServices with the
// js/superapp.js layer (greeting in your language, search, notification bell).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, type ReactNode } from 'react';
import { visibleUnreadChats } from '@/lib/profiles';
import { S, ui, refresh } from '@/lib/state';
import { showMenu } from '@/lib/overlay';
import { act } from '@/lib/registry';
import { contact, chatTitle, senderName, money, dayLabel, fmtTime, chatById } from '@/lib/util';
import { scamCheck } from '@/lib/scam';
import { PROFILES, switchProfile } from '@/lib/profiles';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Slot } from '@/components/ui/Slot';
import { MODULES, MS, ModTile, svc, gotab, gochat } from './shared';
import { aiSummaryModal } from './ai';
import { seedFamily } from './family';
import { notifUnread, openNotifCenter } from './notifs';
import { importChatModal } from './importChats';

const GREET: Record<string, string[]> = { te: ['శుభోదయం', 'శుభ మధ్యాహ్నం', 'శుభ సాయంత్రం'], hi: ['सुप्रभात', 'नमस्कार', 'शुभ संध्या'], ta: ['காலை வணக்கம்', 'மதிய வணக்கம்', 'மாலை வணக்கம்'], kn: ['ಶುಭೋದಯ', 'ಶುಭ ಮಧ್ಯಾಹ್ನ', 'ಶುಭ ಸಂಜೆ'], ml: ['സുപ്രഭാതം', 'ശുഭ ഉച്ച', 'ശുഭ സായാഹ്നം'] };
export function greeting() { const hr = new Date().getHours(), i = hr < 12 ? 0 : hr < 17 ? 1 : 2; return (GREET[S.settings.myLang] || ['Good morning', 'Good afternoon', 'Good evening'])[i]; }

export function profileMenu(el: Element) {
  showMenu(el, Object.entries(PROFILES).map(([k, [l, e]]) => ({ label: `${e}  ${l}${S.settings.profile === k ? '  ✓' : ''}`, onClick: () => switchProfile(k) })), { header: <div className="menu-title">Switch profile</div> });
}
function newChat() {
  ui.page = 'newchat'; ui.ncQuery = ''; ui.tab = 'chats'; refresh();
  setTimeout(() => document.querySelector<HTMLInputElement>('#nc-search')?.focus(), 30);
}
function homeSearch() {
  ui.tab = 'chats'; ui.page = null; refresh();
  setTimeout(() => document.querySelector<HTMLInputElement>('#chat-search')?.focus(), 30);
}

function Card({ act: a, data, ic, color, title, sub, onClick }: { act: string; data?: Record<string, string>; ic: string; color: string; title: ReactNode; sub: ReactNode; onClick: () => void }) {
  return (
    <button className="home-card" data-act={a} {...data} onClick={onClick}>
      <span className="hc-ic" style={{ background: color }}><Icon name={ic} size={20} /></span>
      <span className="grow"><b>{title}</b><span className="ci-sub">{sub}</span></span>
      <Icon name="chevright" size={18} cls="muted" />
    </button>
  );
}

export function HomeTab() {
  const unreadChats = visibleUnreadChats();
  const unread = unreadChats.reduce((s, c) => s + (c.unread || 0), 0);
  const sigWait = S.chats.flatMap((c) => c.messages.filter((m) => m.type === 'signreq' && m.from !== 'me' && m.status === 'pending').map((m) => ({ c, m })))[0];
  const scam = S.chats.find((c) => c.messages.some((m) => m.type === 'text' && m.from !== 'me' && !m.safe && !m.reported && scamCheck(m.text).length) && !contact(c.contactId)?.blocked);
  const inPay = S.payments.filter((p) => p.dir === 'in').sort((a, b) => b.t - a.t)[0];
  const busy = S.chats.filter((c) => c.type === 'group' && !c.locked).sort((a, b) => b.messages.length - a.messages.length)[0];
  const fam = (MS('family', seedFamily).events || []).filter((e: any) => e.at > Date.now()).sort((a: any, b: any) => a.at - b.at)[0];
  const linked = S.devices.filter((d) => !d.primary).length;
  const prof = PROFILES[S.settings.profile] || PROFILES.personal;
  const n = notifUnread();
  const qa: [string, Record<string, string>, string, string, () => void][] = [
    ['newchat', {}, 'newchat', 'New chat', newChat],
    ['scanqr', {}, 'qr', 'Scan QR', () => act.scanModal()],
    ['gotab', { 'data-tab': 'ai' }, 'sparkle', 'AI', () => gotab('ai')],
    ['svc', { 'data-mod': 'pay' }, 'rupee', 'Pay', () => svc('pay')],
    ['gotab', { 'data-tab': 'calls' }, 'call', 'Calls', () => gotab('calls')],
    ['gotab', { 'data-tab': 'status' }, 'status', 'Status', () => gotab('status')],
    ['gotab', { 'data-tab': 'communities' }, 'groups', 'Groups', () => gotab('communities')],
    ['gotab', { 'data-tab': 'files' }, 'cloud', 'Cloud', () => gotab('files')],
  ];
  return (
    <>
      <header className="side-head">
        <h1 className="brand">WHATSMORE</h1>
        <div className="head-actions">
          <button className="icon-btn" data-act="homesearch" title="Search" aria-label="Search" onClick={homeSearch}><Icon name="search" /></button>
          <button className="icon-btn bell" data-act="notifs" title="Notifications" aria-label={`Notifications${n ? `, ${n} unread` : ''}`} onClick={() => openNotifCenter()}><Icon name="bell" />{n ? <span className="bell-n">{n > 9 ? '9+' : n}</span> : null}</button>
          <button className="pill clickable" data-act="profilemenu" onClick={(e) => profileMenu(e.currentTarget)}>{prof[1]} {prof[0]} ▾</button>
        </div>
      </header>
      <div className="side-scroll home">
        <Slot name="home.top" />
        <div className="hello"><div><div className="hello-t">{greeting()}, {S.me.name.split(' ')[0]} 👋</div><div className="ci-sub">More Than Chat · @{S.me.username}</div></div><Avatar o={S.me} size={44} /></div>
        <div className="qa-grid">
          {qa.map(([a, at, ic, l, fn]) => <button key={l} className="qa" data-act={a} {...at} onClick={fn}><span className="qa-ic"><Icon name={ic} size={22} /></span><span>{l}</span></button>)}
        </div>
        <button className="sos-strip" data-act="svc" data-mod="sos" onClick={() => svc('sos')}><Icon name="warning" size={18} /> <b>SOS</b> · Emergency mode<span className="grow" /><Icon name="chevright" size={18} /></button>
        <div className="list-label">For you</div>
        <div className="home-cards">
          <Card act="gotab" data={{ 'data-tab': 'chats' }} ic="chat" color="#1565d8" onClick={() => gotab('chats')}
            title={unread ? `${unread} unread message${unread > 1 ? 's' : ''}` : 'You are all caught up'}
            sub={unread ? `In ${unreadChats.length} chat${unreadChats.length > 1 ? 's' : ''} · ${unreadChats.slice(0, 3).map(chatTitle).join(', ')}` : 'No unread chats'} />
          {sigWait ? <Card act="gochat" data={{ 'data-chat': sigWait.c.id }} ic="draw" color="#5e35b1" title="Signature needed" sub={`${senderName(sigWait.m.from)} is waiting for you to sign ${sigWait.m.doc?.name}`} onClick={() => gochat(sigWait.c.id)} /> : null}
          {scam ? <Card act="gochat" data={{ 'data-chat': scam.id }} ic="warning" color="#e53935" title="Possible scam detected" sub={`Anti-scam AI flagged messages from ${chatTitle(scam)}`} onClick={() => gochat(scam.id)} /> : null}
          {busy ? <Card act="homesum" data={{ 'data-chat': busy.id }} ic="sparkle" color="#7c4dff" title="AI summary ready" sub={`${busy.name} · ${busy.messages.length} messages summarised for you`} onClick={() => { const ch = chatById(busy.id); if (ch) aiSummaryModal(ch); }} /> : null}
          <Card act="svc" data={{ 'data-mod': 'pay' }} ic="rupee" color="#00897b" title={`Wallet ${money(S.wallet)}`} sub={inPay ? `Last received ${money(inPay.amount)} from ${inPay.with}` : 'Send, scan, recharge and pay bills'} onClick={() => svc('pay')} />
          <Card act="svc" data={{ 'data-mod': 'business' }} ic="store" color="#f4511e" title="2 business enquiries" sub="AI assistant answered 11 customer questions today" onClick={() => svc('business')} />
          {fam ? <Card act="svc" data={{ 'data-mod': 'family' }} ic="event" color="#d81b60" title={fam.title} sub={`Family · ${dayLabel(fam.at)} at ${fmtTime(fam.at)}`} onClick={() => svc('family')} /> : null}
          <Card act="gotab" data={{ 'data-tab': 'settings', 'data-page': 'set-devices' }} ic="devices" color="#3949ab" title={`${linked} linked device${linked === 1 ? '' : 's'}`} sub="Use WHATSMORE on desktop, tablet and web" onClick={() => gotab('settings', 'set-devices')} />
        </div>
        <div className="list-label row-between"><span>Explore WHATSMORE</span><button className="link-btn" data-act="gotab" data-tab="services" onClick={() => gotab('services')}>See all</button></div>
        <div className="mod-grid compact">{MODULES.slice(0, 9).map((m) => <ModTile key={m.id} m={m} />)}</div>
        <div className="hint-box"><Icon name="lock" size={16} /><span>Chat · AI · Pay · Business · Services · Community — one secure app. Personal messages stay end-to-end encrypted.</span></div>
      </div>
    </>
  );
}

export function ServicesTab() {
  const pillars = [...new Set(MODULES.map((m) => m.pillar))];
  return (
    <>
      <header className="side-head"><h2>Services</h2><div className="head-actions"><button className="icon-btn" data-act="importchats" title="Import chats" aria-label="Import chats" onClick={importChatModal}><Icon name="importin" /></button></div></header>
      <div className="side-scroll">
        <div className="pillars">{['💬 Chat', '🤖 AI', '💳 Pay', '💼 Business', '🏛️ Services', '🌍 Community'].map((p) => <span key={p}>{p}</span>)}</div>
        {pillars.map((p) => (
          <Fragment key={p}>
            <div className="list-label">{p}</div>
            <div className="mod-grid">{MODULES.filter((m) => m.pillar === p).map((m) => <ModTile key={m.id} m={m} />)}</div>
          </Fragment>
        ))}
        <div className="list-label">Tools</div>
        <div className="list-row action" data-act="importchats" role="button" tabIndex={0} onClick={importChatModal}><span className="action-ic"><Icon name="importin" size={22} /></span><div><div className="ci-name">Import chats</div><div className="ci-sub">Move chat history from apps that let you export it</div></div></div>
        <div className="list-row action" data-act="gotab" data-tab="files" role="button" tabIndex={0} onClick={() => gotab('files')}><span className="action-ic"><Icon name="cloud" size={22} /></span><div><div className="ci-name">WHATSMORE Cloud</div><div className="ci-sub">Smart folders, any file type, natural-language search</div></div></div>
      </div>
    </>
  );
}
