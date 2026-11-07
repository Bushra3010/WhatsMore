'use client';
// Document viewer modal and the doc message bubble (case 'doc' of contentHTML + docBadgesHTML).
import { Fragment, type ReactNode } from 'react';
import { fileType, fmtSize, fmtText, senderName, escRe } from '@/lib/util';
import { modal } from '@/lib/overlay';
import { act } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import { DocIcon } from '@/components/ui/Avatar';
import type { Chat, Message } from '@/lib/types';
import { docHTMLFor, demoDocHTML, downloadDoc, printDoc, fmtStamp, hasBlob, NOT_EDITABLE } from './lib';
import { openStudio } from './studio';
import { signCertModal } from './signature';

export function FileIcon({ ext, cls = '' }: { ext?: string; cls?: string }) {
  const t = fileType(ext);
  return <DocIcon label={t.label} color={t.color} cls={cls} />;
}

/** docHTMLFor / demoDocHTML output only: every variable string inside is escaped (see lib.ts). */
function DocPage({ html }: { html: string }) {
  return <div className="doc-page" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Preview({ m }: { m: Partial<Message> }) {
  const kind = fileType(m.ext).kind;
  const src: string | null = m.data || (hasBlob(m.url) ? m.url : null);
  if (m.html || m.content != null) return <DocPage html={docHTMLFor(m)} />;
  if (src && kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="dv-img" src={src} alt="" />;
  }
  if (src && m.ext === 'pdf') return <iframe className="dv-frame" src={src} title={m.name} />;
  if (src && kind === 'audio') return <div className="dv-center"><FileIcon ext={m.ext} cls="big" /><audio src={src} controls /></div>;
  if (src && kind === 'video') return <video className="dv-img" src={src} controls playsInline />;
  if (src) return <div className="dv-center"><FileIcon ext={m.ext} cls="big" /><div className="ci-name">{m.name}</div><p className="muted small">{fileType(m.ext).label} file · {fmtSize(m.size || 0)} — open it with an app on your device.</p></div>;
  return <DocPage html={demoDocHTML(m)} />;
}

export function openDocViewer(m: Message | Partial<Message>, ch?: Chat | null) {
  const real = !!ch && ch.messages.includes(m as Message);
  const editable = !NOT_EDITABLE.includes(fileType(m.ext).kind);
  const { close } = modal({
    title: m.name || 'Document',
    cls: 'xwide',
    body: (
      <>
        <div className="dv"><Preview m={m} /></div>
        <div className="dv-meta">
          <FileIcon ext={m.ext} />
          <div className="grow">
            <div className="ci-name">{m.name}</div>
            <div className="ci-sub">{fileType(m.ext).label} · {fmtSize(m.size || (m.html || '').length)}{m.from ? ' · ' + senderName(m.from) : ''}{m.t ? ' · ' + fmtStamp(m.t) : ''}</div>
            <div className="ci-sub"><Icon name="lock" size={12} /> End-to-end encrypted · saved in WHATSMORE Cloud{m.corrected ? ` · ✓ AI-corrected (${m.corrected} fixes)` : ''}</div>
          </div>
        </div>
        {m.signed && (
          <div className="sig-banner" data-cert="" role="button" tabIndex={0} onClick={() => signCertModal(m)} onKeyDown={(e) => { if (e.key === 'Enter') signCertModal(m); }}>
            <Icon name="verified" size={18} />
            <span className="grow">Digitally signed by <b>{senderName(m.signed.by)}</b> · {fmtStamp(m.signed.at)}</span>
            <span className="link-btn">Certificate</span>
          </div>
        )}
      </>
    ),
    actions: [
      { label: 'Download', onClick: () => { downloadDoc(m); return false; } },
      !!(m.html || m.content != null || !m.url) && { label: 'Print / PDF', onClick: () => { printDoc(m); return false; } },
      real && { label: 'Forward', onClick: () => { setTimeout(() => act.forwardModal(m), 0); } },
      editable && { label: 'Sign', onClick: () => { setTimeout(() => openStudio({ ch, src: m, sign: true }), 0); } },
      editable && { label: 'Edit & AI-correct', primary: true, onClick: () => { setTimeout(() => openStudio({ ch, src: m }), 0); } },
    ],
  });
  return close;
}

// ---------- doc bubble
function Highlight({ text, q }: { text: string; q?: string | null }): ReactNode {
  if (!q) return text;
  const parts = String(text).split(new RegExp('(' + escRe(q) + ')', 'gi'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

export function DocBadges({ m }: { m: Message }) {
  return (
    <>
      {m.signed && (
        <button className="doc-badge signed" data-act="signcert" data-mid={m.id} onClick={(e) => { e.stopPropagation(); signCertModal(m); }}>
          <Icon name="verified" size={14} /> Digitally signed by {senderName(m.signed.by)} · Verify
        </button>
      )}
      {!!m.corrected && <div className="doc-badge"><Icon name="spell" size={14} /> AI-corrected · {m.corrected} fix{m.corrected === 1 ? '' : 'es'}</div>}
    </>
  );
}

export function DocBubble({ ch, m, q }: { ch: Chat; m: Message; q?: string | null }) {
  return (
    <>
      <div className="doc" data-act="opendoc" data-mid={m.id} role="button" tabIndex={0} onClick={() => openDocViewer(m, ch)} onKeyDown={(e) => { if (e.key === 'Enter') openDocViewer(m, ch); }}>
        <FileIcon ext={m.ext} />
        <div className="doc-info">
          <div className="doc-name"><Highlight text={m.name || ''} q={q} /></div>
          <div className="doc-sub">{m.pages ? m.pages + ' page' + (m.pages > 1 ? 's' : '') + ' · ' : ''}{(m.ext || 'file').toUpperCase()} · {fmtSize(m.size || 0)}</div>
        </div>
      </div>
      <DocBadges m={m} />
      {/* fmtText output is escaped; the spacer is a constant */}
      {m.caption && <div className="text cap" dangerouslySetInnerHTML={{ __html: fmtText(m.caption, q) + '<span class="meta-spacer"></span>' }} />}
    </>
  );
}

