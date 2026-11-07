'use client';
// The open chat (main area): header, bars, message list and composer. Ported from js/chat.js renderMain
// plus the bar/header layers from js/devices.js, js/privacy.js and other areas (chatBars, menuHooks).
import { Fragment, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { S, ui, refresh } from '@/lib/state';
import type { Chat } from '@/lib/types';
import { closeMenu } from '@/lib/overlay';
import { chatById, chatTitle, contact, dayKey, dayLabel, dayDiff, fmtTime, firstName, namesSummary, preview, LANGS, MIN } from '@/lib/util';
import { closeChat } from '@/lib/actions';
import { act, chatBars } from '@/lib/registry';
import { openDrawer } from '@/lib/nav';
import { langName } from '@/lib/translate';
import { Icon } from '@/components/Icon';
import { ChatAvatar, Verified } from '@/components/ui/Avatar';
import { Slot } from '@/components/ui/Slot';
import { jumpTo, updateSearchCount, toggleTranslate, addContact, stopVoice, stopRecording, focusInput, setInput } from './core';
import { headMenu, openChatSearch } from './menus';
import { scheduledListModal, chatPrivacyModal, liveTranslateModal } from './modals';
import { MsgRow } from './Message';
import { Composer } from './Composer';

function ChatSub({ ch }: { ch: Chat }) {
  if (ui.typing[ch.id]) return <span className="typing-txt">{ch.type === 'group' ? ui.typing[ch.id] + ' is ' : ''}typing…</span>;
  if (ch.type === 'group') {
    const mem = ch.members || [];
    return <>{mem.length > 6 ? `${(mem.length + 1).toLocaleString()} members · ${namesSummary(mem, 3)}, You` : [...mem.map(firstName), 'You'].join(', ')}</>;
  }
  const c = contact(ch.contactId);
  if (!c) return null;
  if (c.business) return <>{c.business.category + ' · Business account'}</>;
  if (ch.request === 'pending') return <>{'Chat request sent · waiting for @' + c.username}</>;
  if (c.blocked) return <>Blocked</>;
  if (c.online) return <>online</>;
  if (c.lastSeen && S.settings.privacy.lastSeen !== 'nobody') return <>{'last seen ' + (dayDiff(c.lastSeen) === 0 ? 'today' : dayLabel(c.lastSeen).toLowerCase()) + ' at ' + fmtTime(c.lastSeen)}</>;
  return <>{'@' + c.username}</>;
}

function Bars({ ch }: { ch: Chat }) {
  const out: ReactNode[] = [];
  if (ui.chatSearch !== null) {
    out.push(
      <div key="search" className="bar searchbar"><Icon name="search" size={18} />
        <input id="cs-input" placeholder="Search in this chat" value={ui.chatSearch} autoComplete="off"
          onChange={(e) => { ui.chatSearch = e.target.value; ui.searchIdx = 0; refresh(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ui.searchIdx += e.shiftKey ? -1 : 1; updateSearchCount(true); } }} />
        <span className="cs-count" id="cs-count" />
        <button className="icon-btn sm" data-act="cs-prev" aria-label="Previous match" onClick={() => { ui.searchIdx++; updateSearchCount(true); }}><Icon name="chevup" size={20} /></button>
        <button className="icon-btn sm" data-act="cs-next" aria-label="Next match" onClick={() => { ui.searchIdx--; updateSearchCount(true); }}><Icon name="chevdown" size={20} /></button>
        <button className="icon-btn sm" data-act="cs-close" aria-label="Close search" onClick={() => { ui.chatSearch = null; refresh(); }}><Icon name="close" size={20} /></button>
      </div>,
    );
  }
  const pinned = ch.messages.filter((m) => m.pinned && m.type !== 'deleted');
  if (pinned.length) {
    const p = pinned[pinned.length - 1];
    out.push(<div key="pin" className="bar pinbar" data-act="jump" data-mid={p.id} onClick={() => jumpTo(p.id)}><span className="accent"><Icon name="pin" size={18} /></span><div className="pb-text"><div className="pb-title">Pinned message{pinned.length > 1 ? ` (${pinned.length})` : ''}</div><div className="pb-prev">{preview(p)}</div></div></div>);
  }
  if (ch.messages.some((m) => m.tr)) {
    const lang = LANGS[contact(ch.contactId)?.lang || ''] || 'other languages';
    out.push(<div key="tr" className="bar trbar"><span className="accent"><Icon name="translate" size={18} /></span><span className="grow">{ch.translate ? 'Showing English translations' : 'Some messages are in ' + lang}</span><button className="link-btn" data-act="translate-toggle" onClick={() => toggleTranslate(ch)}>{ch.translate ? 'Hide' : 'Translate to English'}</button></div>);
  }
  if (ch.request === 'pending') out.push(<div key="req" className="bar"><Icon name="person" size={18} /><span>Chat request sent. They&apos;ll see your messages after accepting.</span></div>);
  const sched = S.scheduled.filter((s) => s.chatId === ch.id);
  if (sched.length) {
    const next = Math.min(...sched.map((s) => s.at));
    out.push(<div key="sched" className="bar schbar" data-act="sched-view" onClick={() => scheduledListModal(ch)}><span className="accent"><Icon name="timer" size={18} /></span><span className="grow">{sched.length} scheduled message{sched.length > 1 ? 's' : ''} · next {dayLabel(next).toLowerCase()} at {fmtTime(next)}</span><span className="link-btn">View</span></div>);
  }
  // not in contacts (anti-scam)
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  if (c && !c.isContact && !c.business && !c.blocked && !ch.request) {
    out.push(<div key="warn" className="bar warnbar"><Icon name="warning" size={18} /><span className="grow">Not in your contacts · @{c.username}. Be careful with links and payment requests.</span><button className="link-btn" data-act="block" onClick={() => act.toggleBlock(c)}>Block</button><button className="link-btn" data-act="addcontact" onClick={() => addContact(ch)}>Add</button></div>);
  }
  // privacy, secret chat, live translation
  if (ch.secret) out.push(<div key="secret" className="bar secretbar"><Icon name="lock" size={18} /><span className="grow">Secret chat · on this device only · disappears in 24 h · no forwarding · screenshot alerts</span></div>);
  else if (ch.privacy?.noForward || ch.privacy?.screenshotAlert) out.push(<div key="priv" className="bar" data-act="chatprivacy" onClick={() => chatPrivacyModal(ch)}><Icon name="shield" size={18} /><span className="grow">{[ch.privacy.noForward && 'Forwarding off', ch.privacy.screenshotAlert && 'Screenshot alerts on'].filter(Boolean).join(' · ')}</span><span className="link-btn">Privacy</span></div>);
  if (ch.live) out.push(<div key="live" className="bar livebar" data-act="livetr" onClick={() => liveTranslateModal(ch)}><Icon name="translate" size={18} /><span className="grow">Live translation · you <b>{langName(ch.live.my)}</b> ⇄ them <b>{langName(ch.live.their)}</b></span><span className="link-btn">Change</span></div>);
  chatBars.forEach((f, i) => { const b = f(ch); if (b) out.push(<Fragment key={'x' + i}>{b}</Fragment>); });
  return <div id="chat-bars">{out}</div>;
}

function Messages({ ch }: { ch: Chat }) {
  const q = (ui.chatSearch && ui.chatSearch.trim()) || null;
  const rows: ReactNode[] = [];
  let lastDay: string | null = null, prevFrom: string | null = null, prevT = 0;
  ch.messages.forEach((m) => {
    const dk = dayKey(m.t);
    if (dk !== lastDay) { rows.push(<div key={'d' + dk} className="day-sep"><span>{dayLabel(m.t)}</span></div>); lastDay = dk; prevFrom = null; }
    if (m.type === 'system') {
      const enc = /end-to-end encrypted/.test(m.text || '');
      rows.push(<div key={m.id} className={`sys-msg ${enc ? 'enc' : ''}`} data-act={enc ? 'verify' : undefined} onClick={enc ? () => act.verifyModal(ch) : undefined}><span>{enc ? <><Icon name="lock" size={13} /> </> : null}{m.text}{enc ? ' Tap to learn more.' : ''}</span></div>);
      prevFrom = null;
      return;
    }
    const first = m.from !== prevFrom || m.t - prevT > 10 * MIN;
    rows.push(<MsgRow key={m.id} ch={ch} m={m} first={first} q={q} />);
    prevFrom = m.from; prevT = m.t;
  });
  return <div className="msgs-inner">{rows}</div>;
}

function OpenChat({ ch }: { ch: Chat }) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  const msgsRef = useRef<HTMLDivElement>(null);
  const st = useRef({ stick: true, near: true, count: -1 });

  // keep the newest message in view (stick-to-bottom), like renderMessages({ initial/force/keep })
  useLayoutEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    const s = st.current, n = ch.messages.length, last = ch.messages[n - 1];
    if (s.count < 0 || (n > s.count && (last?.from === 'me' || s.near)) || s.stick) { s.stick = true; el.scrollTop = el.scrollHeight; }
    s.count = n;
  });
  useEffect(() => {
    const el = msgsRef.current!;
    const s = st.current;
    const main = document.getElementById('main');
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      s.stick = gap < 40; s.near = gap < 120;
      main?.classList.toggle('scrolled-up', gap > 300);
    };
    el.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(() => { if (s.stick) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    if (innerWidth > 760 && !ui.jumpTo) focusInput();
    return () => {
      el.removeEventListener('scroll', onScroll); ro.disconnect();
      main?.classList.remove('scrolled-up', 'secret-hide');
      stopVoice();
      if (ui.rec) stopRecording(false);
    };
  }, [ch.id]);
  // jump to a message (search results, starred messages, quotes)
  useEffect(() => {
    if (!ui.jumpTo) return;
    const mid = ui.jumpTo as string;
    delete ui.jumpTo;
    st.current.stick = false;
    setTimeout(() => jumpTo(mid), 60);
  });
  // in-chat search: count and jump to the newest match
  const search = ui.chatSearch;
  useEffect(() => { updateSearchCount(true); }, [search]);
  // Escape: emoji panel → reply/edit → search → drawer (menus and dialogs close first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('menu') || document.querySelector('.modal-backdrop') || document.getElementById('studio') || document.getElementById('lightbox') || ui.story || ui.call) return;
      if (ui.emojiOpen) { ui.emojiOpen = false; refresh(); focusInput(); return; }
      if (ui.replyTo || ui.editing) { ui.replyTo = null; if (ui.editing) { ui.editing = null; setInput(''); } refresh(); return; }
      if (ui.chatSearch !== null) { ui.chatSearch = null; refresh(); return; }
      if (ui.drawer) { ui.drawer = null; refresh(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ch.id]);

  const scrollBottom = () => { const m = msgsRef.current; m?.scrollTo({ top: m.scrollHeight, behavior: 'smooth' }); };
  return (
    <>
      <header className="chat-head">
        <button className="icon-btn back-btn" data-act="closechat" aria-label="Back" onClick={() => { closeMenu(); closeChat(); }}><Icon name="back" /></button>
        <div className="chat-head-info" data-act="info" role="button" tabIndex={0} onClick={() => openDrawer(ui.drawer === 'info' ? null : 'info')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(ui.drawer === 'info' ? null : 'info'); } }}>
          <ChatAvatar ch={ch} size={40} />
          <div className="chat-head-text"><div className="chat-head-name">{chatTitle(ch)}<Verified c={c} />{ch.disappearing ? <span className="dis-ic"><Icon name="timer" size={15} /></span> : null}</div><div className="chat-head-sub" id="chat-sub"><ChatSub ch={ch} /></div></div>
        </div>
        <div className="head-actions">
          <button className="icon-btn" data-act="call-video" title="Video call" aria-label="Video call" onClick={() => act.startCall(ch, true)}><Icon name="video" /></button>
          <button className="icon-btn" data-act="call-voice" title="Voice call" aria-label="Voice call" onClick={() => act.startCall(ch, false)}><Icon name="call" /></button>
          <button className="icon-btn hide-sm" data-act="chatsearch" title="Search" aria-label="Search" onClick={openChatSearch}><Icon name="search" /></button>
          <button className="icon-btn" data-act="headmenu" title="Menu" aria-label="Menu" onClick={(e) => headMenu(e.currentTarget)}><Icon name="more" /></button>
        </div>
      </header>
      <Bars ch={ch} />
      <div className="messages-wrap">
        <div className="messages" id="msgs" ref={msgsRef}><Messages ch={ch} /></div>
        <button className="scroll-down" data-act="scrollbottom" aria-label="Scroll to bottom" onClick={scrollBottom}><Icon name="chevdown" /></button>
      </div>
      <Slot name="chat.composer" ch={ch} />
      <div id="composer-area"><Composer key={ch.id} ch={ch} /></div>
    </>
  );
}

/** mains.__chat — rendered by the shell while ui.active is a chat. */
export function ChatView() {
  const ch = chatById(ui.active);
  if (!ch) return null;
  return <OpenChat key={ch.id} ch={ch} />;
}
