'use client';
// Shared helpers of the settings area.
import { S } from '@/lib/state';
import { allUsernames, PLANS } from '@/lib/util';

/** Local username check (settings.js checkUsername): ['ok' | 'bad', message]. */
export function checkUsername(v: string): ['ok' | 'bad', string] {
  if (v === S.me.username) return ['ok', `✓ @${v} is yours`];
  if (!/^[a-z0-9._]{3,24}$/.test(v)) return ['bad', 'Use 3–24 lowercase letters, numbers, dots or underscores'];
  if (allUsernames().includes(v)) return ['bad', `✗ @${v} is already taken`];
  return ['ok', `✓ @${v} is available`];
}

/** Defaults added by later versions of the original app (ensureV5 in superapp.js). Idempotent. */
export function ensureSettings() {
  const st = S.settings;
  st.privacy ||= {};
  Object.assign(st.privacy, { canMessage: st.privacy.canMessage || 'everyone', canCall: st.privacy.canCall || 'contacts', canAddGroups: st.privacy.canAddGroups || 'contacts' });
  st.perms ||= { ai: true, location: false, contacts: true, camera: true, mic: true, cloud: true };
  st.devices ||= { syncHistory: true, biometricLink: false };
  st.aiPerms ||= { chats: true, files: true, location: false, contacts: true };
  st.notify ||= {};
  st.sessions ||= [];
  S.reports ||= [];
  S.devices ||= [];
  if (!PLANS[st.plan]) st.plan = 'free';
}

