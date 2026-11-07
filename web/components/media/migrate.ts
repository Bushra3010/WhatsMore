'use client';
// Demo data added by js/cloudplus.js `migrate` (S.x3): documents and photos for the smart folders, links,
// a voice status from Siva, separate-profile demo chats and the backup record. Idempotent.
import { S, save } from '@/lib/state';
import { uid, MIN, HOUR, DAY, contact, chatById } from '@/lib/util';
import type { Message } from '@/lib/types';

export function migrateMedia() {
  if (S.x3) return;
  const now = Date.now();
  const m = (from: string, extra: Partial<Message>): Message => ({ id: uid(), from, t: now - Math.floor(Math.random() * 5 * DAY) - HOUR, status: 'read', reactions: {}, type: 'text', ...extra });
  const push = (cid: string, msg: Message) => { const ch = chatById(cid); if (ch) { ch.messages.push(msg); ch.messages.sort((a, b) => a.t - b.t); } };
  push('ch_mom', m('c_mom', { type: 'doc', name: 'Aadhaar_Card_Mom.pdf', ext: 'pdf', size: 412000, pages: 1, caption: 'Keep a copy of my Aadhaar 🙏' }));
  push('ch_mom', m('c_mom', { type: 'doc', name: 'Electricity_Bill_Oct.pdf', ext: 'pdf', size: 96000, pages: 1 }));
  push('ch_family', m('c_ananya', { type: 'doc', name: 'Class10_Report_Card_Ananya.pdf', ext: 'pdf', size: 288000, pages: 3 }));
  push('ch_family', m('c_siva', { type: 'image', art: { emoji: '🍛', bg: 'linear-gradient(135deg,#f6d365,#fda085)' }, caption: 'Family dinner last night ❤️' }));
  push('ch_family', m('c_mom', { type: 'image', art: { emoji: '🎂', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)' }, caption: "Siva's birthday party 🎉" }));
  push('ch_siva', m('c_siva', { type: 'doc', name: 'PAN_Card_Siva.pdf', ext: 'pdf', size: 204000, pages: 1, caption: 'For the company registration' }));
  push('ch_siva', m('c_siva', { type: 'doc', name: 'WHATSMORE_PRD_v2.pdf', ext: 'pdf', size: 1240000, pages: 18, forwarded: true }));
  push('ch_siva', m('c_siva', { type: 'text', text: 'Design files are here: https://figma.com/whatsmore-design and the roadmap https://whatsmore.app/roadmap' }));
  // Separate profiles have their own chats
  const mkC = (id: string, name: string, username: string, color: string, about: string) => { if (!contact(id)) S.contacts.push({ id, name, username, color, about, isContact: false, online: true }); };
  mkC('p_kavya', 'Kavya Iyer', 'kavya.iyer', '#00897b', 'Café owner');
  mkC('p_imran', 'Imran Khan', 'imran.k', '#6d4c41', 'Startup founder');
  mkC('p_nisha', 'Nisha (subscriber)', 'nisha.designs', '#8e24aa', 'Design student');
  const enc = (t: number): Message => ({ id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' });
  const chat = (id: string, cid: string, profile: string, msgs: Message[]) => { if (!chatById(id)) S.chats.push({ id, type: 'direct', contactId: cid, profile, unread: 1, messages: [enc(now - 2 * DAY), ...msgs] }); };
  chat('ch_cust1', 'p_kavya', 'business', [m('p_kavya', { type: 'text', text: 'Hi! How much is a logo design for my café? ☕', t: now - 40 * MIN })]);
  chat('ch_cust2', 'p_imran', 'business', [m('p_imran', { type: 'text', text: 'Order ORD-2300 received, thanks. When will the UI kit be delivered?', t: now - 3 * HOUR })]);
  chat('ch_fan1', 'p_nisha', 'creator', [m('p_nisha', { type: 'text', text: 'Loved your “10 UI tricks” video! Will you do a live Q&A on Figma? 🙌', t: now - 2 * HOUR })]);
  ['ch_family', 'ch_mom'].forEach((id) => { const c = chatById(id); if (c) c.profile = 'family'; });
  // A voice status from Siva
  const sv = S.statuses.find((s) => s.contactId === 'c_siva');
  if (sv && !sv.items.some((i: { type: string }) => i.type === 'voice')) sv.items.push({ type: 'voice', dur: 9, caption: 'Big news coming soon. WHATSMORE beta opens next week!', t: now - 30 * MIN });
  S.backup = S.backup || { last: now - 26 * HOUR, size: 0 };
  S.x3 = 1;
  save();
}
