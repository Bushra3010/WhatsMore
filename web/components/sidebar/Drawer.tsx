'use client';
// Contact / group / business info drawer and the per-chat starred drawer (js/overlays.js renderDrawer).
import { useState, type ReactNode } from 'react';
import { S, ui, commit, refresh } from '@/lib/state';
import { DISAPPEAR } from '@/lib/actions';
import { act } from '@/lib/registry';
import { openDrawer } from '@/lib/nav';
import { chatById, contact, isAdmin, money, uid } from '@/lib/util';
import type { Chat, Contact } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar, Verified } from '@/components/ui/Avatar';
import { StarredList } from './pages';
import { openMsg } from './ChatList';
import {
  addMemberModal, deleteChat, disappearModal, editDescModal, exitGroup, inviteLinkModal, memberMenu, toggleBlock, toggleLock, verifyModal,
} from './chatActions';

const MEM_PAGE = 20;

function toggleMute(ch: Chat) { ch.muted = !ch.muted; commit(); }
function toggleTranslate(ch: Chat) { ch.translate = !ch.translate; commit(); }
function toggleReadOnly(ch: Chat) {
  ch.readOnly = !ch.readOnly;
  ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: ch.readOnly ? 'You changed this group so only admins can send messages' : 'You changed this group so all members can send messages' });
  commit();
}

function DrawerHead({ title }: { title: string }) {
  return <header className="drawer-head"><button className="icon-btn" data-act="drawer-close" aria-label="Close" onClick={() => openDrawer(null)}><Icon name="close" /></button><h3>{title}</h3></header>;
}
function Row({ actName, ic, title, sub, extra, onClick }: { actName: string; ic: string; title: ReactNode; sub?: ReactNode; extra?: ReactNode; onClick: () => void }) {
  return (
    <div className="info-row" data-act={actName} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <Icon name={ic} size={22} cls="muted" /><div className="grow"><div>{title}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>{extra}
    </div>
  );
}
const Sw = ({ on }: { on?: boolean }) => <input type="checkbox" className="switch" checked={!!on} readOnly tabIndex={-1} />;

function chatSearch() {
  if (innerWidth <= 1100) ui.drawer = null;
  ui.chatSearch = ui.chatSearch ?? ''; ui.searchIdx = 0;
  refresh();
  setTimeout(() => document.getElementById('cs-input')?.focus(), 30);
}

/** memberListHTML: admins first, searchable, paged so groups of any size stay fast. */
function MemberList({ ch, q, limit, more }: { ch: Chat; q: string; limit: number; more: () => void }) {
  const ql = q.trim().toLowerCase().replace(/^@/, '');
  const admins = new Set(ch.admins || []);
  const who = (id: string) => (id === 'me' ? S.me : contact(id));
  let ids = ['me', ...(ch.members || [])].sort((a, b) => (admins.has(b) ? 1 : 0) - (admins.has(a) ? 1 : 0) || (a === 'me' ? -1 : b === 'me' ? 1 : 0));
  if (ql) ids = ids.filter((id) => { const p = who(id); return p && (p.name.toLowerCase().includes(ql) || p.username.includes(ql)); });
  const shown = ids.slice(0, limit);
  return (
    <div id="mem-list">
      {shown.map((id) => {
        const p = who(id);
        return (
          <div className="info-row member" data-act="member" data-id={id} key={id} onClick={(e) => memberMenu(ch, id, e.currentTarget)}>
            <Avatar o={p} size={40} />
            <div className="grow"><div>{id === 'me' ? 'You' : p?.name}</div><div className="ci-sub">@{p?.username}</div></div>
            {admins.has(id) ? <span className="pill">Admin</span> : null}
          </div>
        );
      })}
      {ids.length > shown.length && <button className="link-row" data-act="memmore" onClick={more}>View more ({(ids.length - shown.length).toLocaleString()} remaining)</button>}
      {!ids.length && <div className="empty-list small">No members found</div>}
    </div>
  );
}

function InfoBody({ ch }: { ch: Chat }) {
  const [memQ, setMemQ] = useState('');
  const [memLimit, setMemLimit] = useState(MEM_PAGE);
  const c: Contact | undefined = ch.type === 'direct' ? contact(ch.contactId) : undefined;
  const media = ch.messages.filter((m) => ['image', 'video', 'doc'].includes(m.type));
  const starredN = ch.messages.filter((m) => m.starred).length;
  const admin = isAdmin(ch);
  const sections: ReactNode[] = [];

  if (c) {
    sections.push(
      <div className="info-sec hero" key="hero">
        <Avatar o={c} size={160} />
        <h2>{c.name}<Verified c={c} /></h2>
        <div className="accent">@{c.username}</div>
        <div className="ci-sub">{c.business ? c.business.category + ' · Business account' : 'Phone number hidden · connected by username'}</div>
        <div className="info-actions">
          <button data-act="call-voice" onClick={() => act.startCall(ch, false)}><Icon name="call" /><span>Audio</span></button>
          <button data-act="call-video" onClick={() => act.startCall(ch, true)}><Icon name="video" /><span>Video</span></button>
          <button data-act="paymodal" onClick={() => act.payModal(ch)}><Icon name="rupee" /><span>Pay</span></button>
          <button data-act="chatsearch" onClick={chatSearch}><Icon name="search" /><span>Search</span></button>
        </div>
      </div>,
      <div className="info-sec" key="about"><div className="info-label">About</div><div>{c.about || '—'}</div></div>,
    );
    if (c.business) {
      const b = c.business;
      sections.push(
        <div className="info-sec" key="biz"><div className="info-label">Business details</div>
          <div className="biz-row"><Icon name="timer" size={18} cls="muted" /><span>{b.hours}</span></div>
          <div className="biz-row"><Icon name="store" size={18} cls="muted" /><span>{b.address}</span></div>
          <div className="biz-row"><Icon name="link" size={18} cls="muted" /><span className="accent">{b.website}</span></div>
          <div className="biz-row"><Icon name="rupee" size={18} cls="muted" /><span>{b.payments}</span></div>
        </div>,
        <div className="info-sec" key="cat">
          <div className="info-label row-between"><span>Catalogue</span><button className="link-btn" data-act="catalog" onClick={() => act.catalogModal(ch)}>See all</button></div>
          <div className="mini-cat">{(S.catalog[c.id] || []).map((p, i) => (
            <button className="mini-prod" data-act="catalog" key={p.id || i} onClick={() => act.catalogModal(ch)}><div className="prod-art" style={{ background: p.bg }}>{p.emoji}</div><span>{money(p.price)}</span></button>
          ))}</div>
        </div>,
      );
    }
  } else {
    const cm = ch.community ? S.communities.find((x) => x.id === ch.community) : null;
    sections.push(
      <div className="info-sec hero" key="hero">
        <ChatAvatar ch={ch} size={160} />
        <h2>{ch.name}</h2>
        <div className="ci-sub">Group · {((ch.members || []).length + 1).toLocaleString()} members{ch.community ? ' · ' + (cm?.name || '') : ''}</div>
        <div className="info-actions">
          <button data-act="call-voice" onClick={() => act.startCall(ch, false)}><Icon name="call" /><span>Audio</span></button>
          <button data-act="call-video" onClick={() => act.startCall(ch, true)}><Icon name="video" /><span>Video</span></button>
          <button data-act="paymodal" onClick={() => act.payModal(ch)}><Icon name="rupee" /><span>Split</span></button>
          <button data-act="aisummary" onClick={() => act.aiSummaryModal(ch)}><Icon name="sparkle" /><span>Summary</span></button>
        </div>
      </div>,
      <div className="info-sec" key="desc" {...(admin ? { 'data-act': 'editdesc', role: 'button', tabIndex: 0, onClick: () => editDescModal(ch) } : {})}>
        <div className="info-label">Description</div><div>{ch.description || (admin ? 'Add group description' : 'No description')}</div>
      </div>,
    );
  }

  sections.push(
    <div className="info-sec" key="media">
      <div className="info-label row-between"><span>Media, links and docs</span><span className="ci-sub">{media.length}</span></div>
      <div className="media-strip">
        {media.length ? media.slice(-6).reverse().map((m) => (
          <button className="media-thumb" data-act="openmsg" data-chat={ch.id} data-mid={m.id} key={m.id} onClick={() => openMsg(ch.id, m.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.type === 'image' ? (m.src ? <img src={m.src} alt="" /> : <div style={{ background: m.art?.bg }}>{m.art?.emoji}</div>) : <div className="doc-thumb">{(m.ext || 'vid').toUpperCase()}</div>}
          </button>
        )) : <span className="ci-sub">No media yet</span>}
      </div>
    </div>,
    <div className="info-sec list" key="opts">
      <Row actName="drawer-starred" ic="star" title="Starred messages" extra={<span className="ci-sub">{starredN || 'None'}</span>} onClick={() => openDrawer('starred')} />
      <Row actName="mute" ic="mute" title="Mute notifications" extra={<Sw on={ch.muted} />} onClick={() => toggleMute(ch)} />
      <Row actName="disappear" ic="timer" title="Disappearing messages" sub={ch.disappearing ? DISAPPEAR[ch.disappearing][0] : 'Off'} onClick={() => disappearModal(ch)} />
      <Row actName="lock-toggle" ic="lock" title="Chat lock" sub={ch.locked ? 'Locked · hidden from chat list' : 'Lock and hide this chat on this device'} extra={<Sw on={ch.locked} />} onClick={() => toggleLock(ch)} />
      {ch.messages.some((m) => m.tr) && <Row actName="translate-toggle" ic="translate" title="Translate messages" sub="Show English translations" extra={<Sw on={ch.translate} />} onClick={() => toggleTranslate(ch)} />}
      <Row actName="verify" ic="lock" title="Encryption" sub="Messages and calls are end-to-end encrypted. Tap to verify." onClick={() => verifyModal(ch)} />
    </div>,
  );

  if (ch.type === 'group') {
    const total = (ch.members || []).length + 1;
    sections.push(
      <div className="info-sec list" key="members">
        <div className="info-label pad-x row-between"><span>{total.toLocaleString()} members</span><span className="muted small">No limit</span></div>
        {admin && !ch.left && <>
          <div className="info-row" data-act="addmember" role="button" tabIndex={0} onClick={() => addMemberModal(ch)}><span className="action-ic"><Icon name="personadd" size={20} /></span><div className="grow">Add members</div></div>
          <div className="info-row" data-act="invitelink" role="button" tabIndex={0} onClick={() => inviteLinkModal(ch)}><span className="action-ic"><Icon name="link" size={20} /></span><div className="grow">Invite to group via link</div></div>
        </>}
        {total > 8 && <div className="pad-x"><div className="search"><Icon name="search" size={18} /><input id="mem-search" placeholder={`Search ${total.toLocaleString()} members`} value={memQ} autoComplete="off" onChange={(e) => { setMemQ(e.target.value); setMemLimit(MEM_PAGE); }} /></div></div>}
        <MemberList ch={ch} q={memQ} limit={memLimit} more={() => setMemLimit((n) => n + 100)} />
      </div>,
    );
    if (admin) {
      sections.push(
        <div className="info-sec list" key="admin"><div className="info-label pad-x">Admin controls</div>
          <Row actName="toggle-readonly" ic="megaphone" title="Only admins can send messages" sub="Turn the group into an announcement channel" extra={<Sw on={ch.readOnly} />} onClick={() => toggleReadOnly(ch)} />
        </div>,
      );
    }
  }

  sections.push(
    <div className="info-sec list danger" key="danger">
      {c && <>
        <Row actName="block" ic="block" title={c.blocked ? 'Unblock ' + c.name : 'Block ' + c.name} onClick={() => toggleBlock(c)} />
        <Row actName="report" ic="info" title={'Report ' + c.name} onClick={() => act.reportUser(c.id)} />
      </>}
      {ch.type === 'group' && <Row actName="reportgroup" ic="info" title="Report group" onClick={() => act.reportGroup(ch)} />}
      {ch.type === 'group' && !ch.left && <Row actName="exitgroup" ic="logout" title="Exit group" onClick={() => exitGroup(ch)} />}
      <Row actName="deletechat" ic="delete" title="Delete chat" onClick={() => deleteChat(ch)} />
    </div>,
  );

  return (
    <>
      <DrawerHead title={ch.type === 'group' ? 'Group info' : c?.business ? 'Business info' : 'Contact info'} />
      <div className="drawer-body">{sections}</div>
    </>
  );
}

export function InfoDrawer() {
  const ch = chatById(ui.active);
  if (!ch) return null;
  // keyed by chat so member search and paging reset when another chat opens (openDrawer reset them)
  return <InfoBody ch={ch} key={ch.id} />;
}

export function StarredDrawer() {
  const ch = chatById(ui.active);
  if (!ch) return null;
  return (
    <>
      <DrawerHead title="Starred messages" />
      <div className="drawer-body"><StarredList items={ch.messages.filter((m) => m.starred && m.type !== 'deleted').map((m) => ({ c: ch, m }))} /></div>
    </>
  );
}
