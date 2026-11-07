'use client';
// Chat-level actions and modals ported from js/features.js (chat lock, delete/clear, block, exit group,
// disappearing messages, encryption code, group description, add members, invite link, member menu,
// chat picker, forwarding) and js/privacy.js (secret chats).
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { S, ui, commit, refresh, useRender } from '@/lib/state';
import { modal, confirmModal, toast, showMenu, copyText } from '@/lib/overlay';
import { openChat, closeChat, startDM, sendMsg, scheduleReply, addMembers, DISAPPEAR } from '@/lib/actions';
import { act } from '@/lib/registry';
import { uid, hash, chatTitle, chatById, contact, firstName, isAdmin, lastTime, directChatFor, generatePeople, findPeople } from '@/lib/util';
import type { Chat, Contact, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar } from '@/components/ui/Avatar';

const sys = (text: string) => ({ id: uid(), type: 'system', from: 'system', t: Date.now(), text }) as Message;
const q$ = <T extends Element = HTMLInputElement>(root: Element, sel: string) => root.querySelector(sel) as T | null;

// ---------- chat lock
export function withPin(cb: () => void) {
  if (!S.settings.lockPin) return setPinModal(cb);
  const unlock = (root: HTMLDivElement) => {
    const inp = q$(root, '#pin-in')!;
    if (inp.value === S.settings.lockPin) { setTimeout(cb, 0); return; }
    q$(root, '#pin-err')!.textContent = 'Incorrect PIN';
    inp.value = '';
    const box = q$<HTMLElement>(root, '.modal');
    box?.classList.add('shake');
    setTimeout(() => box?.classList.remove('shake'), 400);
    return false;
  };
  modal({
    title: 'Locked chat',
    body: (
      <>
        <p className="muted">Enter your 4-digit chat lock PIN.</p>
        <input id="pin-in" className="pin-input" type="password" inputMode="numeric" maxLength={4} autoComplete="off" autoFocus />
        <div className="err" id="pin-err" />
        <p className="muted small">Production apps would use Face ID / fingerprint here.</p>
      </>
    ),
    actions: [{ label: 'Cancel' }, { label: 'Unlock', primary: true, onClick: unlock }],
    onMount: (root) => q$(root, '#pin-in')?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') q$<HTMLButtonElement>(root, '[data-mact="1"]')?.click(); }),
  });
}
export function setPinModal(cb?: () => void) {
  modal({
    title: 'Create chat lock PIN',
    body: (
      <>
        <p className="muted">Locked chats are hidden from your chat list and need this PIN to open.</p>
        <input id="pin-a" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus />
        <input id="pin-b" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="Confirm" />
        <div className="err" id="pin-err" />
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Save PIN', primary: true, onClick: (root) => {
        const a = q$(root, '#pin-a')!.value, b = q$(root, '#pin-b')!.value;
        if (!/^\d{4}$/.test(a)) { q$(root, '#pin-err')!.textContent = 'PIN must be 4 digits'; return false; }
        if (a !== b) { q$(root, '#pin-err')!.textContent = "PINs don't match"; return false; }
        S.settings.lockPin = a; commit(); toast('Chat lock PIN saved');
        if (cb) setTimeout(cb, 0);
      },
    }],
  });
}
export function toggleLock(ch: Chat) {
  withPin(() => {
    ch.locked = !ch.locked;
    if (ch.locked && !ui.unlocked.includes(ch.id)) ui.unlocked.push(ch.id);
    commit();
    toast(ch.locked ? 'Chat locked — find it under “Locked chats” at the top of your chat list' : 'Chat unlocked');
  });
}
/** Open the Locked chats page after the PIN check (A.openlocked). */
export function openLocked() {
  withPin(() => {
    S.chats.filter((c) => c.locked).forEach((c) => { if (!ui.unlocked.includes(c.id)) ui.unlocked.push(c.id); });
    ui.tab = 'chats'; ui.page = 'locked';
    refresh();
  });
}

// ---------- chat-level actions
export function deleteChat(ch: Chat) {
  confirmModal('Delete this chat?', 'Messages will be removed from this device.', 'Delete chat', () => {
    S.chats = S.chats.filter((c) => c !== ch);
    S.communities.forEach((cm) => { cm.groups = (cm.groups || []).filter((g: string) => g !== ch.id); });
    if (ui.active === ch.id) closeChat();
    commit(); toast('Chat deleted');
  });
}
export function clearChat(ch: Chat) {
  confirmModal('Clear this chat?', 'All messages in this chat will be deleted for you.', 'Clear chat', () => {
    ch.messages = ch.messages.filter((m) => m.type === 'system' && /end-to-end/.test(m.text || ''));
    commit(); toast('Chat cleared');
  });
}
export function toggleBlock(c?: Contact | null) {
  if (!c) return;
  const doIt = () => { c.blocked = !c.blocked; commit(); toast(c.blocked ? `${c.name} blocked` : `${c.name} unblocked`); };
  if (c.blocked) doIt(); else confirmModal(`Block ${c.name}?`, "Blocked contacts can't call you or send you messages.", 'Block', doIt);
}
export function exitGroup(ch: Chat) {
  confirmModal(`Exit "${ch.name}"?`, 'You will no longer receive messages from this group.', 'Exit group', () => {
    ch.left = true;
    ch.messages.push(sys('You left'));
    commit();
  });
}
export function disappearModal(ch: Chat) {
  const opts: [string, string][] = [['', 'Off'], ...Object.entries(DISAPPEAR).map(([k, [l]]) => [k, l] as [string, string])];
  modal({
    title: 'Disappearing messages',
    body: (
      <>
        <p className="muted">New messages will disappear from this chat after the selected time. Choose “1 minute (demo)” to watch it happen.</p>
        {opts.map(([k, l]) => <label className="radio-row" key={k}><input type="radio" name="dm" value={k} defaultChecked={(ch.disappearing || '') === k} /> {l}</label>)}
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: (root) => {
        const v = q$(root, 'input[name=dm]:checked')?.value || null;
        if (v === (ch.disappearing || null)) return;
        ch.disappearing = v;
        ch.messages.push(sys(v ? `You turned on disappearing messages. New messages will disappear from this chat ${DISAPPEAR[v][0].replace(' (demo)', '')} after they're sent.` : 'You turned off disappearing messages.'));
        commit();
      },
    }],
  });
}

function QRBox({ text, id }: { text: string; id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { width: 196, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111b21', light: '#ffffff' } })
      .then((u) => { if (live) setSrc(u); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [text]);
  return (
    <div id={id} className="qr-box">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} width={196} height={196} alt="Security code QR" /> : failed ? <div className="qr-fallback"><Icon name="qr" size={120} /><small>QR library offline</small></div> : null}
    </div>
  );
}
export function verifyModal(ch: Chat) {
  const seed = hash(S.me.username + (ch.contactId || ch.id));
  const digits = Array.from({ length: 12 }, (_, i) => String((seed * (i + 7) * 2654435761) % 100000).padStart(5, '0'));
  modal({
    title: 'Encryption',
    body: (
      <>
        <p className="muted">Messages and calls in this chat are end-to-end encrypted. Compare this security code with {chatTitle(ch)} to verify.</p>
        <QRBox id="sec-qr" text={digits.join('')} />
        <div className="sec-code">{digits.map((d, i) => <span key={i}>{d}</span>)}</div>
        <p className="muted small">Demo: production uses the Signal protocol for 1:1 chats and Sender Keys for groups.</p>
      </>
    ),
    actions: [{ label: 'Done', primary: true }],
  });
}
export function editDescModal(ch: Chat) {
  modal({
    title: 'Group description',
    body: <label className="field"><span>Description</span><textarea id="gd" rows={3} maxLength={300} autoFocus defaultValue={ch.description || ''} /></label>,
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: (root) => {
        ch.description = q$<HTMLTextAreaElement>(root, '#gd')!.value.trim();
        ch.messages.push(sys('You changed the group description'));
        commit();
      },
    }],
  });
}

// ---------- people picker (group members, add members) — paged, no participant limit
const PICK_PAGE = 60;
export function PeoplePicker({ q, picked, exclude = [], attr = 'data-pick', onToggle }: { q: string; picked: ReadonlySet<string> | readonly string[]; exclude?: string[]; attr?: string; onToggle: (id: string, on: boolean) => void }) {
  const list = findPeople(q, exclude);
  const has = (id: string) => ('has' in picked ? (picked as ReadonlySet<string>).has(id) : (picked as readonly string[]).includes(id));
  if (!list.length) return <div className="empty-list small">No one found{q ? ` for “${q}”` : ''}.</div>;
  const shown = list.slice(0, PICK_PAGE);
  return (
    <>
      {shown.map((c) => (
        <label className="chat-item check-row" key={c.id}>
          <Avatar o={c} size={40} />
          <div className="ci-body"><div className="ci-name">{c.name}{c.isContact ? null : <> <span className="pill">On WHATSMORE</span></>}</div><div className="ci-preview">@{c.username}</div></div>
          <input type="checkbox" className="check" {...{ [attr]: c.id }} checked={has(c.id)} onChange={(e) => onToggle(c.id, e.target.checked)} />
        </label>
      ))}
      {list.length > shown.length && <div className="empty-list small">Showing {shown.length} of {list.length.toLocaleString()} — search by name or @username to find more.</div>}
    </>
  );
}

function AddMemberBody({ ch, picked, onLink }: { ch: Chat; picked: Set<string>; onLink: () => void }) {
  const [q, setQ] = useState('');
  const [, setN] = useState(0);
  return (
    <>
      <div className="search modal-search"><Icon name="search" size={18} /><input id="am-q" placeholder="Search name or @username" autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="row-between">
        <span className="muted small" id="am-count">{picked.size ? `${picked.size.toLocaleString()} selected` : 'No limit — add as many people as you like'}</span>
        <button className="link-btn" id="am-link" onClick={onLink}><Icon name="link" size={16} /> Invite via link</button>
      </div>
      <div className="pick-list" id="am-list">
        <PeoplePicker q={q} picked={picked} exclude={ch.members || []} attr="data-am" onToggle={(id, on) => { if (on) picked.add(id); else picked.delete(id); setN((n) => n + 1); }} />
      </div>
    </>
  );
}
export function addMemberModal(ch: Chat) {
  const picked = new Set<string>();
  const h = modal({
    title: 'Add members',
    body: <AddMemberBody ch={ch} picked={picked} onLink={() => { h.close(); inviteLinkModal(ch); }} />,
    actions: [{ label: 'Cancel' }, {
      label: 'Add', primary: true, onClick: () => {
        if (!picked.size) { toast('Select at least one person'); return false; }
        const n = addMembers(ch, [...picked]);
        toast(`Added ${n.toLocaleString()} member${n === 1 ? '' : 's'}`);
      },
    }],
  });
}

function InviteBody({ ch, link }: { ch: Chat; link: string }) {
  useRender();
  const inp = useRef<HTMLInputElement>(null);
  const join = () => {
    const n = Math.floor(+(inp.current?.value || 0));
    if (!(n > 0)) return toast('Enter how many people');
    const added = addMembers(ch, generatePeople(n), 'joined');
    toast(`${added.toLocaleString()} people joined · ${((ch.members || []).length + 1).toLocaleString()} members`);
  };
  return (
    <>
      <div className="call-link-card"><ChatAvatar ch={ch} size={56} /><div className="grow"><div className="ci-name">{ch.name}</div><div className="qr-link">{link}</div></div></div>
      <p className="muted small">Anyone with WHATSMORE can follow this link to join. Groups have <b>no participant limit</b> — currently {((ch.members || []).length + 1).toLocaleString()} members.</p>
      <div className="hint-box"><Icon name="groups" size={16} /><div className="grow"><div><b>Demo:</b> simulate people joining via the link</div>
        <div className="join-sim"><input id="join-n" ref={inp} type="number" min={1} step={1} defaultValue={500} aria-label="Number of people" onKeyDown={(e) => { if (e.key === 'Enter') join(); }} /><button className="btn sm primary" id="join-go" onClick={join}>Join</button></div></div></div>
    </>
  );
}
export function inviteLinkModal(ch: Chat) {
  ch.invite = ch.invite || Math.random().toString(36).slice(2, 12);
  const link = `https://whatsmore.app/g/${ch.invite}`;
  commit();
  modal({
    title: 'Group invite link',
    body: <InviteBody ch={ch} link={link} />,
    actions: [
      { label: 'Reset link', onClick: () => { ch.invite = null; commit(); toast('Old link no longer works'); setTimeout(() => inviteLinkModal(ch), 0); } },
      { label: 'Share in chat', onClick: () => { setTimeout(() => chatPicker('Share invite link', (chats) => { chats.forEach((c) => sendMsg(c, { type: 'text', text: `Join "${ch.name}" on WHATSMORE 👥 ${link}` })); toast('Invite link shared'); }), 0); } },
      { label: 'Copy link', primary: true, onClick: () => { copyText(link); return false; } },
    ],
  });
}

export function memberMenu(ch: Chat, id: string, anchor: Element | { x: number; y: number }) {
  if (id === 'me') return;
  const adm = (ch.admins || []).includes(id);
  showMenu(anchor, [
    { label: 'Message ' + firstName(id), icon: 'chat', onClick: () => startDM(id) },
    { label: 'Voice call', icon: 'call', onClick: () => { const dc = directChatFor(id); if (dc) act.startCall(dc, false); else startDM(id); } },
    isAdmin(ch) && { label: adm ? 'Dismiss as admin' : 'Make group admin', icon: 'shield', onClick: () => {
      ch.admins = adm ? (ch.admins || []).filter((a) => a !== id) : [...(ch.admins || []), id];
      ch.messages.push(sys(`${firstName(id)} is ${adm ? 'no longer' : 'now'} an admin`));
      commit();
    } },
    isAdmin(ch) && { label: 'Remove from group', icon: 'delete', danger: true, onClick: () => {
      ch.members = (ch.members || []).filter((m) => m !== id);
      ch.admins = (ch.admins || []).filter((a) => a !== id);
      ch.messages.push(sys(`You removed ${firstName(id)}`));
      commit();
    } },
  ]);
}

// ---------- choose chats (forward, share links, send drafts …)
function PickerBody({ chats, single }: { chats: Chat[]; single?: boolean }) {
  const [q, setQ] = useState('');
  const ql = q.toLowerCase();
  return (
    <>
      <div className="search modal-search"><Icon name="search" size={18} /><input id="pk-q" placeholder="Search chats" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pick-list">
        {chats.map((c) => {
          const name = chatTitle(c).toLowerCase();
          return (
            <label className="chat-item check-row" data-name={name} key={c.id} hidden={!name.includes(ql)}>
              <ChatAvatar ch={c} size={40} />
              <div className="ci-body"><div className="ci-name">{chatTitle(c)}</div></div>
              <input type={single ? 'radio' : 'checkbox'} name="pk" className="check" value={c.id} />
            </label>
          );
        })}
      </div>
    </>
  );
}
export function chatPicker(title: string, cb: (chats: Chat[]) => boolean | void, opts: { single?: boolean; label?: string } = {}) {
  const chats = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  modal({
    title,
    body: <PickerBody chats={chats} single={opts.single} />,
    actions: [{ label: 'Cancel' }, {
      label: opts.label || 'Send', primary: true, onClick: (root) => {
        const ids = [...root.querySelectorAll<HTMLInputElement>('input[name=pk]:checked')].map((i) => i.value);
        if (!ids.length) { toast('Select at least one chat'); return false; }
        if (cb(ids.map((id) => chatById(id)).filter(Boolean) as Chat[]) === false) return false;
      },
    }],
  });
}
const FORWARD_LIMIT = 5;
export function forwardModal(m: Message) {
  chatPicker('Forward message to…', (chats) => {
    if (chats.length > FORWARD_LIMIT) { toast(`You can forward to up to ${FORWARD_LIMIT} chats at once`); return false; }
    chats.forEach((ch) => {
      const copy = JSON.parse(JSON.stringify(m));
      ['id', 'from', 't', 'status', 'reactions', 'starred', 'pinned', 'replyTo', 'edited', 'exp', 'bot', 'scheduled'].forEach((k) => delete copy[k]);
      const sent = sendMsg(ch, { ...copy, forwarded: true });
      if (ch.id !== ui.active) scheduleReply(ch, sent);
    });
    toast(`Forwarded to ${chats.length} chat${chats.length > 1 ? 's' : ''}`);
  });
}

// ---------- secret chats (js/privacy.js)
export function startSecretChat(contactId: string) {
  const c = contact(contactId);
  if (!c) return;
  let ch = S.chats.find((x) => x.secret && x.contactId === contactId);
  if (!ch) {
    const t = Date.now();
    ch = {
      id: 'ch_' + uid(), type: 'direct', contactId, secret: true, unread: 0, disappearing: '24h',
      privacy: { noForward: true, screenshotAlert: true, hideReceipts: false, hideLastSeen: true },
      messages: [{ id: uid(), type: 'system', from: 'system', t, text: `🔒 Secret chat with ${c.name}. Messages are end-to-end encrypted, stay only on this device, can't be forwarded or copied, and disappear after 24 hours. Screenshot alerts are on.` }],
    };
    S.chats.push(ch);
    commit();
  }
  ui.tab = 'chats'; ui.page = null;
  openChat(ch.id);
}
export function secretPickModal() {
  const people = S.contacts.filter((c) => c.isContact && !c.business);
  const h = modal({
    title: 'New secret chat',
    body: (
      <>
        <p className="muted small"><Icon name="lock" size={14} /> Device-only, end-to-end encrypted, no forwarding or copying, disappears after 24 hours, with screenshot alerts.</p>
        <div className="pick-list">
          {people.map((c) => (
            <button className="chat-item check-row bare-btn" data-secret={c.id} key={c.id} onClick={() => { h.close(); startSecretChat(c.id); }}>
              <Avatar o={c} size={40} />
              <div className="ci-body"><div className="ci-name">{c.name}</div><div className="ci-preview">@{c.username}</div></div>
            </button>
          ))}
        </div>
      </>
    ),
  });
}
