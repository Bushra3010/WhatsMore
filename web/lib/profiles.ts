'use client';
// Multiple profiles with separate chats (Personal, Business, Creator, Family). Ported from js/modules.js + js/privacy.js.
import { S, ui, commit } from './state';
import { chatById } from './util';
import { toast } from './overlay';
import type { Chat } from './types';

export const PROFILES: Record<string, [string, string]> = { personal: ['Personal', '👤'], business: ['Business', '💼'], creator: ['Creator', '🎙️'], family: ['Family', '🏡'] };
export const profileOf = (c: Chat) => c.profile || 'personal';
export function profileMatch(c: Chat) {
  const p = S.settings.profile || 'personal';
  return p === 'personal' ? !['business', 'creator'].includes(profileOf(c)) : profileOf(c) === p;
}
export function switchProfile(k: string) {
  S.settings.profile = k;
  const ch = chatById(ui.active);
  if (ch && !profileMatch(ch)) { ui.active = null; ui.drawer = null; }
  commit();
  toast(`${PROFILES[k][1]} Switched to ${PROFILES[k][0]} profile — its own notifications, privacy and status`);
}
