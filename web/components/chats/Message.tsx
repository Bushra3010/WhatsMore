'use client';
// One message row and every message type (js/chat.js msgHTML/contentHTML + layers from js/devices.js,
// js/privacy.js, js/superapp.js). Other areas can render a type via messageRenderers (doc, signreq …).
import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import { S, ui } from '@/lib/state';
import type { Chat, Message } from '@/lib/types';
import { toast } from '@/lib/overlay';
import { contact, person, senderName, preview, fmtTime, fmtDur, fmtSize, money, productById, isJumbo, hash, fmtText, LANGS, fileType, isBiz } from '@/lib/util';
import { startDM, openChat } from '@/lib/actions';
import { act, messageRenderers } from '@/lib/registry';
import { scamCheck } from '@/lib/scam';
import { langName, translateSentences, normPhrase } from '@/lib/translate';
import { Icon } from '@/components/Icon';
import { Avatar, DocIcon } from '@/components/ui/Avatar';
import { voice, subscribeVoice, playVoice, vote, toggleGoing, toggleRemind, payDecline, stopLive, markSafe, downloadInvoice, jumpTo } from './core';
import { payRequest, reportScam, catalogModal, confirmSuspiciousLink } from './modals';
import { msgMenu, reactInfoModal } from './menus';

const Spacer = () => <span className="meta-spacer" />;
const Html = ({ html }: { html: string }) => <span dangerouslySetInnerHTML={{ __html: html }} />;

export function Ticks({ st }: { st?: string }) {
  if (st === 'failed') return <span className="tick failed" title="Not sent"><Icon name="warning" size={15} /></span>;
  if (st === 'read') return <span className="tick read"><Icon name="doneall" size={16} /></span>;
  if (st === 'delivered') return <span className="tick"><Icon name="doneall" size={16} /></span>;
  return <span className="tick"><Icon name="check" size={16} /></span>;
}

const qc = (c: string) => ({ ['--qc' as string]: c });
function Quote({ q }: { q: Message }) {
  const color = q.from === 'me' ? 'var(--accent)' : contact(q.from)?.color || '#06cf9c';
  let thumb: ReactNode = null;
  // eslint-disable-next-line @next/next/no-img-element
  if (q.type === 'image') thumb = q.src ? <img className="q-thumb" src={q.src} alt="" /> : <div className="q-thumb" style={{ background: q.art?.bg }}>{q.art?.emoji}</div>;
  return (
    <div className="quote" data-act="quote" data-mid={q.id} style={qc(color)} onClick={() => jumpTo(q.id)}>
      <div className="q-main"><div className="q-name">{senderName(q.from)}</div><div className="q-text">{preview(q)}</div></div>{thumb}
    </div>
  );
}

function LiveTr({ ch, m }: { ch: Chat; m: Message }) {
  if (!ch.live || m.type !== 'text') return null;
  if (m.liveOuts?.length) return <span className="tr live"><span className="tr-label"><Icon name="translate" size={12} /> Members read it in their language</span>{m.liveOuts.map((o: { lang: string; text: string }, i: number) => <span key={i} className="lt-line"><b>{langName(o.lang)}:</b> {o.text}</span>)}</span>;
  if (m.liveOut) return <span className="tr live"><span className="tr-label"><Icon name="translate" size={12} /> They read it in {langName(m.liveOut.lang)}</span>{m.liveOut.text}</span>;
  if (m.from === 'me' || (m.tr && (ch.translate || S.settings.autoTranslate))) return null;
  const r = translateSentences(m.text || '', ch.live.my);
  if (!r || normPhrase(r) === normPhrase(m.text || '')) return null;
  return <span className="tr live"><span className="tr-label"><Icon name="translate" size={12} /> In {langName(ch.live.my)}</span>{r}</span>;
}

function ScamWarn({ ch, m }: { ch: Chat; m: Message }) {
  if (m.safe) return null;
  const r = scamCheck(m.text);
  if (!r.length) return null;
  return (
    <div className="scam-warn"><div className="sw-head"><Icon name="warning" size={16} /> Potentially suspicious message</div><ul>{r.map((x) => <li key={x}>{x}</li>)}</ul>
      <div className="ci-sub">This message has signs often seen in scams. Review carefully before clicking links or sending money.</div>
      <div className="sw-acts"><button className="link-btn" data-act="scam-report" data-mid={m.id} onClick={() => reportScam(ch, m)}>Report &amp; block</button><button className="link-btn" data-act="scam-safe" data-mid={m.id} onClick={() => markSafe(m)}>It&apos;s safe</button></div></div>
  );
}

function Voice({ m }: { m: Message }) {
  useSyncExternalStore(subscribeVoice, () => voice.ver, () => 0);
  const p = voice.playing;
  const on = !!p && p.id === m.id;
  const frac = on ? Math.min(1, p!.pos / (p!.dur || 1)) : 0;
  const bars = Array.from({ length: 30 }, (_, i) => 5 + (hash(m.id + ':' + i) % 19));
  const who = m.from === 'me' ? S.me : contact(m.from);
  return (
    <div className="voice" data-act="playvoice" data-mid={m.id} onClick={() => playVoice(m.id)}>
      <div className="vav"><Avatar o={who} size={46} /><span className={`vmic ${m.played || m.from === 'me' ? 'played' : ''}`}><Icon name="mic" size={16} /></span></div>
      <button className="vplay" aria-label="Play voice message"><Icon name={on && !p!.paused ? 'pause' : 'play'} size={30} /></button>
      <div className="vbody"><div className="vwave">{bars.map((h, i) => <i key={i} style={{ height: h }} className={on && i / bars.length < frac ? 'on' : undefined} />)}</div><span className="vdur" data-dur={m.dur}>{fmtDur(on ? p!.pos : m.dur)}</span></div>
    </div>
  );
}

function Pay({ ch, m }: { ch: Chat; m: Message }) {
  const out = m.from === 'me', req = m.kind === 'request';
  const paidBy: string[] = m.paidBy || [];
  let status: string;
  if (m.status === 'declined') status = 'Declined';
  else if (req && m.split && ch.type === 'group') status = `${paidBy.length}/${m.split.people} paid${m.status === 'paid' ? ' · Completed' : ''}`;
  else if (m.status === 'paid') status = req ? 'Paid' : out ? 'Sent' : 'Received';
  else status = req ? (out ? 'Waiting for payment' : 'Requested from you') : 'Processing';
  const canPay = req && !out && m.status === 'pending' && !paidBy.includes('me');
  return (
    <>
      <div className={`pay-card ${m.status}`}><div className="pay-head"><Icon name="rupee" size={16} /><span>{req ? 'Payment request' : 'Payment'}{m.split ? ' · Split bill' : ''}</span></div>
        <div className="pay-amount">{money(m.amount)}</div>
        {m.split ? <div className="ci-sub">{out ? 'Each' : 'Your'} share of {money(m.split.total)} · {m.split.people} people</div> : null}
        {m.note ? <div className="pay-note">{m.note}</div> : null}
        <div className="pay-status">{m.status === 'paid' ? <Icon name="check" size={14} /> : null}{status}</div>
        {canPay ? <div className="pay-actions">{ch.type === 'direct' && !m.orderId ? <button className="btn sm" data-act="pay-decline" data-mid={m.id} onClick={() => payDecline(ch, m)}>Decline</button> : null}<button className="btn sm primary" data-act="pay" data-mid={m.id} onClick={() => payRequest(ch, m)}>Pay {money(m.amount)}</button></div> : null}
      </div><Spacer />
    </>
  );
}

function Poll({ ch, m }: { ch: Chat; m: Message }) {
  const votes: Record<string, string[]> = m.votes || {};
  const voters = new Set(Object.values(votes).flat()).size;
  return (
    <div className="poll"><div className="poll-q">{m.question}</div><div className="poll-hint"><Icon name="poll" size={14} /> {m.multi ? 'Select one or more' : 'Select one'}</div>
      {(m.options as string[]).map((o, i) => {
        const v = votes[i] || []; const mine = v.includes('me');
        return (
          <button key={i} className="poll-opt" data-act="vote" data-mid={m.id} data-opt={i} onClick={() => vote(ch, m, i)}>
            <span className={`poll-check ${mine ? 'on' : ''}`}>{mine ? <Icon name="check" size={14} /> : null}</span>
            <div className="poll-main"><div className="poll-row"><span>{o}</span><span className="poll-n">{v.length}</span></div><div className="poll-track"><div className="poll-fill" style={{ width: `${voters ? (v.length / voters) * 100 : 0}%` }} /></div></div>
          </button>
        );
      })}
      <div className="poll-foot">{voters} vote{voters === 1 ? '' : 's'}</div></div>
  );
}

function Location({ m }: { m: Message }) {
  // eslint-disable-next-line react-hooks/purity
  const live = m.live && m.live > Date.now();
  const url = `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=16/${m.lat}/${m.lng}`;
  return (
    <>
      <a className="loc-card" href={url} target="_blank" rel="noopener noreferrer"><div className="loc-map"><span className={`loc-pin ${live ? 'live' : ''}`}><Icon name="place" size={30} /></span></div>
        <div className="loc-info"><b>{m.name || 'Location'}</b><span className="ci-sub">{(+m.lat).toFixed(4)}, {(+m.lng).toFixed(4)}{m.acc ? ` · ±${m.acc} m` : ''}</span>{live ? <span className="live-pill">● Live until {fmtTime(m.live)}</span> : m.live ? <span className="ci-sub">Live location ended</span> : null}</div></a>
      {live && m.from === 'me' ? <div className="card-actions"><button className="link-btn danger" data-act="stoplive" data-mid={m.id} onClick={() => stopLive(m)}>Stop sharing</button></div> : null}
    </>
  );
}

function DocFallback({ ch, m, q }: { ch: Chat; m: Message; q?: string | null }) {
  const ft = fileType(m.ext);
  return (
    <>
      <div className="doc" data-act="opendoc" data-mid={m.id} onClick={() => act.openDocViewer(m, ch)}><DocIcon label={ft.label} color={ft.color} /><div className="doc-info"><div className="doc-name"><Html html={fmtText(m.name || '', q)} /></div><div className="doc-sub">{m.pages ? m.pages + ' page' + (m.pages > 1 ? 's' : '') + ' · ' : ''}{(m.ext || 'file').toUpperCase()} · {fmtSize(m.size || 0)}</div></div></div>
      {m.caption ? <div className="text cap"><Html html={fmtText(m.caption, q)} /><Spacer /></div> : null}
    </>
  );
}

function Content({ ch, m, q, jumbo }: { ch: Chat; m: Message; q: string | null; jumbo: boolean }) {
  const out = m.from === 'me';
  const R = messageRenderers[m.type];
  if (R) return <R ch={ch} m={m} q={q} />;
  switch (m.type) {
    case 'text':
      if (jumbo) return <div className="jumbo">{m.text}</div>;
      return (
        <>
          {out ? null : <ScamWarn ch={ch} m={m} />}
          <div className="text"><Html html={fmtText(m.text || '', q)} />
            {m.tr && (ch.translate || S.settings.autoTranslate) ? <span className="tr"><span className="tr-label"><Icon name="translate" size={12} /> Translated from {LANGS[contact(m.from)?.lang || ''] || 'another language'}</span><Html html={fmtText(m.tr, q)} /></span> : null}
            <LiveTr ch={ch} m={m} /><Spacer /></div>
        </>
      );
    case 'deleted': return <div className="text deleted"><Icon name="block" size={15} /> {out ? 'You deleted this message' : 'This message was deleted'}<Spacer /></div>;
    case 'sticker': return <div className="jumbo sticker">{m.text}</div>;
    case 'gif': return <div className="gif" style={{ background: m.gif?.bg }}><span className={`anim-${m.gif?.anim}`}>{m.gif?.e}</span><b>{m.gif?.label}</b><span className="gif-tag">GIF</span></div>;
    case 'image':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="media" data-act="viewmedia" data-mid={m.id} onClick={() => act.viewMedia(m)}>{m.src ? <img src={m.src} alt={m.caption || 'Photo'} /> : <div className="art" style={{ background: m.art?.bg }}><span>{m.art?.emoji}</span></div>}</div>
          {m.caption ? <div className="text cap"><Html html={fmtText(m.caption, q)} /><Spacer /></div> : null}
        </>
      );
    case 'video':
      return (
        <>
          <div className="media">{m.src && ui.blobs.includes(m.src) ? <video src={m.src} controls playsInline preload="metadata" /> : <div className="art vid"><span><Icon name="play" size={48} /></span><small>Video available only in the session it was sent</small></div>}</div>
          {m.caption ? <div className="text cap"><Html html={fmtText(m.caption, q)} /><Spacer /></div> : null}
        </>
      );
    case 'doc': return <DocFallback ch={ch} m={m} q={q} />;
    case 'signreq': return <div className="text">{preview(m)}<Spacer /></div>;
    case 'voice': return <><Voice m={m} />{m.transcript ? <div className="text transcript"><span className="tr-label"><Icon name="sparkle" size={12} /> AI transcript</span>{m.transcript}<Spacer /></div> : null}</>;
    case 'payment': return <Pay ch={ch} m={m} />;
    case 'poll': return <Poll ch={ch} m={m} />;
    case 'location': return <Location m={m} />;
    case 'event':
      return (
        <>
          <div className="event-card"><div className="ev-ic"><Icon name="event" size={22} /></div><div className="grow"><div className="ev-title">{m.title}</div><div className="ci-sub">{new Date(m.when).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{m.place ? ' · ' + m.place : ''}</div><div className="ci-sub">{(m.going || []).length} going</div></div></div>
          <div className="card-actions"><button className="link-btn" data-act="going" data-mid={m.id} onClick={() => toggleGoing(ch, m)}>{(m.going || []).includes('me') ? '✓ Going' : 'Going?'}</button><button className="link-btn" data-act="remind" data-mid={m.id} onClick={() => toggleRemind(m)}>{m.remind ? '⏰ Reminder set' : 'Remind me'}</button></div>
        </>
      );
    case 'product': {
      const p = productById(m.productId);
      if (!p) return null;
      return <><div className="product-card" data-act="catalog" onClick={() => { if (isBiz(ch)) catalogModal(ch); }}><div className="prod-art" style={{ background: p.bg }}>{p.emoji}</div><div className="prod-info"><div className="ev-title">{p.name}</div><div className="ci-sub">{money(p.price)}</div></div></div>{m.text ? <div className="text">{m.text}<Spacer /></div> : <Spacer />}</>;
    }
    case 'invoice':
      return (
        <>
          <div className="invoice"><div className="inv-head"><Icon name="receipt" size={18} /> Invoice · {m.orderId}<span className="paid-stamp">PAID</span></div>
            {(m.items || []).map((i: { qty: number; name: string; price: number }, k: number) => <div key={k} className="inv-row"><span>{i.qty} × {i.name}</span><span>{money(i.price * i.qty)}</span></div>)}
            <div className="inv-row total"><span>Total</span><span>{money(m.total)}</span></div><div className="ci-sub">{senderName(m.from)} · {new Date(m.t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></div>
          <div className="card-actions"><button className="link-btn" data-act="invoice-dl" data-mid={m.id} onClick={() => downloadInvoice(m)}>Download invoice</button></div>
        </>
      );
    case 'contact': {
      const u = person(m.userId);
      if (!u) return null;
      return <><div className="contact-card"><Avatar o={u} size={44} /><div><div className="ev-title">{u.name}</div><div className="ci-sub">@{u.username}</div></div></div><div className="card-actions"><button className="link-btn" data-act="startdm" data-user={u.id} onClick={() => startDM(u.id)}>Message</button></div></>;
    }
    case 'call': return <div className="call-msg"><span className={`call-msg-ic ${m.missed ? 'missed' : ''}`}><Icon name={m.video ? 'video' : 'call'} size={20} /></span><div><div>{m.video ? 'Video call' : 'Voice call'}</div><div className="ci-sub">{m.missed ? 'Missed' : fmtDur(m.dur)}</div></div><Spacer /></div>;
  }
  return null;
}

/** Links inside messages: call links, group invites and profile links stay in the app; flagged messages ask first. */
function onBubbleClickCapture(e: MouseEvent<HTMLDivElement>) {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!a) return;
  const href = a.href;
  if (href.includes('whatsmore.app/call/')) { e.preventDefault(); e.stopPropagation(); act.startCall(null, true, { room: href.split('/call/')[1] }); return; }
  if (href.includes('whatsmore.app/g/')) { e.preventDefault(); e.stopPropagation(); const code = href.split('/g/')[1]; const g = S.chats.find((c) => c.invite && c.invite === code); if (g) openChat(g.id); else toast('This invite link was reset or is invalid'); return; }
  if (href.includes('whatsmore.app/u/')) { e.preventDefault(); e.stopPropagation(); Promise.resolve(act.connectFromText(href)).then((ok) => { if (ok === false) toast('User not found'); }); return; }
  if (e.currentTarget.querySelector('.scam-warn')) { e.preventDefault(); e.stopPropagation(); confirmSuspiciousLink(href); }
}

export function MsgRow({ ch, m, first, q }: { ch: Chat; m: Message; first: boolean; q: string | null }) {
  const out = m.from === 'me';
  const jumbo = m.type === 'sticker' || (m.type === 'text' && isJumbo(m.text) && !m.replyTo);
  const bare = jumbo || m.type === 'gif';
  const qm = m.replyTo ? ch.messages.find((x) => x.id === m.replyTo) : undefined;
  const sender = ch.type === 'group' && !out && first && !bare ? contact(m.from) : null;
  const reacts = Object.entries(m.reactions || {}).filter(([, v]) => v.length);
  const total = reacts.reduce((s, [, v]) => s + v.length, 0);
  const cls = ['bubble', 't-' + m.type, first && !bare ? 'tail' : '', bare ? 'bare' : '', m.type === 'image' && !m.caption ? 'nocap' : '', m.edited ? 'edited' : ''].join(' ');
  return (
    <div className={`msg-row ${out ? 'out' : 'in'} ${first ? 'first' : ''}`} data-mid={m.id}
      onContextMenu={(e) => { if ((e.target as HTMLElement).closest('a, video')) return; e.preventDefault(); msgMenu(m.id, { x: e.clientX, y: e.clientY }); }}>
      <div className={cls} onClickCapture={onBubbleClickCapture}>
        {ch.type === 'group' && !out && first && !bare ? <div className="sender" style={{ color: sender?.color || 'var(--accent)' }}>{senderName(m.from)}<span className="sender-un">@{sender?.username || ''}</span></div> : null}
        {m.forwarded ? <div className="fwd"><Icon name="forward" size={14} /> Forwarded</div> : null}
        {m.bot ? <div className="bot-tag"><Icon name="sparkle" size={12} /> AI assistant</div> : null}
        {m.scheduled ? <div className="fwd"><Icon name="timer" size={13} /> Scheduled</div> : null}
        {qm ? <Quote q={qm} /> : null}
        {m.statusQuote ? <div className="quote status-q" style={qc('var(--accent)')}><div className="q-main"><div className="q-name">{m.statusQuote.who} · Status</div><div className="q-text">{m.statusQuote.text}</div></div><div className="q-thumb" style={{ background: m.statusQuote.bg }} /></div> : null}
        <Content ch={ch} m={m} q={q} jumbo={jumbo} />
        <span className="meta">{m.exp ? <Icon name="timer" size={12} /> : null}{m.starred ? <Icon name="star" size={12} /> : null}{m.pinned ? <Icon name="pin" size={12} /> : null}{m.edited ? <span>Edited</span> : null}<span>{fmtTime(m.t)}</span>{out && !['deleted', 'call'].includes(m.type) ? <Ticks st={m.status} /> : null}</span>
        <button className="msg-menu" data-act="msgmenu" data-mid={m.id} aria-label="Message options" onClick={(e) => { e.stopPropagation(); msgMenu(m.id, e.currentTarget); }}><Icon name="chevdown" size={20} /></button>
      </div>
      {reacts.length ? <button className={`reactions ${reacts.some(([, v]) => v.includes('me')) ? 'mine' : ''}`} data-act="reactinfo" data-mid={m.id} onClick={() => reactInfoModal(ch, m)}>{reacts.map(([e]) => e).join('')}{total > 1 ? <span>{total}</span> : null}</button> : null}
    </div>
  );
}
