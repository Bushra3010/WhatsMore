'use client';
// Application state. The domain logic keeps one mutable state object `S` (as before) and transient
// UI state `ui`; every change ends with `commit()` (saved + re-render) or `refresh()` (re-render only).
// React components call `useRender()` to re-render when either changes.
import { create } from 'zustand';
import { makeSeed } from './seed';
import type { AppState, UIState } from './types';

// v2: no built-in demo data. Data saved by older versions (demo chats and people) is discarded.
export const KEY = 'whatsmore-next-v2';
const OLD_KEYS = ['whatsmore-next-v1'];

export function initialUI(): UIState {
  return {
    tab: 'chats', page: null, view: null, active: null, filter: 'all', search: '', ncQuery: '', ngName: '', ngQuery: '', ngPick: [], memQuery: '', memLimit: 20,
    replyTo: null, editing: null, chatSearch: null, searchIdx: 0, drawer: null, unlocked: [], typing: {}, emojiOpen: false, emojiTab: 'emoji',
    draft: {}, filesCat: 'all', filesQuery: '', blobs: [],
  };
}

// eslint-disable-next-line import/no-mutable-exports
export let S: AppState = makeSeed();
export const ui: UIState = initialUI();

const useRev = create<{ rev: number }>(() => ({ rev: 0 }));
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveWarned = false;

/** Re-render everything that uses `useRender()`. */
export function refresh() { useRev.setState((s) => ({ rev: s.rev + 1 })); }

/** Save state (debounced) and re-render. */
export function commit() { save(); refresh(); }

export function save() {
  if (typeof window === 'undefined') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveWarned = false; }
    catch {
      if (!saveWarned) { saveWarned = true; import('./overlay').then(({ toast }) => toast('Browser storage is full — large media may not survive a refresh')); }
    }
  }, 250);
}

/** Load saved state (client only). Returns true when saved data was found. */
export function load(): boolean {
  try { OLD_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.version === 2) { S = s; refresh(); return true; } }
  } catch { /* corrupted: start fresh */ }
  S = makeSeed();
  refresh();
  return false;
}

/** Replace the whole state (sign-out, clearing this device, tests). */
export function replaceState(next: AppState) { S = next; commit(); }

export function resetUI() { Object.assign(ui, initialUI()); refresh(); }

/** Subscribe a component to state + UI changes. */
export function useRender() { return useRev((s) => s.rev); }
