'use client';
// Media lightbox (viewMedia in js/overlays.js).
import { useEffect } from 'react';
import { S } from '@/lib/state';
import { modalOpen } from '@/lib/overlay';
import { contact, senderName, dayLabel, fmtTime } from '@/lib/util';
import type { Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { M, bump, useMedia } from './shared';

export function viewMedia(m: Message) { M.lightbox = m; bump(); }
const close = () => { M.lightbox = null; bump(); };

export function LightboxOverlay() {
  useMedia();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && M.lightbox && !modalOpen() && !document.getElementById('menu')) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const m = M.lightbox;
  if (!m) return null;
  return (
    <div className="lightbox" id="lightbox">
      <div className="lb-head">
        <Avatar o={m.from === 'me' ? S.me : contact(m.from)} size={40} />
        <div className="grow"><div>{senderName(m.from)}</div><div className="ci-sub">{dayLabel(m.t)} at {fmtTime(m.t)}</div></div>
        <button className="icon-btn" data-act="lb-close" aria-label="Close" onClick={close}><Icon name="close" /></button>
      </div>
      <div className="lb-stage" data-act="lb-close" onClick={close}>
        {m.src ? <img src={m.src} alt="" /> : <div className="lb-art" style={{ background: m.art?.bg }}>{m.art?.emoji}</div>}
      </div>
      {m.caption ? <div className="lb-cap">{m.caption}</div> : null}
    </div>
  );
}
