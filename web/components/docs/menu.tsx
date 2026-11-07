'use client';
// Extra message-menu items (extraMsgItems in js/docs.js): documents, voice notes and text messages.
import { fileType } from '@/lib/util';
import { act } from '@/lib/registry';
import { readAloud } from '@/lib/translate';
import { scamCheck } from '@/lib/scam';
import type { MenuItem } from '@/lib/overlay';
import type { Chat, Message } from '@/lib/types';
import { NOT_EDITABLE_MENU } from './lib';
import { openDocViewer } from './viewer';
import { openStudio } from './studio';
import { signCertModal } from './signature';

export function extraMsgItems(ch: Chat, m?: Message): MenuItem[] {
  if (!m || m.type === 'deleted') return [];
  const items: MenuItem[] = [];
  if (m.type === 'doc') {
    items.push({ label: 'Open', icon: 'doc', onClick: () => openDocViewer(m, ch) });
    if (!NOT_EDITABLE_MENU.includes(fileType(m.ext).kind)) {
      items.push({ label: 'Edit & AI-correct', icon: 'spell', onClick: () => openStudio({ ch, src: m }) });
      items.push({ label: 'Sign document', icon: 'draw', onClick: () => openStudio({ ch, src: m, sign: true }) });
    }
    if (m.signed) items.push({ label: 'Signature certificate', icon: 'verified', onClick: () => signCertModal(m) });
  }
  if (m.type === 'voice') items.push({ label: m.transcript ? 'Hide transcript' : 'Transcribe & summarize', icon: 'sparkle', onClick: () => act.transcribeVoice(ch, m) });
  if (m.type === 'text') {
    items.push({ label: 'Read aloud', icon: 'speaker', onClick: () => readAloud(m.tr || m.text || '') });
    items.push({ label: 'Translate to…', icon: 'translate', onClick: () => act.translateMsgModal(m) });
    if (m.from !== 'me' && scamCheck(m.text).length) items.push({ label: 'Report scam', icon: 'warning', onClick: () => act.reportScam(ch, m) });
  }
  return items;
}
