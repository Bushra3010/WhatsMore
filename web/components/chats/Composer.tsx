'use client';
// Composer of the open chat: blocked/left/read-only notes, voice recording, reply/edit box, smart
// replies, emoji/GIF/sticker panel, AI writing button, send/mic, drafts, paste image (js/chat.js + js/main.js).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { S, ui, refresh } from '@/lib/state';
import type { Chat } from '@/lib/types';
import { contact, isAdmin, senderName, preview, fmtDur, DAY } from '@/lib/util';
import { act } from '@/lib/registry';
import { scamCheck } from '@/lib/scam';
import { Icon } from '@/components/Icon';
import { EMOJIS, GIFS, STICKERS, composer, sendText, sendQuick, smartReplies, startRecording, stopRecording, setEmojiTab, type Rec } from './core';
import { attachMenu, aiWriteMenu } from './menus';
import { pasteImage } from './modals';

function RecBar({ rec }: { rec: Rec }) {
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 250); return () => clearInterval(t); }, []);
  return (
    <footer className="composer rec">
      <button className="icon-btn" data-act="rec-cancel" title="Discard" aria-label="Discard recording" onClick={() => stopRecording(false)}><Icon name="delete" /></button>
      <span className="rec-dot" />
      {/* eslint-disable-next-line react-hooks/purity */}
      <span id="rec-time" className="rec-time">{fmtDur((Date.now() - rec.start) / 1000)}</span>
      <span className="rec-label">{rec.sim ? 'Recording (simulated — microphone unavailable)' : 'Recording…'}</span>
      <span className="grow" />
      <button className="icon-btn send-btn send" data-act="rec-send" aria-label="Send voice message" onClick={() => stopRecording(true)}><Icon name="send" /></button>
    </footer>
  );
}

function EmojiPanel({ insert }: { insert: (t: string) => void }) {
  const tab = ui.emojiTab;
  const setTab = setEmojiTab;
  let body;
  if (tab === 'emoji') body = Object.entries(EMOJIS).map(([k, list]) => <div key={k}><div className="ep-label">{k}</div><div className="ep-grid">{list.map((e) => <button key={e} data-act="emo" data-e={e} onClick={() => insert(e)}>{e}</button>)}</div></div>);
  else if (tab === 'gif') body = <div className="gif-grid">{GIFS.map((g, i) => <button key={i} className="gif" style={{ background: g.bg }} data-act="sendgif" data-i={i} onClick={() => sendQuick({ type: 'gif', gif: GIFS[i] })}><span className={`anim-${g.anim}`}>{g.e}</span><b>{g.label}</b></button>)}</div>;
  else body = <div className="ep-grid stickers">{STICKERS.map((e) => <button key={e} data-act="sticker" data-e={e} onClick={() => sendQuick({ type: 'sticker', text: e })}>{e}</button>)}</div>;
  return (
    <>
      <div className="ep-tabs">{([['emoji', 'Emoji'], ['gif', 'GIFs'], ['sticker', 'Stickers']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} data-act="emojitab" data-t={k} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="ep-body">{body}</div>
    </>
  );
}

export function Composer({ ch }: { ch: Chat }) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  const [text, setText] = useState(() => ui.draft[ch.id] || '');
  const ta = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    composer.set = (t: string) => { ui.draft[ch.id] = t; setText(t); caret.current = t.length; };
    composer.get = () => ta.current?.value ?? ui.draft[ch.id] ?? '';
    composer.focus = () => { const el = ta.current; if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; } };
    return () => {
      composer.set = (t: string) => { if (ui.active) ui.draft[ui.active] = t; };
      composer.get = () => (ui.active ? ui.draft[ui.active] || '' : '');
      composer.focus = () => {};
    };
  }, [ch.id]);
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    if (caret.current != null) { el.selectionStart = el.selectionEnd = caret.current; caret.current = null; }
  });

  if (c?.blocked) return <div className="composer-note" data-act="unblock" onClick={() => act.toggleBlock(c)}>You blocked this contact. <b className="accent">Tap to unblock.</b></div>;
  if (ch.left) return <div className="composer-note">You can&apos;t send messages to this group because you&apos;re no longer a member.</div>;
  if (ch.readOnly && !isAdmin(ch)) return <div className="composer-note"><Icon name="megaphone" size={18} /> Only admins can send messages</div>;
  const rec = ui.rec as Rec | null;
  if (rec?.ready) return <RecBar rec={rec} />;

  const change = (v: string) => { ui.draft[ch.id] = v; setText(v); };
  const insert = (t: string) => {
    const el = ta.current;
    const s = el?.selectionStart ?? text.length, e = el?.selectionEnd ?? text.length;
    const v = text.slice(0, s) + t + text.slice(e);
    caret.current = s + t.length;
    change(v);
    el?.focus();
  };
  const send = () => sendText(ta.current?.value ?? text);
  const has = text.trim().length > 0;

  // reply / edit box
  const id = ui.editing || ui.replyTo, rm = id ? ch.messages.find((x) => x.id === id) : undefined;
  const color = rm ? (rm.from === 'me' ? 'var(--accent)' : contact(rm.from)?.color || '#06cf9c') : '';
  const cancelReply = () => { ui.replyTo = null; if (ui.editing) { ui.editing = null; change(''); } refresh(); };

  // smart replies
  const last = [...ch.messages].reverse().find((m) => m.type !== 'system');
  // eslint-disable-next-line react-hooks/purity
  const showSmart = !!last && last.from !== 'me' && last.type !== 'deleted' && !(last.type === 'text' && scamCheck(last.text).length) && !ui.editing && !has && Date.now() - last.t <= 3 * DAY;

  return (
    <>
      <div id="reply-box">{rm ? (
        <div className="reply-box"><div className="quote" style={{ ['--qc' as string]: ui.editing ? 'var(--accent)' : color }}><div className="q-main"><div className="q-name">{ui.editing ? 'Editing message' : 'Replying to ' + senderName(rm.from)}</div><div className="q-text">{preview(rm)}</div></div></div>
          <button className="icon-btn sm" data-act="cancelreply" aria-label="Cancel" onClick={cancelReply}><Icon name="close" size={20} /></button></div>
      ) : null}</div>
      <div id="smart" className="smart">{showSmart && last ? (
        <><span className="smart-label"><Icon name="sparkle" size={14} /></span>{smartReplies(last).map((s) => <button key={s} data-act="smart" data-text={s} onClick={() => sendQuick({ type: 'text', text: s })}>{s}</button>)}</>
      ) : null}</div>
      <div id="emoji-panel" className="emoji-panel" hidden={!ui.emojiOpen}>{ui.emojiOpen ? <EmojiPanel insert={insert} /> : null}</div>
      <footer className="composer">
        <button className={`icon-btn ${ui.emojiOpen ? 'on' : ''}`} data-act="emoji" title="Emoji, GIFs & stickers" aria-label="Emoji" onClick={() => { ui.emojiOpen = !ui.emojiOpen; refresh(); if (!ui.emojiOpen) ta.current?.focus(); }}><Icon name={ui.emojiOpen ? 'close' : 'emoji'} /></button>
        <button className="icon-btn" data-act="attach" title="Attach" aria-label="Attach" onClick={(e) => attachMenu(e.currentTarget)}><Icon name="add" /></button>
        <div className="input-wrap">
          <textarea id="input" ref={ta} rows={1} placeholder="Type a message" aria-label="Message" value={text}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && S.settings.enterSend && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            onPaste={(e) => { const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/')); if (!file) return; e.preventDefault(); pasteImage(ch, file); }} />
          <button className="icon-btn sm ai-btn" data-act="aiwrite" title="AI writing assistant" aria-label="AI writing assistant" onClick={(e) => aiWriteMenu(e.currentTarget)}><Icon name="sparkle" size={20} /></button>
        </div>
        <button className={`icon-btn send-btn ${has ? 'send' : ''}`} id="send-btn" data-act="sendormic" aria-label={has ? 'Send' : 'Record voice message'} onClick={() => { if (has) send(); else startRecording(); }}><Icon name={has ? 'send' : 'mic'} /></button>
      </footer>
    </>
  );
}
