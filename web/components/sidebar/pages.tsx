'use client';
// Sidebar pages: New chat, New group, Archived, Locked chats, Starred messages (js/sidebar.js,
// js/privacy.js "New secret chat", js/settings.js 'set-starred').
import type { ReactNode } from 'react';
import { S, ui, refresh } from '@/lib/state';
import { startDM, createGroup } from '@/lib/actions';
import { act } from '@/lib/registry';
import { openPage } from '@/lib/nav';
import { contact, chatTitle, senderName, listTime, preview, namesSummary } from '@/lib/util';
import type { Chat, Contact, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, Verified } from '@/components/ui/Avatar';
import { PageHead, SearchBox } from '@/components/ui/Bits';
import { Slot } from '@/components/ui/Slot';
import { ChatList, openMsg } from './ChatList';
import { PeoplePicker, secretPickModal } from './chatActions';

// ---------- new chat / username connect
function startdm(id: string) { ui.ncQuery = ''; startDM(id); }
export function PersonRow({ u, request }: { u: Contact; request?: boolean }) {
  return (
    <div className="chat-item" data-act="startdm" data-user={u.id} onClick={() => startdm(u.id)}>
      <Avatar o={u} />
      <div className="ci-body">
        <div className="ci-top"><span className="ci-name">{u.name}<Verified c={u} /></span>{request ? <span className="pill">Chat request</span> : null}</div>
        <div className="ci-bottom"><span className="ci-preview">@{u.username}{u.about ? ' · ' + u.about : ''}</span></div>
      </div>
    </div>
  );
}
function ActionRow({ actName, ic, title, sub, onClick, bg }: { actName: string; ic: string; title: string; sub?: string; onClick: () => void; bg?: string }) {
  return (
    <div className="list-row action" data-act={actName} onClick={onClick}>
      <span className="action-ic" style={bg ? { background: bg } : undefined}><Icon name={ic} size={22} /></span>
      <div><div className="ci-name">{title}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>
    </div>
  );
}
function NewChatList() {
  const q = ui.ncQuery.trim().toLowerCase().replace(/^@/, '');
  const out: ReactNode[] = [];
  if (!ui.ncQuery.trim()) out.push(<ActionRow key="secret" actName="newsecret" ic="lock" bg="#37474f" title="New secret chat" sub="Device-only · no forwarding · disappears in 24 h" onClick={secretPickModal} />);
  if (!q) {
    out.push(
      <ActionRow key="ng" actName="newgroup" ic="groups" title="New group" onClick={() => openPage('newgroup')} />,
      <ActionRow key="nc" actName="newcommunity" ic="groups" title="New community" onClick={() => act.newCommunityModal()} />,
      <ActionRow key="qr" actName="myqr" ic="qr" title="My QR code" sub="Share your profile without a phone number" onClick={() => act.qrModal()} />,
      <ActionRow key="scan" actName="scanqr" ic="qr" title="Scan QR code or paste profile link" onClick={() => act.scanModal()} />,
      <ActionRow key="cl" actName="calllink" ic="link" title="Create call link" sub="WHATSMORE Call Rooms" onClick={() => act.callLinkModal()} />,
    );
  }
  const contacts = S.contacts.filter((c) => c.isContact && (!q || c.name.toLowerCase().includes(q) || c.username.includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  if (contacts.length) {
    out.push(<div className="list-label" key="lc">Contacts on WHATSMORE</div>);
    contacts.forEach((c) => out.push(<PersonRow u={c} key={'c' + c.id} />));
  }
  if (q.length >= 2) {
    const others = [...S.directory.filter((u) => !S.contacts.some((c) => c.id === u.id)), ...S.contacts.filter((c) => !c.isContact)].filter((u) => u.username.includes(q));
    out.push(<div className="list-label" key="lf">Find by username</div>);
    if (others.length) others.forEach((u) => out.push(<PersonRow u={u} request key={'o' + u.id} />));
    else out.push(<div className="empty-list small" key="none">No one found with @{q}. Usernames are unique — check the spelling.</div>);
  } else if (!q) {
    out.push(<div className="hint-box" key="hint"><Icon name="person" size={18} /><span>Connect with anyone by their unique <b>@username</b> — no phone number needed. Try <b>@meera.designs</b> or <b>@techguru_kiran</b>.</span></div>);
  }
  return <>{out}</>;
}
export function NewChatPage() {
  return (
    <>
      <PageHead title="New chat" />
      <div className="side-tools"><SearchBox id="nc-search" ph="Search name or @username" value={ui.ncQuery} onChange={(v) => { ui.ncQuery = v; refresh(); }} /></div>
      <div className="side-scroll" id="nc-list">
        <Slot name="newchat.results" />
        <NewChatList />
      </div>
    </>
  );
}

// ---------- new group (no participant limit)
function NgPicked() {
  const n = ui.ngPick.length;
  return n
    ? <><span className="pill">{n.toLocaleString()} selected</span> <span className="muted small">{namesSummary(ui.ngPick, 4)}</span></>
    : <span className="muted small">Select members below — there is no limit on group size</span>;
}
export function NewGroupPage() {
  return (
    <>
      <PageHead title="New group" />
      <div className="form-pad">
        <label className="field"><span>Group name</span><input id="ng-name" maxLength={40} placeholder="e.g. College Friends" value={ui.ngName} onChange={(e) => { ui.ngName = e.target.value; refresh(); }} /></label>
        <div className="picked" id="ng-picked"><NgPicked /></div>
      </div>
      <div className="side-tools"><SearchBox id="ng-search" ph="Search name or @username" value={ui.ngQuery || ''} onChange={(v) => { ui.ngQuery = v; refresh(); }} /></div>
      <div className="list-label">Add members · unlimited</div>
      <div className="side-scroll" id="ng-list">
        <PeoplePicker q={ui.ngQuery} picked={ui.ngPick} onToggle={(id, on) => { ui.ngPick = on ? [...ui.ngPick.filter((x) => x !== id), id] : ui.ngPick.filter((x) => x !== id); refresh(); }} />
      </div>
      <div className="side-foot"><button className="btn primary block" data-act="creategroup" onClick={() => createGroup()}><Icon name="check" size={18} /> Create group</button></div>
    </>
  );
}

// ---------- archived / locked
export function ArchivedPage() {
  return <><PageHead title="Archived" /><ChatList mode="archived" /></>;
}
export function LockedPage() {
  return (
    <>
      <PageHead title="Locked chats" />
      <div className="hint-box"><Icon name="lock" size={16} /> These chats are hidden from your chat list and need your PIN to open.</div>
      <ChatList mode="locked" />
    </>
  );
}

// ---------- starred
export function allStarred() {
  const out: { c: Chat; m: Message }[] = [];
  S.chats.forEach((c) => c.messages.forEach((m) => { if (m.starred && m.type !== 'deleted') out.push({ c, m }); }));
  return out;
}
export function StarredList({ items }: { items: { c: Chat; m: Message }[] }) {
  if (!items.length) return <div className="empty-list"><Icon name="star" size={40} /><br />No starred messages<br /><small>Open a message&apos;s menu and choose Star to save it here.</small></div>;
  return (
    <>
      {items.slice().sort((a, b) => b.m.t - a.m.t).map(({ c, m }) => (
        <div className="starred-item" data-act="openmsg" data-chat={c.id} data-mid={m.id} key={c.id + m.id} onClick={() => openMsg(c.id, m.id)}>
          <div className="st-top"><Avatar o={m.from === 'me' ? S.me : contact(m.from)} size={24} /><span className="st-who">{senderName(m.from)} ▸ {chatTitle(c)}</span><span className="ci-time">{listTime(m.t)}</span></div>
          <div className={`st-bubble ${m.from === 'me' ? 'out' : ''}`}>{preview(m)}</div>
        </div>
      ))}
    </>
  );
}
export function StarredPage() {
  return <><PageHead title="Starred messages" /><div className="side-scroll"><StarredList items={allStarred()} /></div></>;
}
