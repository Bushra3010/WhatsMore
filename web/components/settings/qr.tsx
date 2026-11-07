'use client';
// QR codes: my QR (profile card), scan / paste a profile link, and connecting to the scanned person.
// Ported from js/features.js (drawQR, qrModal, scanModal, connectFromText).
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { S } from '@/lib/state';
import { modal, toast, copyText, closeModal } from '@/lib/overlay';
import { startDM } from '@/lib/actions';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';

const QR_OPTS = { width: 196, margin: 0, errorCorrectionLevel: 'M' as const, color: { dark: '#111b21', light: '#ffffff' } };

/** Draw a QR code into an element (imperative, for other areas). */
export function drawQR(el: HTMLElement | null, text: string) {
  if (!el) return;
  el.innerHTML = '';
  const c = document.createElement('canvas');
  el.appendChild(c);
  QRCode.toCanvas(c, text, QR_OPTS).catch(() => { el.innerHTML = '<div class="qr-fallback"><small>QR library offline</small></div>'; });
}

/** QR code box (`.qr-box` with a canvas). */
export function QRBox({ text, id }: { text: string; id?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, text, QR_OPTS).then(() => setFailed(false)).catch(() => setFailed(true));
  }, [text]);
  return (
    <div id={id} className="qr-box">
      {failed ? <div className="qr-fallback"><Icon name="qr" size={120} /><small>QR library offline</small></div> : <canvas ref={ref} />}
    </div>
  );
}

export function qrModal() {
  const link = `https://whatsmore.app/u/${S.me.username}`;
  modal({
    title: 'My QR code',
    body: (
      <div className="qr-card">
        <Avatar o={S.me} size={64} />
        <div className="pc-name">{S.me.name}</div>
        <div className="accent">@{S.me.username}</div>
        <QRBox id="qr-box" text={link} />
        <div className="qr-link">{link}</div>
        <p className="muted small">Scan → Profile → Connect. Works as your digital contact card — your phone number stays private.</p>
      </div>
    ),
    actions: [{ label: 'Copy link', onClick: () => { copyText(link); return false; } }, { label: 'Done', primary: true }],
  });
}

/** Open a chat with the WHATSMORE user in a profile link / @username. Returns false when nobody matches. */
export function connectFromText(t: string): boolean {
  const mm = String(t).trim().match(/(?:whatsmore\.app\/u\/|^@?)([a-z0-9._]{3,24})$/i);
  if (!mm) return false;
  const un = mm[1].toLowerCase();
  if (un === S.me.username) { toast("That's your own QR code 🙂"); return true; }
  const u = [...S.contacts, ...S.directory].find((x) => x.username === un);
  if (!u) return false;
  startDM(u.id);
  return true;
}

interface Detector { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

function ScanBody({ h }: { h: { id: number } }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState('Starting camera…');
  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = vid.current!;
        v.srcObject = stream; await v.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (!BD) { setMsg('QR detection not supported in this browser — paste the link below.'); return; }
        setMsg('Point at a WHATSMORE QR code');
        const det = new BD({ formats: ['qr_code'] });
        const loop = async () => {
          if (!alive) return;
          try { const codes = await det.detect(v); if (codes[0] && connectFromText(codes[0].rawValue)) { closeModal(h.id); return; } } catch { /* keep scanning */ }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { if (alive) setMsg('Camera unavailable — paste a profile link below.'); }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [h]);
  return (
    <>
      <div className="scan-box"><video id="scan-vid" ref={vid} playsInline muted /><div className="scan-frame" /><div className="scan-msg" id="scan-msg">{msg}</div></div>
      <label className="field"><span>Or paste a profile link / @username</span><input id="scan-in" placeholder="https://whatsmore.app/u/meera.designs" /></label>
    </>
  );
}

export function scanModal() {
  const h = { id: 0 };
  const r = modal({
    title: 'Scan QR code',
    body: <ScanBody h={h} />,
    actions: [{ label: 'Cancel' }, {
      label: 'Connect', primary: true, onClick: (root) => {
        const v = root.querySelector<HTMLInputElement>('#scan-in')?.value || '';
        if (!connectFromText(v)) { toast('No WHATSMORE user found for that link'); return false; }
      },
    }],
  });
  h.id = r.id;
}
