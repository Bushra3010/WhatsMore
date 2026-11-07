'use client';
// Pop-up menus of the open chat: message menu, header ⋮ menu, attach menu, AI writing menu,
// plus the delete-message and reactions dialogs. Ported from js/features.js, js/overlays.js,
// js/messaging.js, js/privacy.js and js/main.js.
import { S, ui, commit, refresh } from '@/lib/state';
import type { Chat, Message } from '@/lib/types';
import { showMenu, modal, copyText, toast, closeModal, pickFile, type MenuItem } from '@/lib/overlay';
import { contact, isBiz, preview, senderName, MIN } from '@/lib/util';
import { fire } from '@/lib/actions';
import { act, menuHooks } from '@/lib/registry';
import { openDrawer } from '@/lib/nav';
import { Avatar } from '@/components/ui/Avatar';
import { REACTS, AI, AI_DRAFTS, curChat, noForward, react, togglePin, toggleStar, toggleTranslate, toggleMute, setInput, focusInput, composer } from './core';
import {
  payModal, pollModal, eventModal, shareContactModal, locationModal, catalogModal, scheduleModal, aiSummaryModal, liveTranslateModal,
  chatPrivacyModal, reportMessage, reportModal, enhanceImage, sendMedia,
} from './modals';

type Anchor = Element | { x: number; y: number };
type Item = MenuItem | '-' | false | null | undefined;

export function openChatSearch() {
  if (innerWidth <= 1100) ui.drawer = null;
  ui.chatSearch = ui.chatSearch ?? '';
  ui.searchIdx = 0;
  refresh();
  setTimeout(() => document.getElementById('cs-input')?.focus(), 30);
}

// ---------- message menu
export function msgMenu(mid: string, anchor: Anchor) {
  const ch = curChat(), m = ch?.messages.find((x) => x.id === mid);
  if (!ch || !m || m.type === 'system') return;
  const out = m.from === 'me', alive = m.type !== 'deleted';
  const fwdable = alive && !['payment', 'poll', 'invoice', 'call', 'event'].includes(m.type) && !noForward(ch);
  const hooked = menuHooks.message.flatMap((h) => h(ch, m) || []);
  showMenu(anchor, [
    alive && { label: 'Reply', icon: 'reply', onClick: () => { ui.replyTo = mid; ui.editing = null; refresh(); focusInput(); } },
    alive && (m.text || m.caption) && m.type !== 'sticker' && !noForward(ch) && { label: 'Copy', icon: 'copy', onClick: () => copyText(m.text || m.caption || '') },
    fwdable && { label: 'Forward', icon: 'forward', onClick: () => act.forwardModal(m) },
    alive && { label: m.pinned ? 'Unpin' : 'Pin', icon: 'pin', onClick: () => togglePin(m) },
    alive && { label: m.starred ? 'Unstar' : 'Star', icon: 'star', onClick: () => toggleStar(m) },
    alive && m.tr && { label: ch.translate ? 'Hide translation' : 'Translate', icon: 'translate', onClick: () => toggleTranslate(ch) },
    alive && out && m.type === 'text' && Date.now() - m.t < 15 * MIN && { label: 'Edit', icon: 'edit', onClick: () => { ui.editing = mid; ui.replyTo = null; setInput(m.text || ''); refresh(); focusInput(); } },
    ...(alive ? hooked : []),
    alive && m.type === 'image' && { label: 'Enhance with AI', icon: 'sparkle', onClick: () => enhanceImage(ch, m) },
    alive && !out && m.from !== 'system' && { label: 'Report', icon: 'warning', onClick: () => reportMessage(ch, m) },
    { label: 'Delete', icon: 'delete', danger: true, onClick: () => deleteMsgModal(ch, m) },
  ] as Item[], {
    alignLeft: !out,
    header: alive ? <div className="react-row">{REACTS.map((e) => <button key={e} data-react={e} className={(m.reactions?.[e] || []).includes('me') ? 'on' : ''} aria-label={`React ${e}`}>{e}</button>)}</div> : undefined,
    onReact: (e) => react(ch, m, e),
  });
}

export function deleteMsgModal(ch: Chat, m: Message) {
  const acts: { label: string; danger?: boolean; onClick?: () => void }[] = [{ label: 'Cancel' }];
  const canEveryone = m.from === 'me' && m.type !== 'deleted' && (!ch.cloud || (m.status !== 'sent' && !m.uploading && !m.localOnly));
  if (canEveryone) acts.push({
    label: 'Delete for everyone', danger: true, onClick: () => {
      if (fire('deleteForEveryone', ch, m)) return;
      const keep = { id: m.id, from: m.from, t: m.t, status: m.status };
      Object.keys(m).forEach((k) => delete m[k]);
      Object.assign(m, keep, { type: 'deleted', reactions: {} });
      commit();
    },
  });
  acts.push({ label: 'Delete for me', danger: true, onClick: () => { ch.messages = ch.messages.filter((x) => x !== m); commit(); } });
  modal({ title: 'Delete message?', body: <p className="muted">{preview(m).slice(0, 120)}</p>, actions: acts });
}

export function reactInfoModal(ch: Chat, m: Message) {
  const un = (e: string) => { react(ch, m, e); closeModal(); };
  modal({
    title: 'Reactions',
    body: <>{Object.entries(m.reactions || {}).flatMap(([e, who]) => who.map((w) => (
      <div key={e + w} className="set-row plain"><Avatar o={w === 'me' ? S.me : contact(w)} size={36} /><div className="grow">{senderName(w)}{w === 'me' ? <div className="ci-sub">Click to remove</div> : null}</div>
        <span className="big-emoji" data-unreact={w === 'me' ? e : undefined} onClick={w === 'me' ? () => un(e) : undefined}>{e}</span></div>
    )))}</>,
  });
}

// ---------- header ⋮ menu (js/overlays.js headMenu + js/privacy.js extraHeadItems + other areas)
export function headMenu(anchor: Anchor) {
  const ch = curChat();
  if (!ch) return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  showMenu(anchor, [
    { label: ch.type === 'group' ? 'Group info' : c?.business ? 'Business info' : 'Contact info', icon: 'info', onClick: () => openDrawer('info') },
    { label: 'Search', icon: 'search', onClick: openChatSearch },
    { label: 'AI summary', icon: 'sparkle', onClick: () => aiSummaryModal(ch) },
    ch.messages.some((m) => m.tr) && { label: ch.translate ? 'Hide translations' : 'Translate chat', icon: 'translate', onClick: () => toggleTranslate(ch) },
    c?.business && { label: 'View catalogue', icon: 'bag', onClick: () => catalogModal(ch) },
    { label: 'Payments', icon: 'rupee', onClick: () => payModal(ch) },
    { label: 'Disappearing messages', icon: 'timer', onClick: () => act.disappearModal(ch) },
    { label: ch.locked ? 'Unlock chat' : 'Lock chat', icon: 'lock', onClick: () => act.toggleLock(ch) },
    { label: 'Starred messages', icon: 'star', onClick: () => openDrawer('starred') },
    { label: ch.muted ? 'Unmute notifications' : 'Mute notifications', icon: 'mute', onClick: () => toggleMute(ch) },
    { label: ch.live ? 'Live translation · on' : 'Live translation', icon: 'translate', onClick: () => liveTranslateModal(ch) },
    { label: 'Chat privacy', icon: 'shield', onClick: () => chatPrivacyModal(ch) },
    c && !ch.secret && !c.business && { label: 'Start secret chat', icon: 'lock', onClick: () => act.startSecretChat(c.id) },
    ...menuHooks.chatHead.flatMap((h) => h(ch) || []),
    '-',
    { label: 'Clear chat', icon: 'delete', onClick: () => act.clearChat(ch) },
    c && { label: c.blocked ? 'Unblock' : 'Block', icon: 'block', danger: true, onClick: () => act.toggleBlock(c) },
    c && { label: 'Report', icon: 'info', danger: true, onClick: () => reportModal(c) },
    ch.type === 'group' && !ch.left && { label: 'Exit group', icon: 'logout', danger: true, onClick: () => act.exitGroup(ch) },
  ] as Item[]);
}

// ---------- attach menu
export async function sendDocs(ch: Chat) {
  const files = await pickFile({ multiple: true });
  if (!files.length) return;
  act.sendFiles(ch, files);
}
export function attachMenu(anchor: Anchor) {
  const ch = curChat();
  if (!ch) return;
  showMenu(anchor, [
    { label: 'Document · any file type', icon: 'doc', color: '#7f66ff', onClick: () => sendDocs(ch) },
    { label: 'Create document', icon: 'edit', color: '#2b6fd6', onClick: () => act.openStudio({ ch, blank: true }) },
    { label: 'Request signature', icon: 'draw', color: '#5e35b1', onClick: () => act.signRequestModal(ch) },
    { label: 'Photos & videos', icon: 'image', color: '#007bfc', onClick: sendMedia },
    { label: 'Payment', icon: 'rupee', color: '#00a884', onClick: () => payModal(ch) },
    { label: 'Poll', icon: 'poll', color: '#ffbc38', onClick: () => pollModal(ch) },
    { label: 'Event', icon: 'event', color: '#ff2e74', onClick: () => eventModal(ch) },
    { label: 'Contact', icon: 'person', color: '#009de2', onClick: () => shareContactModal(ch) },
    { label: 'Location', icon: 'place', color: '#1fa855', onClick: () => locationModal(ch) },
    isBiz(ch) && { label: 'Catalogue', icon: 'bag', color: '#f4511e', onClick: () => catalogModal(ch) },
    { label: 'Schedule message', icon: 'timer', color: '#02a698', onClick: () => scheduleModal(ch) },
    ...menuHooks.attach.flatMap((h) => h(ch) || []),
  ] as Item[], { above: true, alignLeft: true, cls: 'attach' });
}

// ---------- AI writing assistant
export function aiWriteMenu(anchor: Anchor) {
  const text = composer.get().trim();
  const put = (t: string) => { setInput(t); focusInput(); };
  const apply = (fn: (s: string) => string, label: string) => { put(fn(text)); toast('✨ ' + label); };
  if (!text) {
    showMenu(anchor, AI_DRAFTS.map((d) => ({ label: d.length > 46 ? d.slice(0, 44) + '…' : d, icon: 'sparkle', onClick: () => put(d) })), { above: true, header: <div className="menu-title">✨ AI draft a message</div> });
    return;
  }
  showMenu(anchor, [
    { label: 'Fix grammar & spelling', icon: 'check', onClick: () => apply(AI.fix, 'Grammar fixed') },
    { label: 'Make it formal', icon: 'edit', onClick: () => apply(AI.formal, 'Rewritten formally') },
    { label: 'Make it casual', icon: 'emoji', onClick: () => apply(AI.casual, 'Rewritten casually') },
    { label: 'Make it shorter', icon: 'sparkle', onClick: () => apply(AI.shorter, 'Shortened') },
    { label: 'Add an emoji', icon: 'emoji', onClick: () => apply(AI.emoji, 'Emoji added') },
  ], { above: true, header: <div className="menu-title">✨ AI writing assistant</div> });
}
