'use client';
// Extension points. Each feature area registers its screens and actions here when its module loads
// (components/<area>/index.tsx), so areas don't import each other directly. The shell renders whatever
// is registered. Calling an action that no area has registered shows a toast instead of crashing.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react';
import type { Chat, Message } from './types';

type Fn = (...args: any[]) => any;

/** Sidebar content per rail tab (home, chats, status, calls, communities, files, ai, services, settings). */
export const tabs: Record<string, ComponentType> = {};
/** Sidebar pages opened on top of a tab: 'newchat', 'newgroup', 'archived', 'set-profile', … */
export const pages: Record<string, ComponentType> = {};
/** Main-area views (ui.view): 'mod:pay', 'ai', … */
export const views: Record<string, ComponentType> = {};
/** Main-area content when nothing else is open, per tab (e.g. the AI tab fills the main area). */
export const mains: Record<string, ComponentType> = {};
/** Drawer panels (ui.drawer): 'info', 'starred', … */
export const drawers: Record<string, ComponentType> = {};
/** Always-mounted overlays (call screen, story viewer, onboarding, document studio, banners). */
export const overlays: Record<string, ComponentType> = {};
/** Extra items for message menus, chat header menus, attach menu: (chat, message?) => items. */
export const menuHooks: Record<'message' | 'chatHead' | 'attach' | 'chatsMenu', ((ch: Chat, m?: Message) => any[])[]> = { message: [], chatHead: [], attach: [], chatsMenu: [] };
/** Extra content rendered inside a message bubble for a given type (e.g. 'doc', 'signreq', 'location'). */
export const messageRenderers: Record<string, ComponentType<{ ch: Chat; m: Message; q?: string | null }>> = {};
/** Bars shown above the messages of a chat (encryption, live translation, secret chat, live chat …). */
export const chatBars: ((ch: Chat) => any)[] = [];

/**
 * Cross-area actions. Areas assign real implementations at load; the defaults only explain that the
 * feature isn't loaded. Signatures follow the original app's functions of the same name.
 */
export const act: Record<string, Fn> & {
  startCall: (ch: Chat | null, video: boolean, opts?: { room?: string }) => any;
  openStatus: (idx: number) => void;
  openMyStatus: () => void;
  addStatusModal: () => void;
  openDocViewer: (m: Message, ch?: Chat) => void;
  openStudio: (opts: any) => void;
  signRequestModal: (ch: Chat) => void;
  openSignFlow: (ch: Chat, m: Message) => void;
  sendFiles: (ch: Chat, files: File[]) => void;
  payModal: (ch: Chat) => void;
  qrModal: () => void;
  scanModal: () => void;
  callLinkModal: () => void;
  startOnboarding: () => void;
  openAccountFlow: (step: string) => void;
  locationModal: (ch: Chat) => void;
  reportMessage: (ch: Chat, m: Message) => void;
  reportUser: (contactId: string) => void;
  translateMsgModal: (m: Message) => void;
  openView: (v: string) => void;
} = new Proxy({} as any, {
  get(target, key: string) {
    if (key in target) return target[key];
    return (...args: unknown[]) => {
      console.warn(`[registry] action "${key}" is not registered yet`, args);
      import('./overlay').then(({ toast }) => toast('This feature is still loading'));
    };
  },
});

export function register(impls: Partial<Record<string, Fn>>) { Object.assign(act, impls); }

/**
 * Named extension slots inside screens, filled by other areas (mostly the live layer):
 *   'settings.account'      – after the profile card on the Settings tab (sign in / signed-in row)
 *   'settings.profile'      – bottom of Settings → Profile (badge request when signed in)
 *   'settings.security'     – Settings → Account & security, before Active sessions
 *   'settings.data'         – Settings → Your data & privacy, extra rows
 *   'newchat.results'       – New chat page, above the contact list (live @username search)
 *   'status.extra'          – Status tab, before the hint box (close friends when signed in)
 *   'home.top'              – top of the Home tab
 *   'chat.composer'         – above the composer of an open chat
 *   'story.mine'            – after the views count of my own story in the viewer (props: { item })
 * Render with <Slot name="..." /> from components/ui/Slot.
 */
export const slots: Record<string, ComponentType<Record<string, unknown>>[]> = {};
export function addToSlot(name: string, c: ComponentType<Record<string, unknown>>) { (slots[name] ||= []).push(c); }
