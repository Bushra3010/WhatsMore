'use client';
// Document Studio: full-screen editor with toolbar, AI proofread (tracked changes), AI summary, details,
// signing, and sending the edited copy as a new version. Ported from js/docs.js (openStudio & co).
// The page is a contentEditable element whose DOM is owned by the editor (React renders it empty and
// never touches its children); its initial HTML comes from docHTMLFor(), which escapes / sanitises.
import { useEffect, useRef } from 'react';
import { ui, refresh, commit, useRender } from '@/lib/state';
import { uid, fileType, chatById, senderName } from '@/lib/util';
import { toast, confirmModal, closeAllModals } from '@/lib/overlay';
import { sendMsg, scheduleReply, simulateIncoming, openChat } from '@/lib/actions';
import { act } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import type { Chat, Message } from '@/lib/types';
import { docHTMLFor, extOfName, withSuffix, fmtStamp, sigId, sha256, htmlText, imgSigBlock, downloadDoc } from './lib';
import { proofread, summarizeDoc, type Sugg } from './proofread';
import { signaturePad } from './signature';
import { FileIcon } from './viewer';

interface StudioState {
  key: string; chId: string | null; srcId: string | null; reqId: string | null; reqFrom: string | null; name: string; ext: string;
  signed: { at: number; id: string; mode: string } | null; sugg: Sugg[]; fixed: number; dirty: boolean; side: 'review' | 'summary' | 'details';
  proofed?: boolean; html: string; autoSign: boolean;
}
const cur = () => ui.studio as StudioState | null;
const getPage = () => document.getElementById('st-page');
const renderStudioSide = () => refresh();

export function openStudio({ ch, src = null, req = null, blank = false, sign = false }: { ch?: Chat | null; src?: Partial<Message> | null; req?: Message | null; blank?: boolean; sign?: boolean }) {
  closeAllModals();
  const base = (src || req?.doc || {}) as Partial<Message>;
  const name = blank ? 'Untitled document.docx' : base.name || 'Document';
  const st: StudioState = {
    key: uid(), chId: (ch || chatById(ui.active))?.id || null, srcId: src?.id || null, reqId: req?.id || null, reqFrom: req?.from || null,
    name, ext: extOfName(name), signed: null, sugg: [], fixed: 0, dirty: false, side: 'review',
    html: blank ? '<h1>Untitled document</h1><p>Start typing here…</p>' : docHTMLFor(base), autoSign: sign,
  };
  ui.studio = st;
  refresh();
}

function resolveSugg(id: string, accept: boolean) {
  const st = cur(), page = getPage();
  const span = page?.querySelector(`.sugg[data-sid="${id}"]`), s = st?.sugg.find((x) => x.id === id);
  if (!st || !span || !s) return;
  span.replaceWith(document.createTextNode(accept ? s.to : s.from));
  if (accept) st.fixed++;
  st.dirty = true;
}
function resolveAll(accept: boolean) {
  const st = cur();
  if (!st) return;
  st.sugg.forEach((s) => resolveSugg(s.id, accept));
  getPage()?.normalize();
  renderStudioSide();
}

export function closeStudio(force = false) {
  const st = cur();
  if (!force && st && (st.dirty || st.signed)) return confirmModal('Discard changes?', 'Your edits and signature have not been sent yet.', 'Discard', () => closeStudio(true));
  ui.studio = null;
  refresh();
}

function studioSign() {
  const st = cur();
  if (!st) return;
  if (st.signed) return toast('Already signed — send it or close to discard');
  signaturePad((sig) => {
    const page = getPage(), s = cur();
    if (!page || !s) return;
    s.signed = { at: Date.now(), id: sigId(), mode: sig.mode };
    const html = imgSigBlock(sig.img, s.signed.at, s.signed.id);
    const slot = page.querySelector('.sig-slot[data-for="me"]');
    if (slot) slot.outerHTML = html;
    else page.insertAdjacentHTML('beforeend', html);
    page.lastElementChild?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    renderStudioSide();
    toast('✍️ Signature added — the document will be sealed when you send it');
  });
}

async function studioSend() {
  const st = cur();
  const page = getPage();
  if (!st || !page) return;
  resolveAll(false);
  page.querySelectorAll('.sig-slot').forEach((s) => s.remove());
  let name = (document.getElementById('st-name') as HTMLInputElement | null)?.value.trim() || st.name;
  if (st.signed && !/signed/i.test(name)) name = withSuffix(name, 'signed');
  else if (!st.signed && st.fixed && st.srcId && !/corrected/i.test(name)) name = withSuffix(name, 'corrected');
  const html = page.innerHTML, text = htmlText(html);
  const h = await sha256(text);
  const msg: Partial<Message> = { type: 'doc', name, ext: extOfName(name), size: new Blob([html]).size, html, pages: Math.max(1, Math.round(text.length / 2200)), corrected: st.fixed || 0, versionOf: st.srcId };
  if (st.signed) msg.signed = { by: 'me', at: st.signed.at, id: st.signed.id, hash: h };
  const deliver = (ch: Chat) => {
    const sent = sendMsg(ch, msg);
    const req = st.reqId ? ch.messages.find((x) => x.id === st.reqId) : undefined;
    if (req && st.signed) {
      req.status = 'signed';
      req.signedBy = [{ id: 'me', at: st.signed.at, sigId: st.signed.id }];
      req.hash = h;
      req.signedMid = sent?.id;
      commit();
      simulateIncoming(ch, req.from, 'Thank you! Received the signed copy ✅ I will start the work today 🙏', 1200);
    } else if (sent) scheduleReply(ch, sent);
    closeStudio(true);
    if (ui.active !== ch.id) openChat(ch.id);
    toast(st.signed ? '✍️ Signed document sent · sealed with SHA-256' : 'Document sent');
  };
  const ch = chatById(st.chId);
  if (ch) deliver(ch);
  else act.chatPicker('Send document to…', (chats: Chat[]) => deliver(chats[0]), { single: true });
}

function proofNow() {
  const st = cur(), page = getPage();
  if (!st || !page) return;
  resolveAll(false);
  st.sugg = proofread(page);
  st.proofed = true;
  st.side = 'review';
  renderStudioSide();
  toast(st.sugg.length ? `✨ AI found ${st.sugg.length} correction${st.sugg.length > 1 ? 's' : ''}` : '✨ No issues found');
}

const TOOLS: [string, React.ReactNode][] = [
  ['bold', <b key="b">B</b>], ['italic', <i key="i">I</i>], ['underline', <u key="u">U</u>], ['hilite', <span key="h" className="hl">H</span>],
  ['h1', 'H1'], ['h2', 'H2'], ['ul', '• List'], ['undo', '↶'], ['redo', '↷'],
];
const CMDS: Record<string, [string, string?]> = { bold: ['bold'], italic: ['italic'], underline: ['underline'], hilite: ['hiliteColor', '#fff59d'], h1: ['formatBlock', 'h1'], h2: ['formatBlock', 'h2'], ul: ['insertUnorderedList'], undo: ['undo'], redo: ['redo'] };
function runTool(t: string) {
  const st = cur();
  getPage()?.focus();
  const cmd = CMDS[t];
  document.execCommand(cmd[0], false, cmd[1]);
  if (st) st.dirty = true;
}
function setSide(k: StudioState['side']) { const st = cur(); if (st) { st.side = k; renderStudioSide(); } }

function Side({ st }: { st: StudioState }) {
  const page = getPage();
  const words = page ? ((page.textContent || '').match(/\S+/g) || []).length : 0;
  const pending = page ? st.sugg.filter((s) => page.querySelector(`.sugg[data-sid="${s.id}"]`)) : [];
  const tabs: [StudioState['side'], string][] = [['review', 'AI review'], ['summary', 'Summary'], ['details', 'Details']];
  let body: React.ReactNode;
  if (st.side === 'review') {
    if (!st.proofed) {
      body = <div className="side-empty"><Icon name="spell" size={36} /><p>Let WHATSMORE AI check spelling, grammar, capitalisation and punctuation.</p><button className="btn primary" data-st="proof" onClick={proofNow}><Icon name="sparkle" size={16} /> Run AI proofread</button></div>;
    } else if (!pending.length) {
      body = <div className="side-empty ok"><Icon name="check" size={36} /><p><b>All clear.</b> {st.fixed} correction{st.fixed === 1 ? '' : 's'} applied.</p><button className="btn" data-st="proof" onClick={proofNow}>Check again</button></div>;
    } else {
      const by: Record<string, number> = {};
      pending.forEach((s) => { by[s.kind] = (by[s.kind] || 0) + 1; });
      body = (
        <>
          <div className="side-sum">
            <b>{pending.length} suggestion{pending.length === 1 ? '' : 's'}</b>
            <div className="ci-sub">{Object.entries(by).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}</div>
            <div className="btn-row left">
              <button className="btn sm primary" data-st="acceptall" onClick={() => { resolveAll(true); toast('All corrections applied'); }}>Accept all</button>
              <button className="btn sm" data-st="rejectall" onClick={() => resolveAll(false)}>Reject all</button>
            </div>
          </div>
          {pending.map((s) => (
            <div className="sugg-row" data-row={s.id} key={s.id}>
              <span className="pill">{s.kind}</span>
              <div className="sugg-txt"><del>{s.from.replace(/ /g, '␣') || '␣'}</del> → <ins>{s.to || '(remove)'}</ins></div>
              <button className="icon-btn sm ok" data-acc={s.id} aria-label="Accept" onClick={() => { resolveSugg(s.id, true); getPage()?.normalize(); renderStudioSide(); }}><Icon name="check" size={18} /></button>
              <button className="icon-btn sm" data-rej={s.id} aria-label="Reject" onClick={() => { resolveSugg(s.id, false); getPage()?.normalize(); renderStudioSide(); }}><Icon name="close" size={18} /></button>
            </div>
          ))}
        </>
      );
    }
  } else if (st.side === 'summary') {
    const s = page ? summarizeDoc(page, st.name) : { sections: 1, summary: '', points: [], dates: [] };
    body = (
      <div className="side-pad">
        <div className="stat-row"><div><b>{words}</b><span>words</span></div><div><b>{Math.max(1, Math.round(words / 200))} min</b><span>read</span></div><div><b>{s.sections}</b><span>sections</span></div></div>
        <div className="sum-title"><Icon name="sparkle" size={14} /> AI summary</div><p className="small">{s.summary}</p>
        {s.points.length > 0 && <><div className="sum-title">📌 Key points</div><ul className="small">{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
        {s.dates.length > 0 && <><div className="sum-title">📅 Dates &amp; deadlines</div><ul className="small">{s.dates.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
      </div>
    );
  } else {
    body = (
      <div className="side-pad small">
        <div className="kv"><span>File</span><b>{st.name}</b></div>
        <div className="kv"><span>Type</span><b>{fileType(st.ext).label}</b></div>
        <div className="kv"><span>Words</span><b>{words}</b></div>
        <div className="kv"><span>AI fixes applied</span><b>{st.fixed}</b></div>
        <div className="kv"><span>Signature</span><b>{st.signed ? '✅ Signed ' + fmtStamp(st.signed.at) : 'Not signed'}</b></div>
        <div className="kv"><span>Version</span><b>{st.srcId ? 'New version of original' : 'New document'}</b></div>
        <div className="hint-box flat"><Icon name="lock" size={16} /><span>Edits happen on your device. The original stays unchanged in the chat — WHATSMORE sends the edited file as a new version.</span></div>
      </div>
    );
  }
  return (
    <>
      <div className="side-tabs">{tabs.map(([k, l]) => <button key={k} className={st.side === k ? 'on' : ''} data-side={k} onClick={() => setSide(k)}>{l}</button>)}</div>
      {body}
    </>
  );
}

function StudioView({ st }: { st: StudioState }) {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // docHTMLFor() output: escaped demo bodies / sanitised message HTML
    pageRef.current!.innerHTML = st.html;
    refresh();
    let t: ReturnType<typeof setTimeout> | undefined;
    if (st.autoSign) t = setTimeout(studioSign, 50);
    return () => clearTimeout(t);
  }, [st.html, st.autoSign]);
  const status = st.signed
    ? <span className="green">✅ Signed by you · {fmtStamp(st.signed.at)}</span>
    : st.reqFrom ? 'Signature requested by ' + senderName(st.reqFrom) : 'Editing · end-to-end encrypted';
  return (
    <div id="studio" className="studio">
      <header className="studio-head">
        <button className="icon-btn" data-st="close" aria-label="Close" onClick={() => closeStudio()}><Icon name="back" /></button>
        <FileIcon ext={st.ext} />
        <div className="grow"><input id="st-name" className="st-name" defaultValue={st.name} aria-label="File name" /><div className="ci-sub" id="st-status">{status}</div></div>
        <button className="btn sm hide-sm" data-st="download" onClick={() => { resolveAll(false); downloadDoc({ name: (document.getElementById('st-name') as HTMLInputElement).value, ext: st.ext, html: getPage()?.innerHTML || '' }); }}><Icon name="download" size={16} /> Download</button>
        <button className="btn sm" data-st="sign" onClick={studioSign}><Icon name="draw" size={16} /> Sign</button>
        <button className="btn sm primary" data-st="send" onClick={studioSend}><Icon name="send" size={16} /> <span id="st-send-l">{st.reqId || st.signed ? 'Send signed copy' : 'Send'}</span></button>
      </header>
      <div className="studio-tools">
        {TOOLS.map(([k, l]) => <button key={k} className="tool" data-tool={k} title={k} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); runTool(k); }}>{l}</button>)}
        <span className="grow" />
        <button className="btn sm ai" data-st="proof" onClick={proofNow}><Icon name="spell" size={16} /> AI proofread</button>
        <button className="btn sm" data-st="summary" onClick={() => setSide('summary')}><Icon name="sparkle" size={16} /> Summarize</button>
      </div>
      <div className="studio-body">
        <div className="studio-scroll">
          <div
            className="studio-page" id="st-page" ref={pageRef} contentEditable suppressContentEditableWarning spellCheck={false}
            onInput={() => { const s = cur(); if (s) s.dirty = true; renderStudioSide(); }}
            onClick={(e) => {
              const s = (e.target as HTMLElement).closest<HTMLElement>('.sugg');
              if (s) document.querySelector(`#st-side [data-row="${s.dataset.sid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }}
          />
        </div>
        <aside className="studio-side" id="st-side"><Side st={st} /></aside>
      </div>
    </div>
  );
}

/** Always-mounted overlay; renders when ui.studio is set. */
export function Studio() {
  useRender();
  const st = cur();
  if (!st) return null;
  return <StudioView key={st.key} st={st} />;
}
