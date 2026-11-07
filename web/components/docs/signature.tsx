'use client';
// Digital signatures: signature pad (draw / type / upload / saved), signature requests (bubble, modal,
// simulated signing), signed copies and the signature certificate with audit trail + integrity check.
// Ported from js/docs.js.
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { S, ui, commit, refresh } from '@/lib/state';
import { uid, fileType, fmtSize, senderName, firstName, person, contact } from '@/lib/util';
import { modal, toast, confirmModal, pickFile, readImage } from '@/lib/overlay';
import { sendMsg, notify } from '@/lib/actions';
import { Icon } from '@/components/Icon';
import { DocIcon } from '@/components/ui/Avatar';
import type { Chat, Message } from '@/lib/types';
import { agreementHTML, docHTMLFor, extOfName, fmtStamp, sigId, sha256, htmlText, typedSigBlock, withSuffix } from './lib';
import { openStudio } from './studio';
import { openDocViewer, FileIcon } from './viewer';

// ---------- signature pad
const FONTS = ['"Segoe Script","Brush Script MT",cursive', '"Lucida Handwriting","Apple Chancery",cursive', 'Georgia,serif'];
type PadMode = 'draw' | 'type' | 'upload' | 'saved';

function clearPad(cvs: HTMLCanvasElement | null) {
  if (!cvs) return;
  cvs.getContext('2d')?.clearRect(0, 0, cvs.width, cvs.height);
  delete cvs.dataset.ink;
}
function drawTyped(cvs: HTMLCanvasElement, raw: string, font: number) {
  clearPad(cvs);
  const name = raw.trim();
  if (!name) return;
  const ctx = cvs.getContext('2d')!;
  ctx.fillStyle = '#1a3d8f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 92;
  do {
    ctx.font = `${font === 2 ? 'italic ' : ''}${size}px ${FONTS[font]}`;
    size -= 4;
  } while (ctx.measureText(name).width > cvs.width - 60 && size > 30);
  ctx.fillText(name, cvs.width / 2, cvs.height / 2);
  cvs.dataset.ink = '1';
}

function SigPad() {
  const [mode, setMode] = useState<PadMode>(S.signature ? 'saved' : 'draw');
  const [font, setFont] = useState(0);
  const [name, setName] = useState(S.me.name);
  const [inkColor, setInkColor] = useState('#1a3d8f');
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const pen = useRef<{ down: boolean; last: [number, number] }>({ down: false, last: [0, 0] });
  const tabs: [PadMode, string][] = [['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload'], ...(S.signature ? [['saved', 'Saved'] as [PadMode, string]] : [])];

  useEffect(() => {
    const cvs = cvsRef.current!;
    clearPad(cvs);
    if (mode === 'type') drawTyped(cvs, name, font);
  }, [mode, font, name]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const cvs = e.currentTarget, r = cvs.getBoundingClientRect();
    return [((e.clientX - r.left) * cvs.width) / r.width, ((e.clientY - r.top) * cvs.height) / r.height];
  };
  const upload = async () => {
    const files = await pickFile();
    if (!files[0]) return;
    try {
      const src = await readImage(files[0], 900);
      const im = new Image();
      im.onload = () => {
        const cvs = cvsRef.current;
        if (!cvs) return;
        clearPad(cvs);
        const s = Math.min(cvs.width / im.width, cvs.height / im.height);
        cvs.getContext('2d')!.drawImage(im, (cvs.width - im.width * s) / 2, (cvs.height - im.height * s) / 2, im.width * s, im.height * s);
        cvs.dataset.ink = '1';
      };
      im.src = src;
    } catch {
      toast('Could not read that image');
    }
  };

  return (
    <>
      <div className="side-tabs pad0">{tabs.map(([k, l]) => <button key={k} data-mode={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
      <div className="sig-pad-wrap">
        <canvas
          id="sig-cvs" ref={cvsRef} width={760} height={260} data-mode={mode} hidden={mode === 'saved'}
          onPointerDown={(e) => { if (mode !== 'draw') return; pen.current.down = true; pen.current.last = pos(e); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            if (!pen.current.down) return;
            const p = pos(e), ctx = e.currentTarget.getContext('2d')!;
            ctx.strokeStyle = inkColor; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(...pen.current.last); ctx.lineTo(...p); ctx.stroke();
            pen.current.last = p;
            e.currentTarget.dataset.ink = '1';
          }}
          onPointerUp={() => { pen.current.down = false; }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="sig-saved" alt="Saved signature" hidden={mode !== 'saved'} src={mode === 'saved' ? S.signature?.img : undefined} />
      </div>
      <div id="sig-opts">
        {mode === 'draw' ? (
          <div className="row-between"><span className="muted small">Draw with your mouse, finger or stylus</span>
            <select id="sig-ink" aria-label="Ink colour" value={inkColor} onChange={(e) => setInkColor(e.target.value)}><option value="#1a3d8f">Blue ink</option><option value="#111111">Black ink</option></select>
          </div>
        ) : mode === 'type' ? (
          <>
            <label className="field"><span>Full name</span><input id="sig-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
            <div className="chips">{FONTS.map((f, i) => <button key={i} className={`chip ${i === font ? 'on' : ''}`} data-font={i} style={{ fontFamily: f }} onClick={() => setFont(i)}>{S.me.name}</button>)}</div>
          </>
        ) : mode === 'upload' ? (
          <button className="btn" id="sig-up" onClick={upload}><Icon name="upload" size={16} /> Upload a photo of your signature</button>
        ) : <p className="muted small">Using your saved signature.</p>}
      </div>
      <label className="radio-row"><input type="checkbox" id="sig-keep" defaultChecked /> Save this signature for next time</label>
      <p className="muted small"><Icon name="shield" size={14} /> Your signature is sealed with a SHA-256 fingerprint, time-stamp and your verified @username. Production builds can use Aadhaar eSign / DSC for legally binding signatures under the IT Act, 2000.</p>
    </>
  );
}

export function signaturePad(cb: (sig: { img: string; mode: string }) => void) {
  const cvsOf = (root: HTMLElement) => root.querySelector<HTMLCanvasElement>('#sig-cvs');
  modal({
    title: 'Add your signature',
    body: <SigPad />,
    actions: [
      { label: 'Clear', onClick: (root) => { clearPad(cvsOf(root)); return false; } },
      { label: 'Cancel' },
      {
        label: 'Sign document', primary: true,
        onClick: (root) => {
          const cvs = cvsOf(root);
          if (!cvs) return false;
          const mode = cvs.dataset.mode || 'draw';
          let img: string;
          if (mode === 'saved') img = S.signature.img;
          else {
            if (!cvs.dataset.ink) { toast(mode === 'type' ? 'Type your name' : 'Draw your signature first'); return false; }
            img = cvs.toDataURL('image/png');
          }
          if (root.querySelector<HTMLInputElement>('#sig-keep')?.checked && mode !== 'saved') {
            S.signature = { img, mode };
            commit();
          }
          cb({ img, mode });
        },
      },
    ],
  });
}

// ---------- signature requests
export function signedDocOf(ch: Chat, m: Message): Partial<Message> {
  if (m.from === 'me') return { name: withSuffix(m.doc.name, 'signed'), ext: m.doc.ext, html: m.signedHtml || docHTMLFor(m.doc), size: (m.signedHtml || '').length, signed: m.signedBy && { by: m.signedBy[0].id, at: m.signedBy[0].at, id: m.signedBy[0].sigId, hash: m.hash } };
  return ch.messages.find((x) => x.id === m.signedMid) || { ...m.doc };
}

function srView(ch: Chat, m: Message) {
  if (m.status === 'signed') openDocViewer(signedDocOf(ch, m), ch);
  else openDocViewer({ ...m.doc, from: m.from, t: m.t }, null);
}
function srDecline(ch: Chat, m: Message) {
  confirmModal('Decline to sign?', `${senderName(m.from)} will be told you declined “${m.doc.name}”.`, 'Decline', () => {
    m.status = 'declined';
    ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You declined to sign “${m.doc.name}”` });
    commit();
  });
}
/** Review & sign a request (or sign a document) in the Studio. */
export function openSignFlow(ch: Chat, m: Message) {
  if (m.type === 'signreq') openStudio({ ch, req: m });
  else openStudio({ ch, src: m, sign: true });
}

export function SignReqBubble({ ch, m }: { ch: Chat; m: Message; q?: string | null }) {
  const out = m.from === 'me';
  const names = (m.signers || []).map(firstName).join(', ');
  const signed = m.status === 'signed';
  let status: React.ReactNode;
  if (signed) status = <><Icon name="verified" size={15} /> Signed by {(m.signedBy || []).map((s: { id: string }) => firstName(s.id)).join(', ')} · {fmtStamp(m.signedBy[0].at)}</>;
  else if (m.status === 'declined') status = 'Declined';
  else status = out ? `Waiting for ${names} to sign` : 'Your signature is requested';
  const doc = m.doc || {};
  return (
    <>
      <div className={`signreq ${m.status}`}>
        <div className="pay-head"><Icon name="draw" size={16} /><span>Signature request</span></div>
        <div className="sr-doc" data-act="sr-view" data-mid={m.id} role="button" tabIndex={0} onClick={() => srView(ch, m)} onKeyDown={(e) => { if (e.key === 'Enter') srView(ch, m); }}>
          <FileIcon ext={doc.ext} />
          <div className="doc-info"><div className="doc-name">{doc.name}</div><div className="doc-sub">{fileType(doc.ext).label} · {fmtSize(doc.size || 0)}</div></div>
        </div>
        {m.note && <div className="pay-note">{m.note}</div>}
        <div className={`pay-status ${signed ? 'green' : ''}`}>{status}</div>
        <div className="pay-actions">
          {!out && m.status === 'pending' ? (
            <>
              <button className="btn sm" data-act="sr-decline" data-mid={m.id} onClick={() => srDecline(ch, m)}>Decline</button>
              <button className="btn sm primary" data-act="sr-sign" data-mid={m.id} onClick={() => openStudio({ ch, req: m })}><Icon name="draw" size={14} /> Review &amp; sign</button>
            </>
          ) : signed ? (
            <>
              <button className="btn sm" data-act="sr-cert" data-mid={m.id} onClick={() => signCertModal(signedDocOf(ch, m), m)}>Certificate</button>
              <button className="btn sm primary" data-act="sr-view" data-mid={m.id} onClick={() => srView(ch, m)}>Open signed copy</button>
            </>
          ) : (
            <button className="btn sm" data-act="sr-view" data-mid={m.id} onClick={() => srView(ch, m)}>View document</button>
          )}
        </div>
      </div>
      <span className="meta-spacer" />
    </>
  );
}

export function signRequestModal(ch: Chat) {
  const docs = ch.messages.filter((m) => m.type === 'doc' && !m.signed).slice(-6).reverse();
  const people = ch.type === 'group' ? (ch.members || []).slice(0, 50) : [ch.contactId!];
  modal({
    title: 'Request signature',
    body: (
      <>
        <div className="list-label pad0">Document</div>
        <label className="chat-item check-row">
          <DocIcon label="DOC" color="#5e35b1" />
          <div className="ci-body"><div className="ci-name">Freelance_Agreement_2026.docx</div><div className="ci-preview">Template · agreement</div></div>
          <input type="radio" name="srd" value="tpl" className="check" defaultChecked />
        </label>
        {docs.map((d) => (
          <label className="chat-item check-row" key={d.id}>
            <FileIcon ext={d.ext} />
            <div className="ci-body"><div className="ci-name">{d.name}</div><div className="ci-preview">From this chat · {fmtSize(d.size || 0)}</div></div>
            <input type="radio" name="srd" value={d.id} className="check" />
          </label>
        ))}
        <label className="chat-item check-row">
          <span className="action-ic"><Icon name="upload" size={20} /></span>
          <div className="ci-body"><div className="ci-name">Upload a file</div><div className="ci-preview">PDF, Word or any document</div></div>
          <input type="radio" name="srd" value="up" className="check" />
        </label>
        <div className="list-label pad0">Who needs to sign</div>
        {people.map((id) => (
          <label className="radio-row" key={id}><input type="checkbox" name="srp" value={id} defaultChecked /> {senderName(id)} <span className="muted small">@{person(id)?.username || ''}</span></label>
        ))}
        <label className="field"><span>Message</span><input id="sr-note" maxLength={120} defaultValue="Please review and sign 🙏" /></label>
      </>
    ),
    actions: [
      { label: 'Cancel' },
      {
        label: 'Send request', primary: true,
        onClick: (root) => {
          const which = root.querySelector<HTMLInputElement>('input[name=srd]:checked')?.value || 'tpl';
          const signers = [...root.querySelectorAll<HTMLInputElement>('input[name=srp]:checked')].map((i) => i.value);
          if (!signers.length) { toast('Choose who should sign'); return false; }
          sendSignRequest(ch, which, signers, root.querySelector<HTMLInputElement>('#sr-note')?.value.trim() || '');
        },
      },
    ],
  });
}

export async function sendSignRequest(ch: Chat, which: string, signers: string[], note: string) {
  let doc: Record<string, unknown>;
  if (which === 'tpl') {
    doc = {
      name: 'Freelance_Agreement_2026.docx', ext: 'docx', size: 42000,
      html: agreementHTML()
        .replace(/<div class="sig-block"[\s\S]*?<\/div><\/div>/, '')
        .replace('data-for="me"', 'data-for="them"')
        .replace('Client signature — click <b>Sign</b> to sign here', 'Signature'),
    };
  } else if (which === 'up') {
    const files = await pickFile();
    if (!files[0]) return;
    const f = files[0], ext = extOfName(f.name);
    doc = { name: f.name, ext, size: f.size };
    if (fileType(ext).kind === 'text' && f.size < 300000) doc.content = await f.text();
  } else {
    const d = ch.messages.find((x) => x.id === which);
    if (!d) return;
    doc = { name: d.name, ext: d.ext, size: d.size, html: d.html, content: d.content };
  }
  const m = sendMsg(ch, { type: 'signreq', doc, signers, note, status: 'pending' });
  if (m) simulateSigning(ch, m);
  toast('Signature request sent');
}

export function simulateSigning(ch: Chat, m: Message) {
  const signer = (m.signers || []).find((id: string) => id !== 'me' && contact(id));
  if (!signer) return;
  setTimeout(() => {
    ui.typing[ch.id] = firstName(signer);
    refresh();
    setTimeout(async () => {
      delete ui.typing[ch.id];
      const at = Date.now(), p = contact(signer)!, id = sigId();
      const html = docHTMLFor(m.doc).replace(/<div class="sig-slot"[^>]*>[\s\S]*?<\/div>/, '') + typedSigBlock(p.name, p.username, at, id);
      m.status = 'signed';
      m.signedBy = [{ id: signer, at, sigId: id }];
      m.signedHtml = html;
      m.hash = await sha256(htmlText(html));
      ch.messages.push({ id: uid(), type: 'system', from: 'system', t: at, text: `${p.name} signed “${m.doc.name}” on WHATSMORE` });
      if (ch.id !== ui.active) notify(ch, signer, { text: `✍️ Signed ${m.doc.name}` });
      commit();
    }, 2600);
  }, 3500);
}

// ---------- signature certificate
const useVerify = create<Record<string, 'ok' | 'bad' | 'none'>>(() => ({}));

function CertBody({ m, k, trail }: { m: Partial<Message>; k: string; trail: [number, string][] }) {
  const sg = m.signed || {};
  const signer = sg.by ? person(sg.by) || (sg.by === 'me' ? S.me : null) : null;
  const v = useVerify((s) => s[k]);
  return (
    <div className="cert">
      <div className="cert-head"><Icon name="verified" size={30} /><div><div className="ci-name">{m.name}</div><div className="ci-sub">Digitally signed on WHATSMORE</div></div></div>
      <div className="kv"><span>Signer</span><b>{senderName(sg.by)} · @{signer?.username || ''}</b></div>
      <div className="kv"><span>Signed at</span><b>{sg.at ? fmtStamp(sg.at) : '—'}</b></div>
      <div className="kv"><span>Signature ID</span><b>{sg.id || '—'}</b></div>
      <div className="kv"><span>Method</span><b>Verified @username + device key</b></div>
      <div className="kv col"><span>Document fingerprint (SHA-256)</span><code>{sg.hash || '—'}</code></div>
      <div className="list-label pad0">Audit trail</div>
      <ol className="trail">{trail.map(([t, l], i) => <li key={i}><b>{l}</b><span>{fmtStamp(t)}</span></li>)}</ol>
      <div id="cert-verify">
        {v === 'none' && <div className="hint-box flat"><Icon name="info" size={16} /><span>Original bytes are kept by the sender&apos;s device.</span></div>}
        {(v === 'ok' || v === 'bad') && <div className={`verify ${v}`}><Icon name={v === 'ok' ? 'verified' : 'warning'} size={20} /> {v === 'ok' ? 'Document is unchanged since it was signed.' : 'Warning: this document was modified after signing.'}</div>}
      </div>
    </div>
  );
}

export function signCertModal(m: Partial<Message>, req?: Message) {
  const sg = m.signed || {};
  const signer = sg.by ? person(sg.by) || (sg.by === 'me' ? S.me : null) : null;
  const trail = ([
    req && [req.t, `Signature requested by ${senderName(req.from)}`],
    req && [req.t + 40000, `Document opened by ${senderName(sg.by)}`],
    [sg.at, `Signed by ${senderName(sg.by)} (@${signer?.username || ''})`],
    [sg.at + 1000, 'Sealed with SHA-256 fingerprint and time-stamp'],
  ].filter(Boolean)) as [number, string][];
  const k = uid();
  modal({
    title: 'Signature certificate',
    body: <CertBody m={m} k={k} trail={trail} />,
    onClose: () => useVerify.setState((s) => { const n = { ...s }; delete n[k]; return n; }, true),
    actions: [
      {
        label: 'Verify integrity',
        onClick: () => {
          if (!m.html) { useVerify.setState({ [k]: 'none' }); return false; }
          sha256(htmlText(m.html)).then((h) => useVerify.setState({ [k]: h === sg.hash ? 'ok' : 'bad' }));
          return false;
        },
      },
      { label: 'Done', primary: true },
    ],
  });
}
