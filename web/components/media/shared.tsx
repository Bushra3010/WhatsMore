'use client';
// Shared helpers for the media area: a re-render store for transient overlay state (story, call,
// lightbox), safe optional cross-area calls, location, and the people / chat pickers.
import { useState } from 'react';
import { create } from 'zustand';
import { S } from '@/lib/state';
import { act } from '@/lib/registry';
import { toast, modal } from '@/lib/overlay';
import { findPeople, chatTitle, isAdmin, lastTime, chatById } from '@/lib/util';
import type { Chat, Dict, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar } from '@/components/ui/Avatar';
import type { StoryOwner } from './hooks';

export interface StoryState { owners: StoryOwner[]; oi: number; ii: number; gen: number; paused?: boolean }

/** Transient media state (kept out of S, like ui.story / ui.call / the lightbox in the original). */
export const M: { story: StoryState | null; call: Dict | null; lightbox: Message | null; cwDone: boolean } = {
  story: null, call: null, lightbox: null, cwDone: false,
};

const useMediaRev = create<{ rev: number }>(() => ({ rev: 0 }));
export const bump = () => useMediaRev.setState((s) => ({ rev: s.rev + 1 }));
export const useMedia = () => useMediaRev((s) => s.rev);

export const nowMs = () => Date.now();
/** True when an action is registered by another area (without triggering the "still loading" toast). */
export const has = (name: string) => Object.prototype.hasOwnProperty.call(act, name);
export const liveOn = () => has('liveIsSignedIn') && act.liveIsSignedIn() === true;
export function logNotif(cat: string, title: string, text: string) { if (has('logNotif')) act.logNotif(cat, title, text); }

export function getPosition(): Promise<{ lat: number; lng: number; acc: number; demo?: boolean }> {
  return new Promise((res) => {
    const demo = () => res({ lat: 17.4401, lng: 78.3489, acc: 20, demo: true });
    if (!navigator.geolocation) return demo();
    const t = setTimeout(demo, 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); },
      () => { clearTimeout(t); toast('Location unavailable · sending a demo location'); demo(); },
      { timeout: 5500, maximumAge: 60000 },
    );
  });
}

const PICK_PAGE = 60;
/** Searchable people list with checkboxes (peoplePickerHTML). */
export function PeopleList({ q, picked, exclude = [], attr, onToggle }: { q: string; picked: Set<string>; exclude?: string[]; attr: string; onToggle: (id: string, on: boolean) => void }) {
  const list = findPeople(q, exclude);
  const shown = list.slice(0, PICK_PAGE);
  if (!list.length) return <div className="empty-list small">No one found{q ? ` for “${q}”` : ''}.</div>;
  return (
    <>
      {shown.map((c) => (
        <label key={c.id} className="chat-item check-row">
          <Avatar o={c} size={40} />
          <div className="ci-body"><div className="ci-name">{c.name}{c.isContact ? '' : <> <span className="pill">On WHATSMORE</span></>}</div><div className="ci-preview">@{c.username}</div></div>
          <input type="checkbox" className="check" {...{ [attr]: c.id }} defaultChecked={picked.has(c.id)} onChange={(e) => onToggle(c.id, e.target.checked)} />
        </label>
      ))}
      {list.length > shown.length ? <div className="empty-list small">Showing {shown.length} of {list.length.toLocaleString()} — search by name or @username to find more.</div> : null}
    </>
  );
}

/** Pick one or more chats (chatPicker in js/features.js). */
export function chatPicker(title: string, cb: (chats: Chat[]) => boolean | void, opts: { single?: boolean; label?: string } = {}) {
  const chats = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  function Body() {
    const [q, setQ] = useState('');
    return (
      <>
        <div className="search modal-search"><Icon name="search" size={18} /><input id="pk-q" placeholder="Search chats" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="pick-list">
          {chats.map((c) => (
            <label key={c.id} className="chat-item check-row" data-name={chatTitle(c).toLowerCase()} hidden={!chatTitle(c).toLowerCase().includes(q.toLowerCase())}>
              <ChatAvatar ch={c} size={40} />
              <div className="ci-body"><div className="ci-name">{chatTitle(c)}</div></div>
              <input type={opts.single ? 'radio' : 'checkbox'} name="pk" className="check" value={c.id} />
            </label>
          ))}
        </div>
      </>
    );
  }
  modal({
    title,
    body: <Body />,
    actions: [{ label: 'Cancel' }, {
      label: opts.label || 'Send', primary: true, onClick: (root) => {
        const ids = [...root.querySelectorAll<HTMLInputElement>('input[name=pk]:checked')].map((i) => i.value);
        if (!ids.length) { toast('Select at least one chat'); return false; }
        if (cb(ids.map((id) => chatById(id)).filter(Boolean) as Chat[]) === false) return false;
      },
    }],
  });
}

