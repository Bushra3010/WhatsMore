'use client';
// Any file type: send files (with previews for text / images / PDF), My Cloud uploads and drag & drop
// onto the open chat. Ported from js/docs.js.
import { useEffect } from 'react';
import { S, ui, commit } from '@/lib/state';
import { uid, fileType, chatById } from '@/lib/util';
import { toast, pickFile, readDataURL } from '@/lib/overlay';
import { sendMsg, scheduleReply } from '@/lib/actions';
import type { Chat, Message } from '@/lib/types';
import { extOfName } from './lib';

export async function sendFiles(ch: Chat, files: File[]) {
  let last: Message | null = null;
  for (const f of files) {
    const ext = extOfName(f.name), t = fileType(ext);
    const url = URL.createObjectURL(f);
    ui.blobs.push(url);
    const m: Partial<Message> = { type: 'doc', name: f.name, size: f.size, ext, url };
    try {
      if (t.kind === 'text' && f.size < 300000) m.content = await f.text();
      else if ((t.kind === 'image' || ext === 'pdf') && f.size < 350000) m.data = await readDataURL(f);
    } catch {
      /* preview only */
    }
    last = sendMsg(ch, m) || last;
  }
  if (files.length > 1) toast(`Sent ${files.length} files`);
  if (last) scheduleReply(ch, last);
}

export function cloudChat(): Chat {
  let ch = chatById('ch_cloud');
  if (!ch) {
    ch = { id: 'ch_cloud', type: 'group', name: 'My Cloud ☁️', emoji: '☁️', color: '#0288d1', members: [], admins: ['me'], self: true, unread: 0, description: 'Only you · files saved here sync to all your linked devices', messages: [{ id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'Files you save here are end-to-end encrypted and synced to your linked devices.' }] };
    S.chats.push(ch);
  }
  return ch;
}

/** Files tab → upload (data-act="cloudupload"). */
export async function cloudUpload() {
  const files = await pickFile({ multiple: true });
  if (!files.length) return;
  await sendFiles(cloudChat(), files);
  toast(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''} to WHATSMORE Cloud`);
  commit();
}

/** Always mounted: drag & drop any file onto the open chat. */
export function DropZone() {
  useEffect(() => {
    const main = () => document.getElementById('main');
    const over = (e: DragEvent) => {
      if (!ui.active || !e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      main()?.classList.add('dropping');
    };
    const leave = (e: DragEvent) => {
      const m = main();
      if (m && (!e.relatedTarget || !m.contains(e.relatedTarget as Node))) m.classList.remove('dropping');
    };
    const drop = (e: DragEvent) => {
      main()?.classList.remove('dropping');
      if (!ui.active || !e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const ch = chatById(ui.active);
      if (ch) sendFiles(ch, [...e.dataTransfer.files]);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('dragleave', leave);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('drop', drop);
    };
  }, []);
  return null;
}
