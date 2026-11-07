'use client';
// Universal chat import from an exported .txt (only from apps that offer a legitimate export). js/modules.js.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { S, ui, commit } from '@/lib/state';
import { toast, pickFile } from '@/lib/overlay';
import { openChat } from '@/lib/actions';
import { uid, pick, COLORS } from '@/lib/util';
import type { Chat } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Note } from '@/components/ui/Bits';
import { modalWith } from './shared';

const SAMPLE_EXPORT = `12/09/26, 9:14 am - Ravi Teja: Good morning team! Meeting at 11?
12/09/26, 9:15 am - Lakshmi: Yes, I'll share the slides before that
12/09/26, 9:20 am - {ME}: Works for me 👍
12/09/26, 10:02 am - Ravi Teja: Decided: we launch the beta on Monday 🚀
12/09/26, 10:05 am - Lakshmi: Please review the checklist by tonight
12/09/26, 10:06 am - {ME}: On it!`;

export function parseExport(text: string) {
  const re = /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?\]?\s*[-–]?\s*([^:]{1,40}):\s(.*)$/i;
  const out: { who: string; text: string; t: number }[] = [];
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(re);
    if (m) {
      const [, d, mo, yy, hh, mi, ap, who, msg] = m;
      const y = +yy < 100 ? 2000 + +yy : +yy;
      let hr = +hh;
      if (ap) { const pm = /p/i.test(ap); if (pm && hr < 12) hr += 12; if (!pm && hr === 12) hr = 0; }
      out.push({ who: who.trim(), text: msg, t: new Date(y, +mo - 1, +d, hr, +mi).getTime() || Date.now() });
    } else if (out.length && line.trim()) out[out.length - 1].text += '\n' + line;
  });
  return out;
}

function ImportBody({ close }: { close: () => void }) {
  const [found, setFound] = useState<{ msgs: ReturnType<typeof parseExport>; fname: string } | null | 'none'>(null);
  const [me, setMe] = useState('');
  const [name, setName] = useState('');
  const show = (text: string, fname: string) => {
    const msgs = parseExport(text);
    if (!msgs.length) { setFound('none'); return; }
    const people = [...new Set(msgs.map((m) => m.who))];
    setFound({ msgs, fname });
    setMe(people.includes(S.me.name) ? S.me.name : people[0]);
    setName(fname);
  };
  const go = () => {
    if (!found || found === 'none') return;
    const { msgs } = found;
    const people = [...new Set(msgs.map((m) => m.who))];
    const ids: Record<string, string> = {};
    people.filter((p) => p !== me).forEach((p) => { const c = { id: 'i_' + uid(), name: p, username: p.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + Math.floor(Math.random() * 90 + 10), color: pick(COLORS), isContact: false }; S.contacts.push(c); ids[p] = c.id; });
    const others = Object.values(ids), t0 = msgs[0].t;
    const base: any = { id: 'ch_' + uid(), unread: 0, imported: true, messages: [{ id: uid(), type: 'system', from: 'system', t: t0 - 1, text: `Imported ${msgs.length} messages from an exported chat · now end-to-end encrypted on WHATSMORE` }, ...msgs.map((m) => ({ id: uid(), from: m.who === me ? 'me' : ids[m.who], type: 'text', text: m.text, t: m.t, status: 'read', reactions: {} }))] };
    const ch: Chat = others.length === 1 ? { ...base, type: 'direct', contactId: others[0] } : { ...base, type: 'group', name: name.trim() || 'Imported chat', emoji: '📥', color: '#5e35b1', members: others, admins: ['me'], description: 'Imported chat history' };
    S.chats.push(ch); commit(); close();
    ui.tab = 'chats'; ui.page = null;
    openChat(ch.id);
    toast(`📥 Imported ${msgs.length} messages`);
  };
  const people = found && found !== 'none' ? [...new Set(found.msgs.map((m) => m.who))] : [];
  return (
    <>
      <p className="muted">Bring your history from any app that lets you <b>export</b> a chat (for example “Export chat” → .txt). WHATSMORE only imports files you are allowed to export — it never bypasses another app&apos;s security or encryption.</p>
      <div className="btn-row left">
        <button className="btn" id="im-file" onClick={async () => { const f = (await pickFile())[0]; if (f) show(await f.text(), f.name.replace(/\.[^.]+$/, '')); }}><Icon name="upload" size={16} /> Choose export file (.txt)</button>
        <button className="btn" id="im-sample" onClick={() => show(SAMPLE_EXPORT.replace(/\{ME\}/g, S.me.name), 'Team Alpha (imported)')}>Try a sample export</button>
      </div>
      <div id="im-out">
        {found === 'none' ? <Note>No messages found. Use the plain-text export (without media) from your other app.</Note> : found ? (
          <>
            <div className="list-label pad0">Found {found.msgs.length} messages from {people.length} people</div>
            <label className="field"><span>Which one is you?</span><select id="im-me" value={me} onChange={(e) => setMe(e.target.value)}>{people.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="field"><span>Chat name</span><input id="im-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn primary" id="im-go" onClick={go}>Import</button>
          </>
        ) : null}
      </div>
    </>
  );
}

export function importChatModal() {
  modalWith({ title: 'Import chats', actions: [{ label: 'Close' }] }, (close) => <ImportBody close={close} />);
}
