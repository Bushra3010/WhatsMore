'use client';
// Chats tab: header, search, filters, chat list (with archived/locked rows, profile banner, typing,
// drafts and message-search hits) and the chat item / chats menus. Ported from js/sidebar.js + js/privacy.js.
import { useRef, type ReactNode } from 'react';
import { S, ui, commit, refresh } from '@/lib/state';
import { showMenu, toast, type MenuItem } from '@/lib/overlay';
import { openChat } from '@/lib/actions';
import { act, menuHooks } from '@/lib/registry';
import { goTab, openPage } from '@/lib/nav';
import { profileMatch, PROFILES, switchProfile } from '@/lib/profiles';
import { chatById, chatTitle, contact, firstName, isBiz, lastMsg, lastTime, listTime, preview, escRe } from '@/lib/util';
import type { Chat, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { ChatAvatar, Verified } from '@/components/ui/Avatar';
import { SearchBox, setSetting } from '@/components/ui/Bits';
import { toggleLock, deleteChat, openLocked } from './chatActions';

type Anchor = Element | { x: number; y: number };

export function Ticks({ st }: { st?: string }) {
  if (st === 'failed') return <span className="tick failed" title="Not sent"><Icon name="warning" size={15} /></span>;
  if (st === 'read') return <span className="tick read"><Icon name="doneall" size={16} /></span>;
  if (st === 'delivered') return <span className="tick"><Icon name="doneall" size={16} /></span>;
  return <span className="tick"><Icon name="check" size={16} /></span>;
}
export function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp('(' + escRe(q) + ')', 'gi'));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export function openNewChat() {
  ui.page = 'newchat'; ui.ncQuery = ''; ui.tab = 'chats';
  refresh();
  setTimeout(() => document.getElementById('nc-search')?.focus(), 30);
}
export function openMsg(chatId: string, mid: string) {
  if (ui.drawer === 'starred' && innerWidth <= 1100) ui.drawer = null;
  openChat(chatId, { mid });
}

export function chatItemMenu(id: string, anchor: Anchor) {
  const ch = chatById(id);
  if (!ch) return;
  const upd = (msg?: string) => { commit(); if (msg) toast(msg); };
  showMenu(anchor, [
    { label: ch.archived ? 'Unarchive chat' : 'Archive chat', icon: 'archive', onClick: () => { ch.archived = !ch.archived; upd(ch.archived ? 'Chat archived' : 'Chat unarchived'); } },
    { label: ch.muted ? 'Unmute notifications' : 'Mute notifications', icon: 'mute', onClick: () => { ch.muted = !ch.muted; upd(ch.muted ? 'Notifications muted' : 'Notifications unmuted'); } },
    { label: ch.pinned ? 'Unpin chat' : 'Pin chat', icon: 'pin', onClick: () => { if (!ch.pinned && S.chats.filter((c) => c.pinned).length >= 3) return toast('You can only pin up to 3 chats'); ch.pinned = !ch.pinned; upd(); } },
    { label: ch.unread ? 'Mark as read' : 'Mark as unread', icon: 'chat', onClick: () => { ch.unread = ch.unread ? 0 : 1; upd(); } },
    { label: ch.locked ? 'Unlock chat' : 'Lock chat', icon: 'lock', onClick: () => toggleLock(ch) },
    '-',
    { label: 'Delete chat', icon: 'delete', danger: true, onClick: () => deleteChat(ch) },
  ]);
}

export function chatsMenu(anchor: Anchor) {
  const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
  const extra = menuHooks.chatsMenu.flatMap((h) => h(null as unknown as Chat) || []) as (MenuItem | '-' | false | null)[];
  showMenu(anchor, [
    { label: 'New group', icon: 'groups', onClick: () => openPage('newgroup') },
    { label: 'New community', icon: 'groups', onClick: () => act.newCommunityModal() },
    { label: 'Starred messages', icon: 'star', onClick: () => openPage('starred') },
    { label: 'Archived chats', icon: 'archive', onClick: () => openPage('archived') },
    { label: 'Locked chats', icon: 'lock', onClick: () => openLocked() },
    { label: 'Linked devices', icon: 'devices', onClick: () => goTab('settings', 'set-devices') },
    { label: 'Import chats', icon: 'importin', onClick: () => act.importChatModal() },
    { label: 'My QR code', icon: 'qr', onClick: () => act.qrModal() },
    { label: dark ? 'Light mode' : 'Dark mode', icon: 'moon', onClick: () => setSetting('theme', dark ? 'light' : 'dark') },
    { label: 'Settings', icon: 'settings', onClick: () => goTab('settings') },
    ...extra,
  ]);
}

export function ChatItem({ c }: { c: Chat }) {
  const m = lastMsg(c);
  const typing = ui.typing[c.id];
  const press = useRef<{ t?: ReturnType<typeof setTimeout>; fired?: boolean }>({});
  let pv: ReactNode = null;
  if (typing) pv = <span className="typing-txt">{c.type === 'group' ? typing + ' is ' : ''}typing…</span>;
  else if (ui.draft[c.id] && c.id !== ui.active) pv = <><span className="draft">Draft:</span> {ui.draft[c.id]}</>;
  else if (m) {
    const who = m.type !== 'system' && c.type === 'group' && m.from !== 'me' ? firstName(m.from) + ': ' : '';
    pv = <>{m.from === 'me' && !['system', 'deleted', 'call'].includes(m.type) ? <Ticks st={m.status} /> : null}{who}{preview(m)}</>;
  }
  const endPress = () => { clearTimeout(press.current.t); };
  return (
    <div className={`chat-item ${ui.active === c.id ? 'active' : ''}`} data-act="open" data-chat={c.id}
      onClick={() => { if (press.current.fired) { press.current.fired = false; return; } openChat(c.id); }}
      onContextMenu={(e) => { e.preventDefault(); chatItemMenu(c.id, { x: e.clientX, y: e.clientY }); }}
      onTouchStart={(e) => { const t = e.touches[0]; press.current.fired = false; press.current.t = setTimeout(() => { press.current.fired = true; chatItemMenu(c.id, { x: t.clientX, y: t.clientY }); }, 550); }}
      onTouchEnd={endPress} onTouchMove={endPress} onTouchCancel={endPress}>
      <ChatAvatar ch={c} />
      <div className="ci-body">
        <div className="ci-top"><span className="ci-name">{chatTitle(c)}{c.type === 'direct' ? <Verified c={contact(c.contactId)} /> : null}</span><span className={`ci-time ${c.unread && !c.muted ? 'unread' : ''}`}>{m ? listTime(m.t) : ''}</span></div>
        <div className="ci-bottom">
          <span className="ci-preview">{c.disappearing ? <span className="dis-ic"><Icon name="timer" size={14} /></span> : null}{pv}</span>
          <span className="ci-badges">
            {c.muted ? <Icon name="mute" size={18} /> : null}{c.pinned ? <Icon name="pin" size={18} /> : null}
            {c.unread ? <span className={`badge ${c.muted ? 'grey' : ''}`}>{c.unread}</span> : null}
            <button className="ci-menu" data-act="chatitemmenu" data-chat={c.id} aria-label="Chat options" onClick={(e) => { e.stopPropagation(); chatItemMenu(c.id, e.currentTarget); }}><Icon name="chevdown" size={20} /></button>
          </span>
        </div>
      </div>
    </div>
  );
}

function msgText(m: Message) {
  return m.type === 'text' ? (m.text || '') + ' ' + (m.tr || '') : m.type === 'doc' ? m.name || '' : m.caption || m.question || '';
}

/** chatListHTML(mode) including the profile banner (privacy.js). mode: '' | 'archived' | 'locked'. */
export function ChatList({ mode = '' }: { mode?: '' | 'archived' | 'locked' }) {
  const q = ui.search.trim().toLowerCase();
  let list = S.chats.filter((c) => (mode === 'archived' ? c.archived && !c.locked : mode === 'locked' ? c.locked : !c.archived && !c.locked)).filter((c) => mode || profileMatch(c));
  if (!mode) {
    if (ui.filter === 'unread') list = list.filter((c) => (c.unread || 0) > 0);
    if (ui.filter === 'groups') list = list.filter((c) => c.type === 'group');
    if (ui.filter === 'business') list = list.filter((c) => isBiz(c));
  }
  let hits: { c: Chat; m: Message }[] = [];
  if (q && !mode) {
    const pool = S.chats.filter((c) => !c.locked || ui.unlocked.includes(c.id));
    const uq = q.replace(/^@/, '');
    list = pool.filter((c) => chatTitle(c).toLowerCase().includes(q) || (c.type === 'direct' && !!contact(c.contactId)?.username.includes(uq)));
    pool.forEach((c) => c.messages.forEach((m) => {
      if (m.type === 'system' || m.type === 'deleted') return;
      if (msgText(m).toLowerCase().includes(q)) hits.push({ c, m });
    }));
    hits = hits.sort((a, b) => b.m.t - a.m.t).slice(0, 30);
  }
  list = list.slice().sort((a, b) => (mode ? 0 : (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || lastTime(b) - lastTime(a));

  const out: ReactNode[] = [];
  const p = S.settings.profile || 'personal';
  if (!mode && p !== 'personal' && !ui.search.trim() && PROFILES[p]) {
    const [name, e] = PROFILES[p];
    out.push(<div className="profile-banner" key="prof">{e} <b>{name} profile</b> · separate chats, notifications and status<button className="link-btn" data-act="setprofile" data-p="personal" onClick={() => switchProfile('personal')}>Back to Personal</button></div>);
  }
  let rows = 0;
  if (!mode && !q) {
    const locked = S.chats.filter((c) => c.locked).length;
    const arch = S.chats.filter((c) => c.archived && !c.locked);
    if (locked) { rows++; out.push(<div className="list-row special" data-act="openlocked" key="locked" onClick={openLocked}><span className="special-ic"><Icon name="lock" size={20} /></span><span className="ci-name">Locked chats</span><span className="ci-count">{locked}</span></div>); }
    if (arch.length) {
      const u = arch.filter((c) => c.unread).length;
      rows++;
      out.push(<div className="list-row special" data-act="openarchived" key="arch" onClick={() => openPage('archived')}><span className="special-ic"><Icon name="archive" size={20} /></span><span className="ci-name">Archived</span><span className={`ci-count ${u ? 'green' : ''}`}>{u || arch.length}</span></div>);
    }
  }
  if (q && list.length) out.push(<div className="list-label" key="lc">Chats</div>);
  list.forEach((c) => out.push(<ChatItem c={c} key={c.id} />));
  if (hits.length) {
    out.push(<div className="list-label" key="lm">Messages</div>);
    hits.forEach(({ c, m }) => out.push(
      <div className="chat-item" data-act="openmsg" data-chat={c.id} data-mid={m.id} key={'h' + c.id + m.id} onClick={() => openMsg(c.id, m.id)}>
        <div className="ci-body">
          <div className="ci-top"><span className="ci-name">{chatTitle(c)}</span><span className="ci-time">{listTime(m.t)}</span></div>
          <div className="ci-bottom"><span className="ci-preview">{m.from === 'me' ? 'You: ' : c.type === 'group' ? firstName(m.from) + ': ' : ''}<Highlight text={preview(m) + (m.tr ? ' · ' + m.tr : '')} q={q} /></span></div>
        </div>
      </div>,
    ));
  }
  if (q && !list.length && !hits.length) out.push(<div className="empty-list" key="none">No chats or messages found for “{q}”.<br /><button className="link-btn" data-act="newchat" onClick={openNewChat}>Search @usernames on WHATSMORE</button></div>);
  if (!q && !rows && !list.length) out.push(<div className="empty-list" key="empty">{mode === 'archived' ? 'No archived chats' : ui.filter !== 'all' ? 'Nothing in this filter' : 'No chats yet'}</div>);
  return <div className="side-scroll" id="chat-list" data-mode={mode}>{out}</div>;
}

const FILTERS: [string, string][] = [['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups'], ['business', 'Business']];
export function ChatsTab() {
  return (
    <>
      <header className="side-head"><h1 className="brand">WHATSMORE</h1><div className="head-actions">
        <button className="icon-btn" data-act="newchat" title="New chat" aria-label="New chat" onClick={openNewChat}><Icon name="newchat" /></button>
        <button className="icon-btn" data-act="chatsmenu" title="Menu" aria-label="Menu" onClick={(e) => chatsMenu(e.currentTarget)}><Icon name="more" /></button>
      </div></header>
      <div className="side-tools">
        <SearchBox id="chat-search" ph="Search or start a new chat" value={ui.search} onChange={(v) => { ui.search = v; refresh(); }} />
        <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={`chip ${ui.filter === k ? 'on' : ''}`} data-act="filter" data-f={k} onClick={() => { ui.filter = k; refresh(); }}>{l}</button>)}</div>
      </div>
      <ChatList />
    </>
  );
}
