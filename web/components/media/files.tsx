'use client';
// Files / WHATSMORE Cloud tab: categories, natural-language search, smart folders, Links, duplicate
// clean-up, encrypted backup and the storage meter. Ported from js/sidebar.js + js/cloudplus.js.
import { useEffect, useState } from 'react';
import { S, ui, commit, refresh, useRender } from '@/lib/state';
import { modal, toast, confirmModal } from '@/lib/overlay';
import { act } from '@/lib/registry';
import { openPage } from '@/lib/nav';
import { openChat } from '@/lib/actions';
import { DAY, PLANS, contact, chatTitle, senderName, listTime, fmtTime, fmtSize, fileType } from '@/lib/util';
import type { Chat, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { DocIcon } from '@/components/ui/Avatar';
import { SearchBox } from '@/components/ui/Bits';

export interface FileItem { c: Chat; m: Message; cat: string }

export const FILECATS: [string, string][] = [['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos'], ['documents', 'Documents'], ['receipts', 'Receipts'], ['invoices', 'Invoices'], ['audio', 'Audio'], ['links', 'Links']];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const URL_RE = /https?:\/\/[^\s<]+/g;

function fileCat(m: Message) {
  if (m.type === 'image') return 'photos';
  if (m.type === 'video') return 'videos';
  if (m.type === 'voice') return 'audio';
  if (m.type === 'invoice') return 'invoices';
  const n = String(m.name || '').toLowerCase();
  if (/invoice|inv[-_]/.test(n)) return 'invoices';
  if (/receipt|bill/.test(n)) return 'receipts';
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(n)) return 'audio';
  return 'documents';
}
/** Every file, photo, voice note, invoice and link in unlocked chats, newest first (allFiles). */
export function allFiles(): FileItem[] {
  const out: FileItem[] = [];
  S.chats.forEach((c) => {
    if (c.locked && !ui.unlocked.includes(c.id)) return;
    c.messages.forEach((m) => {
      if (['image', 'video', 'doc', 'voice', 'invoice'].includes(m.type) && !m.cloudDedup) out.push({ c, m, cat: fileCat(m) });
      if (m.type === 'text') (m.text?.match(URL_RE) || []).forEach((u, i) => out.push({ c, m: { id: m.id, type: 'link', name: u, url: u, from: m.from, t: m.t + i, size: 1 }, cat: 'links' }));
    });
  });
  return out.sort((a, b) => b.m.t - a.m.t);
}
export const fileName = (m: Message): string => m.name || (m.type === 'invoice' ? `Invoice_${m.orderId}.pdf` : m.caption || ({ image: 'Photo', video: 'Video', voice: 'Voice message' } as Record<string, string>)[m.type]);
const fileSize = (m: Message): number => m.size || (m.src ? m.src.length * 0.75 : 0) || (m.type === 'voice' ? m.dur * 4000 : 180000);
export function storageUsed() { return allFiles().reduce((s, { m }) => s + fileSize(m), 0); }

export interface FileQuery { cat?: string; month?: number; since?: number; from?: string; words: string[] }
/** Natural-language file search: “invoice Ramesh sent in January”. */
export function parseFileQuery(q: string): FileQuery {
  const s = q.toLowerCase();
  const f: FileQuery = { words: [] };
  const cats: Record<string, RegExp> = { invoices: /\binvoices?\b/, receipts: /\b(receipts?|bills?)\b/, photos: /\b(photos?|pictures?|pics?|images?)\b/, videos: /\bvideos?\b/, audio: /\b(audio|voice|recordings?)\b/, documents: /\b(docs?|documents?|pdfs?|sheets?|spreadsheets?|prd)\b/ };
  for (const [k, re] of Object.entries(cats)) if (re.test(s)) { f.cat = k; break; }
  MONTHS.forEach((mo, i) => { if (new RegExp('\\b(' + mo + '|' + mo.slice(0, 3) + ')\\b').test(s) && !(mo === 'may' && /\bmay (i|be)\b/.test(s))) f.month = i; });
  if (/\btoday\b/.test(s)) f.since = new Date().setHours(0, 0, 0, 0);
  if (/\blast week|this week\b/.test(s)) f.since = Date.now() - 7 * DAY;
  if (/\bi (sent|shared|uploaded)\b/.test(s)) f.from = 'me';
  else for (const p of S.contacts) {
    const fn = p.name.split(' ')[0].toLowerCase().replace(/[^\p{L}]/gu, '');
    if ((fn.length > 1 && new RegExp('\\b' + fn + '\\b', 'u').test(s)) || s.includes('@' + p.username)) { f.from = p.id; break; }
  }
  const stop = new Set('show me the a an that which sent send shared share in on from by find get all my of to for what did i was were with last week this please where is files file give search month year'.split(' '));
  f.words = s.split(/[^\p{L}\p{N}_.-]+/u).filter((w) => w && w.length > 2 && !stop.has(w) && !MONTHS.includes(w) && !MONTHS.some((mo) => mo.slice(0, 3) === w) && !Object.values(cats).some((re) => re.test(w)) && !(f.from && f.from !== 'me' && contact(f.from)?.name.toLowerCase().includes(w)));
  return f;
}

// ---------- smart folders, duplicates
type Folder = [string, string, string, (x: FileItem) => boolean];
const DOC_FOLDERS: Folder[] = ([['aadhaar', '🪪', 'Aadhaar', /aadhaar/i], ['pan', '💳', 'PAN', /\bpan[\s_-]?card|\bpan\b/i], ['education', '🎓', 'Education', /report|marks|certificate|school|college|syllabus|chapter|exam|notes/i], ['business', '💼', 'Business', /invoice|inv[-_]|prd|gst|proposal|contract|audit|checklist|quotation|agreement|deck|security/i], ['bills', '🧾', 'Bills', /bill|receipt|recharge|electricity|water/i]] as [string, string, string, RegExp][])
  .map(([k, e, n, re]) => [k, e, n, (x: FileItem) => re.test(x.m.name || '')]);
const PHOTO_FOLDERS: Folder[] = [
  ['events', '🎉', 'Events', (x) => /birthday|party|wedding|festival|event|🎉|🎂/iu.test(x.m.caption || '')],
  ['family', '🏡', 'Family', (x) => ['ch_family', 'ch_mom'].includes(x.c.id) || /family|mom|amma/i.test(x.m.caption || '')],
  ['travel', '✈️', 'Travel', (x) => /trip|travel|beach|goa|sunset|tank bund|hotel|staying|🏖|🏝|🌅/iu.test((x.m.caption || '') + ' ' + chatTitle(x.c))],
  ['work', '🏢', 'Work', (x) => /project|office|work|team/i.test(chatTitle(x.c) + ' ' + (x.m.caption || ''))],
];
function folderOf(x: FileItem) {
  if (x.cat === 'photos') return PHOTO_FOLDERS.find((f) => f[3](x))?.[0] || null;
  if (['documents', 'receipts', 'invoices'].includes(x.cat)) return DOC_FOLDERS.find((f) => f[3](x))?.[0] || null;
  return null;
}
function findDuplicates() {
  const groups: Record<string, FileItem[]> = {};
  allFiles().filter((x) => x.m.type === 'doc' || (x.m.type === 'image' && x.m.src)).forEach((x) => {
    const k = x.m.type === 'doc' ? `${x.m.name}|${x.m.size}` : `img|${x.m.src.length}|${x.m.src.slice(-40)}`;
    (groups[k] ||= []).push(x);
  });
  return Object.values(groups).filter((g) => g.length > 1);
}
function dedup() {
  const dups = findDuplicates();
  const n = dups.reduce((s, g) => s + g.length - 1, 0);
  confirmModal('Clean up duplicates?', `${n} extra cop${n === 1 ? 'y' : 'ies'} will be removed from WHATSMORE Cloud storage. The newest copy is kept, and messages stay in your chats.`, 'Clean up', () => {
    dups.forEach((g) => g.slice(1).forEach((x) => { const real = x.c.messages.find((mm) => mm.id === x.m.id); if (real) real.cloudDedup = true; }));
    commit(); toast(`Removed ${n} duplicate cop${n === 1 ? 'y' : 'ies'}`);
  }, false);
}
function BackupBody() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let v = 0;
    const iv = setInterval(() => {
      v = Math.min(100, v + 7 + Math.random() * 12);
      setP(v);
      if (v >= 100) { clearInterval(iv); S.backup = { last: Date.now(), size: storageUsed() }; commit(); toast('🔐 Encrypted backup complete'); }
    }, 250);
    return () => clearInterval(iv);
  }, []);
  return (
    <>
      <p className="muted">Backing up chats, photos and documents. Everything is encrypted on this device before upload — not even WHATSMORE can read it.</p>
      <div className="meter big"><div id="bk-bar" style={{ width: p + '%' }} /></div>
      <p className="ci-sub" id="bk-t">{p === 0 ? 'Encrypting…' : p < 100 ? `Encrypting and uploading… ${Math.round(p)}%` : 'Backup complete ✓'}</p>
    </>
  );
}
const backup = () => modal({ title: 'Encrypted backup', body: <BackupBody />, actions: [{ label: 'Hide' }] });
const setFolder = (f: string | null) => { ui.folder = f; refresh(); };

function CloudHome() {
  const files = allFiles();
  const count = (key: string) => files.filter((x) => folderOf(x) === key).length;
  const dups = findDuplicates(), dupBytes = dups.reduce((s, g) => s + g.slice(1).reduce((a, x) => a + fileSize(x.m), 0), 0);
  const b = S.backup || {};
  const tile = ([k, e, n]: Folder) => { const c = count(k); return <button key={k} className="folder" data-act="cfolder" data-f={k} onClick={() => setFolder(k)}><span className="big-emoji">{e}</span><b>{n}</b><span className="ci-sub">{c} file{c === 1 ? '' : 's'}</span></button>; };
  return (
    <>
      <div className="list-label">Smart folders · Documents</div><div className="folder-grid">{DOC_FOLDERS.map(tile)}</div>
      <div className="list-label">Smart folders · Photos</div><div className="folder-grid">{PHOTO_FOLDERS.map(tile)}</div>
      {dups.length ? (
        <div className="cloud-card warn"><span className="big-emoji">🧹</span>
          <div className="grow"><b>{dups.length} duplicate file{dups.length === 1 ? '' : 's'}</b><div className="ci-sub">{dups.map((g) => fileName(g[0].m)).slice(0, 2).join(', ')} · free up {fmtSize(Math.round(dupBytes))}</div></div>
          <button className="btn sm primary" data-act="cdedup" onClick={dedup}>Clean up</button>
        </div>
      ) : null}
      <div className="cloud-card"><span className="big-emoji">🔐</span>
        <div className="grow"><b>Encrypted backup</b><div className="ci-sub">Last backup {b.last ? listTime(b.last) + ' · ' + fmtTime(b.last) : 'never'} · end-to-end encrypted with your key</div></div>
        <button className="btn sm" data-act="cbackup" onClick={backup}>Back up now</button>
      </div>
      <div className="list-label">Recent files</div>
    </>
  );
}

function FileRow({ x }: { x: FileItem }) {
  const { c, m, cat } = x;
  const open = () => { if (ui.drawer === 'starred' && innerWidth <= 1100) ui.drawer = null; openChat(c.id, { mid: m.id }); };
  if (cat === 'links') {
    let host = m.url;
    try { host = new URL(m.url).host; } catch { /* keep raw */ }
    return (
      <div className="file-row" data-act="openmsg" data-chat={c.id} data-mid={m.id} onClick={open}>
        <div className="file-thumb"><div className="mini-ic"><Icon name="link" size={22} /></div></div>
        <div className="ci-body"><div className="ci-name">{host}</div><div className="ci-preview">{m.url} · {senderName(m.from)} · {chatTitle(c)}</div></div>
        <span className="pill">Link</span>
      </div>
    );
  }
  let thumb;
  if (m.type === 'image') thumb = m.src ? <img src={m.src} alt="" /> : <div className="mini-art" style={{ background: m.art?.bg }}>{m.art?.emoji}</div>;
  else if (m.type === 'voice') thumb = <div className="mini-ic"><Icon name="mic" size={22} /></div>;
  else if (m.type === 'video') thumb = <div className="mini-ic"><Icon name="video" size={22} /></div>;
  else if (m.type === 'invoice') thumb = <div className="mini-ic inv"><Icon name="receipt" size={22} /></div>;
  else { const ft = fileType(m.ext); thumb = <DocIcon label={ft.label} color={ft.color} />; }
  return (
    <div className="file-row" data-act="openmsg" data-chat={c.id} data-mid={m.id} onClick={open}>
      <div className="file-thumb">{thumb}</div>
      <div className="ci-body"><div className="ci-name">{fileName(m)}</div><div className="ci-preview">{senderName(m.from)} · {chatTitle(c)} · {new Date(m.t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}{m.size ? ' · ' + fmtSize(m.size) : ''}</div></div>
      <span className="pill">{FILECATS.find((f) => f[0] === cat)?.[1]}</span>
    </div>
  );
}

function FilesList() {
  if (ui.folder) {
    const def = [...DOC_FOLDERS, ...PHOTO_FOLDERS].find((f) => f[0] === ui.folder);
    const items = allFiles().filter((x) => folderOf(x) === ui.folder);
    return (
      <>
        <div className="folder-head"><button className="icon-btn sm" data-act="cfolder" data-f="" aria-label="Back to all files" onClick={() => setFolder(null)}><Icon name="back" size={20} /></button><span className="big-emoji">{def?.[1]}</span><b>{def?.[2]}</b><span className="ci-sub">{items.length} file{items.length === 1 ? '' : 's'} · auto-organised</span></div>
        {items.length ? items.map((x, i) => <FileRow key={x.m.id + ':' + i} x={x} />) : <div className="empty-list">Nothing here yet. WHATSMORE files new documents and photos here automatically.</div>}
      </>
    );
  }
  let items = allFiles();
  let note;
  const q = ui.filesQuery.trim();
  if (q) {
    const f = parseFileQuery(q);
    if (f.cat) items = items.filter((x) => x.cat === f.cat);
    if (f.month != null) items = items.filter((x) => new Date(x.m.t).getMonth() === f.month);
    if (f.from) items = items.filter((x) => x.m.from === f.from);
    if (f.since) items = items.filter((x) => x.m.t >= f.since!);
    if (f.words.length) {
      const w = items.filter((x) => f.words.some((wd) => (fileName(x.m) + ' ' + chatTitle(x.c)).toLowerCase().includes(wd)));
      if (w.length || (!f.cat && f.month == null && !f.from)) items = w;
    }
    const parts: string[] = [];
    if (f.cat) parts.push(FILECATS.find((c) => c[0] === f.cat)![1]);
    if (f.from) parts.push('from ' + senderName(f.from));
    if (f.month != null) parts.push('in ' + MONTHS[f.month][0].toUpperCase() + MONTHS[f.month].slice(1));
    if (f.since) parts.push('recent');
    if (f.words.length) parts.push('“' + f.words.join(' ') + '”');
    note = <div className="ai-note"><Icon name="sparkle" size={16} /><span>Smart search understood: <b>{parts.join(' · ') || q}</b> — {items.length} result{items.length === 1 ? '' : 's'}</span></div>;
  } else {
    note = (
      <>
        <div className="examples">{['Invoice Ramesh sent in January', 'Photos from Ananya', 'Receipts', 'PRD Siva shared'].map((e) => <button key={e} className="chip" data-act="fileq" data-q={e} onClick={() => { ui.filesQuery = e; refresh(); }}><Icon name="sparkle" size={14} /> {e}</button>)}</div>
        {ui.filesCat === 'all' ? <CloudHome /> : null}
      </>
    );
  }
  if (ui.filesCat !== 'all') items = items.filter((x) => x.cat === ui.filesCat);
  return <>{note}{items.length ? items.map((x, i) => <FileRow key={x.m.id + ':' + i} x={x} />) : <div className="empty-list">No files found</div>}</>;
}

export function FilesTab() {
  useRender();
  const used = storageUsed(), plan = PLANS[S.settings.plan] || PLANS.free;
  return (
    <>
      <header className="side-head"><h2>Files</h2>
        <div className="head-actions">
          <button className="icon-btn" data-act="cloudupload" title="Upload any file" aria-label="Upload any file" onClick={() => act.cloudUpload()}><Icon name="upload" /></button>
          <button className="pill clickable" data-act="page" data-page="set-storage" onClick={() => openPage('set-storage')}>{plan.name} plan</button>
        </div>
      </header>
      <div className="side-tools">
        <div className="storage"><div className="storage-top"><span><Icon name="cloud" size={18} /> WHATSMORE Cloud</span><span>{fmtSize(used)} of {plan.quota}</span></div><div className="meter"><div style={{ width: Math.max(2, (used / plan.bytes) * 100) + '%' }} /></div></div>
        <SearchBox id="files-search" ph="Ask: “invoice Ramesh sent in January”" value={ui.filesQuery} onChange={(v) => { ui.filesQuery = v; refresh(); }} />
        <div className="chips">{FILECATS.map(([k, l]) => <button key={k} className={`chip ${ui.filesCat === k ? 'on' : ''}`} data-act="filescat" data-f={k} onClick={() => { ui.filesCat = k; refresh(); }}>{l}</button>)}</div>
      </div>
      <div className="side-scroll" id="files-list"><FilesList /></div>
    </>
  );
}
