// Documents: any file type, document viewer, Document Studio (edit + AI correction) and digital signatures
'use strict';

const extOf = (name) => (String(name).includes('.') ? String(name).split('.').pop().toLowerCase() : 'file');
const withSuffix = (name, suffix) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? `${name.slice(0, i)}_${suffix}${name.slice(i)}` : `${name}_${suffix}`;
};
const fmtStamp = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const sigId = () => 'WM-SIG-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
function readDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // file:// in some browsers has no crypto.subtle
    let h = '';
    for (let i = 0; i < 8; i++) h += (hash(i + ':' + text) >>> 0).toString(16).padStart(8, '0');
    return h;
  }
}
const htmlText = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.replace(/\s+/g, ' ').trim();
};

// ---------- sending any file type
async function sendFiles(ch, files) {
  let last;
  for (const f of files) {
    const ext = extOf(f.name),
      t = fileType(ext);
    const url = URL.createObjectURL(f);
    ui.blobs.add(url);
    const m = { type: 'doc', name: f.name, size: f.size, ext, url };
    try {
      if (t.kind === 'text' && f.size < 300000) m.content = await f.text();
      else if ((t.kind === 'image' || ext === 'pdf') && f.size < 350000) m.data = await readDataURL(f);
    } catch (e) {
      /* preview only */
    }
    last = sendMsg(ch, m);
  }
  if (files.length > 1) toast(`Sent ${files.length} files`);
  if (last) scheduleReply(ch, last);
}
function cloudChat() {
  let ch = chatById('ch_cloud');
  if (!ch) {
    ch = { id: 'ch_cloud', type: 'group', name: 'My Cloud ☁️', emoji: '☁️', color: '#0288d1', members: [], admins: ['me'], self: true, unread: 0, description: 'Only you · files saved here sync to all your linked devices', messages: [{ id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'Files you save here are end-to-end encrypted and synced to your linked devices.' }] };
    S.chats.push(ch);
  }
  return ch;
}
XA.cloudupload = async () => {
  const inp = $('#file-any');
  inp.multiple = true;
  const files = await pickFile('file-any');
  if (!files.length) return;
  await sendFiles(cloudChat(), files);
  toast(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''} to WHATSMORE Cloud`);
  renderSidebar();
};

// Drag & drop any file onto an open chat
document.addEventListener('dragover', (e) => {
  if (!ui.active || !e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  main.classList.add('dropping');
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || !main.contains(e.relatedTarget)) main.classList.remove('dropping');
});
document.addEventListener('drop', (e) => {
  main.classList.remove('dropping');
  if (!ui.active || !e.dataTransfer?.files?.length) return;
  e.preventDefault();
  sendFiles(chatById(ui.active), [...e.dataTransfer.files]);
});

// ---------- demo document bodies (seeded files have no real bytes)
function demoDocHTML(m) {
  const n = m.name.toLowerCase();
  if (/prd/.test(n))
    return `<h1>WHATSMORE — Product Requirments Document v2</h1><p><b>Owner:</b> Siva · <b>Status:</b> Draft for review</p>
<h2>1. Vision</h2><p>WHATSMORE is more then a chat app. it combines chat , AI, payments and business in one secure platform.</p>
<h2>2. MVP scope</h2><ul><li>Private chat with end-to-end encyption</li><li>Voice and video calls with call links</li><li>Groups with no participant limit</li><li>Username based connection so users dont need to share there phone number</li></ul>
<h2>3. Timeline</h2><p>Designs will be ready untill Friday. The the beta release is planned for december. Every team member must recieve the final PRD before the investor demo on monday at 4 PM.</p>
<h2>4. Security</h2><p>Signal protocol for 1:1 chats and Sender Keys for groups. An independant security audit is neccessary before launch .</p>`;
  if (/agreement|contract|nda/.test(n)) return agreementHTML();
  if (/invoice/.test(n)) {
    const no = (m.name.match(/INV-\d+/i) || ['INV-1001'])[0];
    return `<h1>Invoice ${esc(no)}</h1><p><b>From:</b> Ramesh Kumar · Freelance web developer<br><b>To:</b> ${esc(S.me.name)}<br><b>Date:</b> ${new Date(m.t || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr><tr><td>Website design &amp; development</td><td>1</td><td>₹15,000</td></tr><tr><td>Hosting setup</td><td>1</td><td>₹2,000</td></tr><tr><td>Maintenance (1 month)</td><td>1</td><td>₹1,500</td></tr><tr><td><b>Total</b></td><td></td><td><b>₹18,500</b></td></tr></table>
<p>Please pay via WHATSMORE Pay to @ramesh_k. Thank you for your buisness!</p>`;
  }
  if (/receipt|bill/.test(n))
    return `<h1>Booking Receipt</h1><p><b>Sea Breeze Villa, Goa</b><br>Check-in: Saturday 10 Oct · Check-out: Monday 12 Oct · 4 guests</p>
<table><tr><th>Description</th><th>Amount</th></tr><tr><td>Villa · 2 nights</td><td>₹11,000</td></tr><tr><td>Taxes &amp; fees</td><td>₹1,000</td></tr><tr><td><b>Total paid</b></td><td><b>₹12,000</b></td></tr></table><p>Payment status: PAID · Booking ID GOA-77812</p>`;
  if (fileType(m.ext).kind === 'sheet' || /checklist/.test(n))
    return `<h1>${esc(m.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '))}</h1>
<table><tr><th>#</th><th>Check</th><th>Owner</th><th>Status</th></tr><tr><td>1</td><td>End-to-end encryption review</td><td>Arjun</td><td>✅ Done</td></tr><tr><td>2</td><td>Penetration testing</td><td>External</td><td>⏳ Scheduled</td></tr><tr><td>3</td><td>Key management &amp; backups</td><td>Arjun</td><td>⏳ In progress</td></tr><tr><td>4</td><td>Rate limiting &amp; anti-bot</td><td>Siva</td><td>⬜ To do</td></tr><tr><td>5</td><td>Privacy dashboard audit</td><td>Ananya</td><td>⬜ To do</td></tr></table>`;
  return `<h1>${esc(m.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))}</h1><p>This ${esc(fileType(m.ext).label)} file was shared on WHATSMORE. In production the original file is opened here; text is extracted (with OCR for scans) so it can be read, corrected and signed.</p><p>Type or paste content here to edit it.</p>`;
}
function agreementHTML() {
  return `<h1>Freelance Services Agreement</h1><p>This Agreement is made between <b>${esc(S.me.name)}</b> (@${esc(S.me.username)}, “Client”) and <b>Ramesh Kumar</b> (@ramesh_k, “Developer”).</p>
<h2>1. Scope of work</h2><p>The Developer will design and develop the WHATSMORE marketing website, including 6 pages, a blog and a contact form.</p>
<h2>2. Fees &amp; payment</h2><p>The total fee is ₹45,000, payable in two instalments: 50% on signing and 50% on delivery, through WHATSMORE Pay.</p>
<h2>3. Timeline</h2><p>Delivery within 30 days from the date of signing.</p>
<h2>4. Confidentiality</h2><p>Both parties will keep all project infomation confidential.</p>
<h2>5. Signatures</h2>
${typedSigBlock('Ramesh Kumar', 'ramesh_k', Date.now() - 2 * HOUR, 'WM-SIG-R4M3-K8QX')}
<div class="sig-slot" data-for="me" contenteditable="false">Client signature — click <b>Sign</b> to sign here</div>`;
}
function typedSigBlock(name, username, at, id) {
  return `<div class="sig-block" contenteditable="false"><div class="sig-typed">${esc(name)}</div><div class="sig-name">${esc(name)} · @${esc(username)}</div><div class="sig-meta">Digitally signed · ${fmtStamp(at)} · ${esc(id)}</div></div>`;
}
function imgSigBlock(img, at, id) {
  return `<div class="sig-block" contenteditable="false"><img src="${img}" alt="Signature"><div class="sig-name">${esc(S.me.name)} · @${esc(S.me.username)}</div><div class="sig-meta">Digitally signed · ${fmtStamp(at)} · ${esc(id)}</div></div>`;
}
function textToHTML(text, ext) {
  if (ext === 'csv' || ext === 'tsv') {
    const rows = text
      .trim()
      .split(/\r?\n/)
      .slice(0, 200)
      .map((r) => r.split(ext === 'tsv' ? '\t' : ','));
    return `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`;
  }
  if (fileType(ext).kind === 'text' && !['txt', 'md', 'log'].includes(ext)) return `<pre>${esc(text)}</pre>`;
  return text
    .split(/\n{2,}/)
    .map((p) => (/^#\s/.test(p) ? `<h1>${esc(p.replace(/^#\s/, ''))}</h1>` : /^##\s/.test(p) ? `<h2>${esc(p.replace(/^##\s/, ''))}</h2>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`))
    .join('');
}
const docHTMLFor = (m) => m.html || (m.content != null ? textToHTML(m.content, m.ext) : demoDocHTML(m));

// ---------- viewer
function previewHTML(m) {
  const kind = fileType(m.ext).kind,
    src = m.data || (m.url && ui.blobs.has(m.url) ? m.url : null);
  if (m.html || m.content != null) return `<div class="doc-page">${docHTMLFor(m)}</div>`;
  if (src && kind === 'image') return `<img class="dv-img" src="${src}" alt="">`;
  if (src && m.ext === 'pdf') return `<iframe class="dv-frame" src="${src}" title="${esc(m.name)}"></iframe>`;
  if (src && kind === 'audio') return `<div class="dv-center">${docIconHTML(m.ext, 'big')}<audio src="${src}" controls></audio></div>`;
  if (src && kind === 'video') return `<video class="dv-img" src="${src}" controls playsinline></video>`;
  if (src) return `<div class="dv-center">${docIconHTML(m.ext, 'big')}<div class="ci-name">${esc(m.name)}</div><p class="muted small">${esc(fileType(m.ext).label)} file · ${fmtSize(m.size || 0)} — open it with an app on your device.</p></div>`;
  return `<div class="doc-page">${demoDocHTML(m)}</div>`;
}
function openDocViewer(m, ch) {
  const real = ch && ch.messages.includes(m);
  const editable = !['image', 'audio', 'video', 'archive', 'app', 'cad', 'design'].includes(fileType(m.ext).kind);
  modal({
    title: m.name,
    cls: 'xwide',
    body: `<div class="dv">${previewHTML(m)}</div>
      <div class="dv-meta">${docIconHTML(m.ext)}<div class="grow"><div class="ci-name">${esc(m.name)}</div><div class="ci-sub">${esc(fileType(m.ext).label)} · ${fmtSize(m.size || (m.html || '').length)}${m.from ? ' · ' + esc(senderName(m.from)) : ''}${m.t ? ' · ' + fmtStamp(m.t) : ''}</div>
        <div class="ci-sub">${icon('lock', 12)} End-to-end encrypted · saved in WHATSMORE Cloud${m.corrected ? ` · ✓ AI-corrected (${m.corrected} fixes)` : ''}</div></div></div>
      ${m.signed ? `<div class="sig-banner" data-cert>${icon('verified', 18)}<span class="grow">Digitally signed by <b>${esc(senderName(m.signed.by))}</b> · ${fmtStamp(m.signed.at)}</span><span class="link-btn">Certificate</span></div>` : ''}`,
    actions: [
      {
        label: 'Download',
        onClick: () => {
          downloadDoc(m);
          return false;
        },
      },
      (m.html || m.content != null || !m.url) && {
        label: 'Print / PDF',
        onClick: () => {
          printDoc(m);
          return false;
        },
      },
      real && { label: 'Forward', onClick: () => setTimeout(() => forwardModal(m), 0) },
      editable && { label: 'Sign', onClick: () => setTimeout(() => openStudio({ ch, src: m, sign: true }), 0) },
      editable && { label: 'Edit & AI-correct', primary: true, onClick: () => setTimeout(() => openStudio({ ch, src: m }), 0) },
    ].filter(Boolean),
    onMount: (root) => root.querySelector('[data-cert]')?.addEventListener('click', () => signCertModal(m)),
  });
}
function docFileHTML(m) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.name)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}.sig-block{border-top:1px solid #999;margin-top:24px;padding-top:8px;max-width:320px}.sig-block img{max-height:70px}.sig-typed{font:32px "Segoe Script","Brush Script MT",cursive;color:#1a3d8f}.sig-name{font-weight:bold}.sig-meta{font-size:12px;color:#555}.sig-slot{display:none}</style></head><body>${docHTMLFor(m)}${m.signed ? `<hr><p style="font-size:12px;color:#555">Digitally signed on WHATSMORE · ${esc(m.signed.id)} · SHA-256 ${esc(m.signed.hash)}</p>` : ''}</body></html>`;
}
function downloadDoc(m) {
  const a = document.createElement('a');
  const src = m.url && ui.blobs.has(m.url) && !m.html ? m.url : m.data && !m.html ? m.data : null;
  if (src) {
    a.href = src;
    a.download = m.name;
    a.click();
    return;
  }
  const word = ['doc', 'docx', 'odt', 'rtf'].includes(m.ext);
  const text = m.content != null && !m.html;
  const blob = new Blob([text ? m.content : docFileHTML(m)], { type: text ? 'text/plain' : word ? 'application/msword' : 'text/html' });
  a.href = URL.createObjectURL(blob);
  a.download = text ? m.name : word ? m.name.replace(/\.[^.]+$/, '') + '.doc' : m.name.replace(/\.[^.]+$/, '') + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printDoc(m) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print or save as PDF');
  w.document.write(docFileHTML(m));
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// ---------- AI proofreading
const TYPOS = {
  recieve: 'receive',
  recieved: 'received',
  teh: 'the',
  requirments: 'requirements',
  adress: 'address',
  seperate: 'separate',
  occured: 'occurred',
  untill: 'until',
  wich: 'which',
  definately: 'definitely',
  accomodate: 'accommodate',
  goverment: 'government',
  enviroment: 'environment',
  begining: 'beginning',
  calender: 'calendar',
  comittee: 'committee',
  managment: 'management',
  buisness: 'business',
  sucessful: 'successful',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  reccomend: 'recommend',
  acheive: 'achieve',
  beleive: 'believe',
  independant: 'independent',
  neccessary: 'necessary',
  necesary: 'necessary',
  occassion: 'occasion',
  relevent: 'relevant',
  responsibilty: 'responsibility',
  truely: 'truly',
  writting: 'writing',
  alot: 'a lot',
  infomation: 'information',
  informations: 'information',
  securty: 'security',
  privcy: 'privacy',
  encyption: 'encryption',
  aggrement: 'agreement',
  paymnet: 'payment',
  recomend: 'recommend',
  succesful: 'successful',
  untill_: 'until',
  freind: 'friend',
  thier: 'their',
  wether: 'whether',
  reciept: 'receipt',
  instalment_: 'instalment',
};
const CONTRACT = { dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", havent: "haven't", shouldnt: "shouldn't", couldnt: "couldn't", wouldnt: "wouldn't" };
const matchCase = (src, to) => (src[0] === src[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
const PROOF_RULES = [
  {
    kind: 'Spelling',
    re: new RegExp(
      '\\b(' +
        Object.keys(TYPOS)
          .filter((k) => !k.endsWith('_'))
          .join('|') +
        ')\\b',
      'gi',
    ),
    fix: (m) => matchCase(m, TYPOS[m.toLowerCase()]),
  },
  { kind: 'Grammar', re: /\b(\w+)\s+\1\b/gi, fix: (m, a) => (isNaN(a) ? m.slice(0, a.length) : m) },
  { kind: 'Grammar', re: /\bmore then\b/gi, fix: (m) => matchCase(m, 'more than') },
  { kind: 'Grammar', re: /\bshare there\b/gi, fix: () => 'share their' },
  { kind: 'Grammar', re: /\b(could|should|would|must) of\b/gi, fix: (m, a) => a + ' have' },
  { kind: 'Grammar', re: new RegExp('\\b(' + Object.keys(CONTRACT).join('|') + ')\\b', 'gi'), fix: (m) => matchCase(m, CONTRACT[m.toLowerCase()]) },
  { kind: 'Capitalisation', re: /(?<=^|\s)i(?=[\s',.!?])/g, fix: () => 'I' },
  { kind: 'Capitalisation', re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|august|september|october|november|december)\b/g, fix: (m) => m[0].toUpperCase() + m.slice(1) },
  { kind: 'Capitalisation', re: /(?<=[.!?]\s+)[a-z]/g, fix: (m) => m.toUpperCase() },
  { kind: 'Punctuation', re: /[  ]+(?=[,.!?;:](\s|$))/g, fix: () => '' },
  { kind: 'Punctuation', re: / {2,}/g, fix: () => ' ' },
];
function proofread(page) {
  const out = [];
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.sig-block, .sig-slot, .sugg, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const text = node.nodeValue;
    let hits = [];
    PROOF_RULES.forEach((r) => {
      r.re.lastIndex = 0;
      let mm;
      while ((mm = r.re.exec(text))) {
        if (!mm[0].length) {
          r.re.lastIndex++;
          continue;
        }
        const to = r.fix(...mm);
        if (to !== mm[0]) hits.push({ start: mm.index, end: mm.index + mm[0].length, from: mm[0], to, kind: r.kind });
      }
    });
    hits.sort((a, b) => a.start - b.start);
    hits = hits.filter((h, i, arr) => !arr.slice(0, i).some((p) => p.end > h.start && p.start < h.end));
    if (!hits.length) return;
    const frag = document.createDocumentFragment();
    let pos = 0;
    hits.forEach((h) => {
      frag.appendChild(document.createTextNode(text.slice(pos, h.start)));
      const id = 's' + uid();
      const span = document.createElement('span');
      span.className = 'sugg';
      span.dataset.sid = id;
      span.contentEditable = 'false';
      span.innerHTML = `<del>${esc(h.from).replace(/ /g, '␣')}</del><ins>${esc(h.to)}</ins>`;
      frag.appendChild(span);
      out.push({ id, ...h });
      pos = h.end;
    });
    frag.appendChild(document.createTextNode(text.slice(pos)));
    node.replaceWith(frag);
  });
  return out;
}

// ---------- Document Studio
function openStudio({ ch, src = null, req = null, blank = false, sign = false }) {
  closeAllModals();
  const base = src || req?.doc;
  const name = blank ? 'Untitled document.docx' : base.name;
  ui.studio = { chId: (ch || chatById(ui.active))?.id || null, srcId: src?.id || null, reqId: req?.id || null, name, ext: extOf(name), signed: null, sugg: [], fixed: 0, dirty: false, side: 'review' };
  const el = document.createElement('div');
  el.id = 'studio';
  el.className = 'studio';
  el.innerHTML = `<header class="studio-head">
      <button class="icon-btn" data-st="close" aria-label="Close">${icon('back')}</button>
      ${docIconHTML(ui.studio.ext)}<div class="grow"><input id="st-name" class="st-name" value="${esc(name)}" aria-label="File name"><div class="ci-sub" id="st-status">${req ? 'Signature requested by ' + esc(senderName(req.from)) : 'Editing · end-to-end encrypted'}</div></div>
      <button class="btn sm hide-sm" data-st="download">${icon('download', 16)} Download</button>
      <button class="btn sm" data-st="sign">${icon('draw', 16)} Sign</button>
      <button class="btn sm primary" data-st="send">${icon('send', 16)} <span id="st-send-l">${req ? 'Send signed copy' : 'Send'}</span></button>
    </header>
    <div class="studio-tools">
      ${[
        ['bold', '<b>B</b>'],
        ['italic', '<i>I</i>'],
        ['underline', '<u>U</u>'],
        ['hilite', '<span class="hl">H</span>'],
        ['h1', 'H1'],
        ['h2', 'H2'],
        ['ul', '• List'],
        ['undo', '↶'],
        ['redo', '↷'],
      ]
        .map(([k, l]) => `<button class="tool" data-tool="${k}" title="${k}">${l}</button>`)
        .join('')}
      <span class="grow"></span>
      <button class="btn sm ai" data-st="proof">${icon('spell', 16)} AI proofread</button>
      <button class="btn sm" data-st="summary">${icon('sparkle', 16)} Summarize</button>
    </div>
    <div class="studio-body"><div class="studio-scroll"><div class="studio-page" id="st-page" contenteditable="true" spellcheck="false"></div></div><aside class="studio-side" id="st-side"></aside></div>`;
  overlayRoot.appendChild(el);
  const page = $('#st-page');
  page.innerHTML = blank ? '<h1>Untitled document</h1><p>Start typing here…</p>' : docHTMLFor(base);
  page.addEventListener('input', () => {
    ui.studio.dirty = true;
    renderStudioSide();
  });
  page.addEventListener('click', (e) => {
    const s = e.target.closest('.sugg');
    if (s) $(`#st-side [data-row="${s.dataset.sid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  el.addEventListener('click', studioClick);
  renderStudioSide();
  if (sign) setTimeout(studioSign, 50);
}
function renderStudioSide() {
  const st = ui.studio,
    side = $('#st-side');
  if (!st || !side) return;
  const page = $('#st-page');
  const words = (page.textContent.match(/\S+/g) || []).length;
  const pending = st.sugg.filter((s) => $(`.sugg[data-sid="${s.id}"]`, page));
  let html = `<div class="side-tabs">${[
    ['review', 'AI review'],
    ['summary', 'Summary'],
    ['details', 'Details'],
  ]
    .map(([k, l]) => `<button class="${st.side === k ? 'on' : ''}" data-side="${k}">${l}</button>`)
    .join('')}</div>`;
  if (st.side === 'review') {
    if (!st.proofed) html += `<div class="side-empty">${icon('spell', 36)}<p>Let WHATSMORE AI check spelling, grammar, capitalisation and punctuation.</p><button class="btn primary" data-st="proof">${icon('sparkle', 16)} Run AI proofread</button></div>`;
    else if (!pending.length) html += `<div class="side-empty ok">${icon('check', 36)}<p><b>All clear.</b> ${st.fixed} correction${st.fixed === 1 ? '' : 's'} applied.</p><button class="btn" data-st="proof">Check again</button></div>`;
    else {
      const by = {};
      pending.forEach((s) => {
        by[s.kind] = (by[s.kind] || 0) + 1;
      });
      html += `<div class="side-sum"><b>${pending.length} suggestion${pending.length === 1 ? '' : 's'}</b><div class="ci-sub">${Object.entries(by)
        .map(([k, v]) => `${v} ${k.toLowerCase()}`)
        .join(' · ')}</div>
        <div class="btn-row left"><button class="btn sm primary" data-st="acceptall">Accept all</button><button class="btn sm" data-st="rejectall">Reject all</button></div></div>
        ${pending.map((s) => `<div class="sugg-row" data-row="${s.id}"><span class="pill">${s.kind}</span><div class="sugg-txt"><del>${esc(s.from).replace(/ /g, '␣') || '␣'}</del> → <ins>${esc(s.to) || '(remove)'}</ins></div><button class="icon-btn sm ok" data-acc="${s.id}" aria-label="Accept">${icon('check', 18)}</button><button class="icon-btn sm" data-rej="${s.id}" aria-label="Reject">${icon('close', 18)}</button></div>`).join('')}`;
    }
  } else if (st.side === 'summary') {
    const s = summarizeDoc(page);
    html += `<div class="side-pad"><div class="stat-row"><div><b>${words}</b><span>words</span></div><div><b>${Math.max(1, Math.round(words / 200))} min</b><span>read</span></div><div><b>${s.sections}</b><span>sections</span></div></div>
      <div class="sum-title">${icon('sparkle', 14)} AI summary</div><p class="small">${esc(s.summary)}</p>
      ${s.points.length ? `<div class="sum-title">📌 Key points</div><ul class="small">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${s.dates.length ? `<div class="sum-title">📅 Dates &amp; deadlines</div><ul class="small">${s.dates.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>`;
  } else {
    html += `<div class="side-pad small"><div class="kv"><span>File</span><b>${esc(st.name)}</b></div><div class="kv"><span>Type</span><b>${esc(fileType(st.ext).label)}</b></div><div class="kv"><span>Words</span><b>${words}</b></div>
      <div class="kv"><span>AI fixes applied</span><b>${st.fixed}</b></div><div class="kv"><span>Signature</span><b>${st.signed ? '✅ Signed ' + fmtStamp(st.signed.at) : 'Not signed'}</b></div>
      <div class="kv"><span>Version</span><b>${st.srcId ? 'New version of original' : 'New document'}</b></div>
      <div class="hint-box flat">${icon('lock', 16)}<span>Edits happen on your device. The original stays unchanged in the chat — WHATSMORE sends the edited file as a new version.</span></div></div>`;
  }
  side.innerHTML = html;
}
function summarizeDoc(page) {
  const blocks = $$('p, li, td', page)
    .map((b) => b.textContent.trim())
    .filter((t) => t.length > 20);
  const sentences = blocks
    .flatMap((b) => b.match(/[^.!?]+[.!?]?/g) || [])
    .map((x) => x.trim())
    .filter((x) => x.length > 15);
  const title = $('h1', page)?.textContent.trim() || ui.studio?.name || 'Document';
  return {
    sections: Math.max(1, $$('h2', page).length),
    summary: `“${title}” — ${sentences.slice(0, 2).join(' ') || 'Short document.'}`,
    points: sentences.filter((x) => /₹|\d+%|\bmust\b|\bwill\b|\bshall\b|\bneed|scope|total/i.test(x)).slice(0, 5),
    dates: sentences.filter((x) => /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|\d+ days|\d{1,2}\s?(am|pm))\b/i.test(x)).slice(0, 4),
  };
}
function resolveSugg(id, accept) {
  const span = $(`#st-page .sugg[data-sid="${id}"]`),
    s = ui.studio.sugg.find((x) => x.id === id);
  if (!span || !s) return;
  span.replaceWith(document.createTextNode(accept ? s.to : s.from));
  if (accept) ui.studio.fixed++;
  ui.studio.dirty = true;
}
function resolveAll(accept) {
  ui.studio.sugg.forEach((s) => resolveSugg(s.id, accept));
  $('#st-page').normalize();
  renderStudioSide();
}
function studioClick(e) {
  const st = ui.studio;
  const side = e.target.closest('[data-side]');
  if (side) {
    st.side = side.dataset.side;
    return renderStudioSide();
  }
  const acc = e.target.closest('[data-acc]'),
    rej = e.target.closest('[data-rej]');
  if (acc || rej) {
    resolveSugg((acc || rej).dataset[acc ? 'acc' : 'rej'], !!acc);
    $('#st-page').normalize();
    return renderStudioSide();
  }
  const tool = e.target.closest('[data-tool]');
  if (tool) {
    e.preventDefault();
    $('#st-page').focus();
    const t = tool.dataset.tool;
    const cmd = { bold: ['bold'], italic: ['italic'], underline: ['underline'], hilite: ['hiliteColor', '#fff59d'], h1: ['formatBlock', 'h1'], h2: ['formatBlock', 'h2'], ul: ['insertUnorderedList'], undo: ['undo'], redo: ['redo'] }[t];
    document.execCommand(cmd[0], false, cmd[1]);
    st.dirty = true;
    return;
  }
  const b = e.target.closest('[data-st]');
  if (!b) return;
  const act = b.dataset.st;
  if (act === 'close') return closeStudio();
  if (act === 'proof') {
    resolveAll(false);
    st.sugg = proofread($('#st-page'));
    st.proofed = true;
    st.side = 'review';
    renderStudioSide();
    toast(st.sugg.length ? `✨ AI found ${st.sugg.length} correction${st.sugg.length > 1 ? 's' : ''}` : '✨ No issues found');
  }
  if (act === 'summary') {
    st.side = 'summary';
    renderStudioSide();
  }
  if (act === 'acceptall') {
    resolveAll(true);
    toast('All corrections applied');
  }
  if (act === 'rejectall') resolveAll(false);
  if (act === 'sign') studioSign();
  if (act === 'download') {
    resolveAll(false);
    downloadDoc({ name: $('#st-name').value, ext: st.ext, html: $('#st-page').innerHTML });
  }
  if (act === 'send') studioSend();
}
function closeStudio(force) {
  const st = ui.studio;
  if (!force && st && (st.dirty || st.signed)) return confirmModal('Discard changes?', 'Your edits and signature have not been sent yet.', 'Discard', () => closeStudio(true));
  $('#studio')?.remove();
  ui.studio = null;
}
function studioSign() {
  const st = ui.studio;
  if (st.signed) return toast('Already signed — send it or close to discard');
  signaturePad((sig) => {
    const page = $('#st-page');
    st.signed = { at: Date.now(), id: sigId(), mode: sig.mode };
    const html = imgSigBlock(sig.img, st.signed.at, st.signed.id);
    const slot = $('.sig-slot[data-for="me"]', page);
    if (slot) slot.outerHTML = html;
    else page.insertAdjacentHTML('beforeend', html);
    page.lastElementChild?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    $('#st-status').innerHTML = `<span class="green">✅ Signed by you · ${fmtStamp(st.signed.at)}</span>`;
    $('#st-send-l').textContent = 'Send signed copy';
    renderStudioSide();
    toast('✍️ Signature added — the document will be sealed when you send it');
  });
}
async function studioSend() {
  const st = ui.studio;
  resolveAll(false);
  const page = $('#st-page');
  $$('.sig-slot', page).forEach((s) => s.remove());
  let name = $('#st-name').value.trim() || st.name;
  if (st.signed && !/signed/i.test(name)) name = withSuffix(name, 'signed');
  else if (!st.signed && st.fixed && st.srcId && !/corrected/i.test(name)) name = withSuffix(name, 'corrected');
  const html = page.innerHTML,
    text = htmlText(html);
  const h = await sha256(text);
  const msg = { type: 'doc', name, ext: extOf(name), size: new Blob([html]).size, html, pages: Math.max(1, Math.round(text.length / 2200)), corrected: st.fixed || 0, versionOf: st.srcId };
  if (st.signed) msg.signed = { by: 'me', at: st.signed.at, id: st.signed.id, hash: h };
  const deliver = (ch) => {
    const sent = sendMsg(ch, msg);
    const req = st.reqId && ch.messages.find((x) => x.id === st.reqId);
    if (req && st.signed) {
      req.status = 'signed';
      req.signedBy = [{ id: 'me', at: st.signed.at, sigId: st.signed.id }];
      req.hash = h;
      req.signedMid = sent.id;
      save();
      if (ch.id === ui.active) renderMessages();
      simulateIncoming(ch, req.from, 'Thank you! Received the signed copy ✅ I will start the work today 🙏', 1200);
    } else scheduleReply(ch, sent);
    closeStudio(true);
    if (ui.active !== ch.id) openChat(ch.id);
    toast(st.signed ? '✍️ Signed document sent · sealed with SHA-256' : 'Document sent');
  };
  const ch = chatById(st.chId);
  if (ch) deliver(ch);
  else chatPicker('Send document to…', (chats) => deliver(chats[0]), { single: true });
}

// ---------- signature pad
function signaturePad(cb) {
  let mode = S.signature ? 'saved' : 'draw',
    ink = false,
    ctx,
    cvs;
  const tabs = [['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload'], ...(S.signature ? [['saved', 'Saved']] : [])];
  const FONTS = ['"Segoe Script","Brush Script MT",cursive', '"Lucida Handwriting","Apple Chancery",cursive', 'Georgia,serif'];
  let font = 0;
  modal({
    title: 'Add your signature',
    body: `<div class="side-tabs pad0">${tabs.map(([k, l]) => `<button data-mode="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="sig-pad-wrap"><canvas id="sig-cvs" width="760" height="260"></canvas><img id="sig-saved" alt="Saved signature" hidden></div>
      <div id="sig-opts"></div>
      <label class="radio-row"><input type="checkbox" id="sig-keep" checked> Save this signature for next time</label>
      <p class="muted small">${icon('shield', 14)} Your signature is sealed with a SHA-256 fingerprint, time-stamp and your verified @username. Production builds can use Aadhaar eSign / DSC for legally binding signatures under the IT Act, 2000.</p>`,
    actions: [
      {
        label: 'Clear',
        onClick: () => {
          clear();
          return false;
        },
      },
      { label: 'Cancel' },
      {
        label: 'Sign document',
        primary: true,
        onClick: () => {
          let img;
          if (mode === 'saved') img = S.signature.img;
          else {
            if (!ink) {
              toast(mode === 'type' ? 'Type your name' : 'Draw your signature first');
              return false;
            }
            img = cvs.toDataURL('image/png');
          }
          if ($('#sig-keep').checked && mode !== 'saved') {
            S.signature = { img, mode };
            save();
          }
          cb({ img, mode });
        },
      },
    ],
    onMount: (root) => {
      cvs = $('#sig-cvs', root);
      ctx = cvs.getContext('2d');
      let down = false,
        last;
      const pos = (e) => {
        const r = cvs.getBoundingClientRect();
        return [((e.clientX - r.left) * cvs.width) / r.width, ((e.clientY - r.top) * cvs.height) / r.height];
      };
      cvs.addEventListener('pointerdown', (e) => {
        if (mode !== 'draw') return;
        down = true;
        last = pos(e);
        cvs.setPointerCapture(e.pointerId);
      });
      cvs.addEventListener('pointermove', (e) => {
        if (!down) return;
        const p = pos(e);
        ctx.strokeStyle = $('#sig-ink', root)?.value || '#1a3d8f';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(...last);
        ctx.lineTo(...p);
        ctx.stroke();
        last = p;
        ink = true;
      });
      cvs.addEventListener('pointerup', () => {
        down = false;
      });
      root.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-mode]');
        if (t) {
          mode = t.dataset.mode;
          $$('[data-mode]', root).forEach((b) => b.classList.toggle('on', b === t));
          setup();
        }
        const f = e.target.closest('[data-font]');
        if (f) {
          font = +f.dataset.font;
          drawTyped();
          $$('[data-font]', root).forEach((b) => b.classList.toggle('on', b === f));
        }
        if (e.target.closest('#sig-up')) {
          const files = await pickFile('file-any');
          if (!files[0]) return;
          try {
            const src = await readImage(files[0], 900);
            const im = new Image();
            im.onload = () => {
              clear();
              const s = Math.min(cvs.width / im.width, cvs.height / im.height);
              ctx.drawImage(im, (cvs.width - im.width * s) / 2, (cvs.height - im.height * s) / 2, im.width * s, im.height * s);
              ink = true;
            };
            im.src = src;
          } catch (err) {
            toast('Could not read that image');
          }
        }
      });
      root.addEventListener('input', (e) => {
        if (e.target.id === 'sig-name') drawTyped();
      });
      function setup() {
        clear();
        $('#sig-saved', root).hidden = mode !== 'saved';
        cvs.hidden = mode === 'saved';
        if (mode === 'saved') $('#sig-saved', root).src = S.signature.img;
        $('#sig-opts', root).innerHTML =
          mode === 'draw'
            ? `<div class="row-between"><span class="muted small">Draw with your mouse, finger or stylus</span><select id="sig-ink" aria-label="Ink colour"><option value="#1a3d8f">Blue ink</option><option value="#111111">Black ink</option></select></div>`
            : mode === 'type'
              ? `<label class="field"><span>Full name</span><input id="sig-name" value="${esc(S.me.name)}" maxlength="40"></label><div class="chips">${FONTS.map((f, i) => `<button class="chip ${i === font ? 'on' : ''}" data-font="${i}" style="font-family:${esc(f)}">${esc(S.me.name)}</button>`).join('')}</div>`
              : mode === 'upload'
                ? `<button class="btn" id="sig-up">${icon('upload', 16)} Upload a photo of your signature</button>`
                : '<p class="muted small">Using your saved signature.</p>';
        if (mode === 'type') drawTyped();
      }
      function drawTyped() {
        clear();
        const name = $('#sig-name', root)?.value.trim();
        if (!name) return;
        ctx.fillStyle = '#1a3d8f';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 92;
        do {
          ctx.font = `${font === 2 ? 'italic ' : ''}${size}px ${FONTS[font]}`;
          size -= 4;
        } while (ctx.measureText(name).width > cvs.width - 60 && size > 30);
        ctx.fillText(name, cvs.width / 2, cvs.height / 2);
        ink = true;
      }
      setup();
    },
  });
  function clear() {
    ctx?.clearRect(0, 0, cvs.width, cvs.height);
    ink = false;
  }
}

// ---------- signature requests
function signReqHTML(ch, m) {
  const out = m.from === 'me';
  const names = (m.signers || []).map(firstName).join(', ');
  const signed = m.status === 'signed';
  let status;
  if (signed) status = `${icon('verified', 15)} Signed by ${esc((m.signedBy || []).map((s) => firstName(s.id)).join(', '))} · ${fmtStamp(m.signedBy[0].at)}`;
  else if (m.status === 'declined') status = 'Declined';
  else status = out ? `Waiting for ${esc(names)} to sign` : 'Your signature is requested';
  const btns = [];
  if (!out && m.status === 'pending') btns.push(`<button class="btn sm" data-act="sr-decline" data-mid="${m.id}">Decline</button>`, `<button class="btn sm primary" data-act="sr-sign" data-mid="${m.id}">${icon('draw', 14)} Review &amp; sign</button>`);
  else if (signed) btns.push(`<button class="btn sm" data-act="sr-cert" data-mid="${m.id}">Certificate</button>`, `<button class="btn sm primary" data-act="sr-view" data-mid="${m.id}">Open signed copy</button>`);
  else btns.push(`<button class="btn sm" data-act="sr-view" data-mid="${m.id}">View document</button>`);
  return `<div class="signreq ${m.status}"><div class="pay-head">${icon('draw', 16)}<span>Signature request</span></div>
    <div class="sr-doc" data-act="sr-view" data-mid="${m.id}">${docIconHTML(m.doc.ext)}<div class="doc-info"><div class="doc-name">${esc(m.doc.name)}</div><div class="doc-sub">${esc(fileType(m.doc.ext).label)} · ${fmtSize(m.doc.size || 0)}</div></div></div>
    ${m.note ? `<div class="pay-note">${esc(m.note)}</div>` : ''}
    <div class="pay-status ${signed ? 'green' : ''}">${status}</div>
    <div class="pay-actions">${btns.join('')}</div></div>${spacer}`;
}
function signRequestModal(ch) {
  const docs = ch.messages
    .filter((m) => m.type === 'doc' && !m.signed)
    .slice(-6)
    .reverse();
  const people = ch.type === 'group' ? ch.members.slice(0, 50) : [ch.contactId];
  modal({
    title: 'Request signature',
    body: `<div class="list-label pad0">Document</div>
      <label class="chat-item check-row"><div class="doc-icon" style="background:#5e35b1">DOC</div><div class="ci-body"><div class="ci-name">Freelance_Agreement_2026.docx</div><div class="ci-preview">Template · agreement</div></div><input type="radio" name="srd" value="tpl" class="check" checked></label>
      ${docs.map((d) => `<label class="chat-item check-row">${docIconHTML(d.ext)}<div class="ci-body"><div class="ci-name">${esc(d.name)}</div><div class="ci-preview">From this chat · ${fmtSize(d.size || 0)}</div></div><input type="radio" name="srd" value="${d.id}" class="check"></label>`).join('')}
      <label class="chat-item check-row"><span class="action-ic">${icon('upload', 20)}</span><div class="ci-body"><div class="ci-name">Upload a file</div><div class="ci-preview">PDF, Word or any document</div></div><input type="radio" name="srd" value="up" class="check"></label>
      <div class="list-label pad0">Who needs to sign</div>
      ${people.map((id) => `<label class="radio-row"><input type="checkbox" name="srp" value="${id}" checked> ${esc(senderName(id))} <span class="muted small">@${esc(person(id)?.username || '')}</span></label>`).join('')}
      <label class="field"><span>Message</span><input id="sr-note" maxlength="120" value="Please review and sign 🙏"></label>`,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Send request',
        primary: true,
        onClick: (root) => {
          const which = $('input[name=srd]:checked', root).value;
          const signers = $$('input[name=srp]:checked', root).map((i) => i.value);
          if (!signers.length) {
            toast('Choose who should sign');
            return false;
          }
          sendSignRequest(ch, which, signers, $('#sr-note', root).value.trim());
        },
      },
    ],
  });
}
async function sendSignRequest(ch, which, signers, note) {
  let doc;
  if (which === 'tpl')
    doc = {
      name: 'Freelance_Agreement_2026.docx',
      ext: 'docx',
      size: 42000,
      html: agreementHTML()
        .replace(/<div class="sig-block"[\s\S]*?<\/div><\/div>/, '')
        .replace('data-for="me"', 'data-for="them"')
        .replace('Client signature — click <b>Sign</b> to sign here', 'Signature'),
    };
  else if (which === 'up') {
    const files = await pickFile('file-any');
    if (!files[0]) return;
    const f = files[0],
      ext = extOf(f.name);
    doc = { name: f.name, ext, size: f.size };
    if (fileType(ext).kind === 'text' && f.size < 300000) doc.content = await f.text();
  } else {
    const d = ch.messages.find((x) => x.id === which);
    doc = { name: d.name, ext: d.ext, size: d.size, html: d.html, content: d.content };
  }
  const m = sendMsg(ch, { type: 'signreq', doc, signers, note, status: 'pending' });
  simulateSigning(ch, m);
  toast('Signature request sent');
}
function simulateSigning(ch, m) {
  const signer = m.signers.find((id) => id !== 'me' && contact(id));
  if (!signer) return;
  setTimeout(() => {
    ui.typing[ch.id] = firstName(signer);
    renderChatSub();
    setTimeout(async () => {
      delete ui.typing[ch.id];
      const at = Date.now(),
        p = contact(signer),
        id = sigId();
      const html = docHTMLFor(m.doc).replace(/<div class="sig-slot"[^>]*>[\s\S]*?<\/div>/, '') + typedSigBlock(p.name, p.username, at, id);
      m.status = 'signed';
      m.signedBy = [{ id: signer, at, sigId: id }];
      m.signedHtml = html;
      m.hash = await sha256(htmlText(html));
      ch.messages.push({ id: uid(), type: 'system', from: 'system', t: at, text: `${p.name} signed “${m.doc.name}” on WHATSMORE` });
      save();
      renderChatSub();
      if (ch.id === ui.active) renderMessages();
      else notify(ch, signer, { text: `✍️ Signed ${m.doc.name}` });
      refreshSidebar();
    }, 2600);
  }, 3500);
}
function signedDocOf(ch, m) {
  if (m.from === 'me') return { name: withSuffix(m.doc.name, 'signed'), ext: m.doc.ext, html: m.signedHtml || docHTMLFor(m.doc), size: (m.signedHtml || '').length, signed: m.signedBy && { by: m.signedBy[0].id, at: m.signedBy[0].at, id: m.signedBy[0].sigId, hash: m.hash } };
  return ch.messages.find((x) => x.id === m.signedMid) || { ...m.doc };
}
Object.assign(XA, {
  'sr-sign'(el) {
    const ch = chatById(ui.active),
      m = ch.messages.find((x) => x.id === el.dataset.mid);
    if (m) openStudio({ ch, req: m });
  },
  'sr-decline'(el) {
    const ch = chatById(ui.active),
      m = ch.messages.find((x) => x.id === el.dataset.mid);
    confirmModal('Decline to sign?', `${senderName(m.from)} will be told you declined “${m.doc.name}”.`, 'Decline', () => {
      m.status = 'declined';
      ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You declined to sign “${m.doc.name}”` });
      save();
      renderMessages();
    });
  },
  'sr-view'(el) {
    const ch = chatById(ui.active),
      m = ch.messages.find((x) => x.id === el.dataset.mid);
    if (!m) return;
    if (m.status === 'signed') openDocViewer(signedDocOf(ch, m), ch);
    else openDocViewer({ ...m.doc, from: m.from, t: m.t }, null);
  },
  'sr-cert'(el) {
    const ch = chatById(ui.active),
      m = ch.messages.find((x) => x.id === el.dataset.mid);
    if (m) signCertModal(signedDocOf(ch, m), m);
  },
  signcert(el) {
    const m = msgOf(el);
    if (m) signCertModal(m);
  },
});
function docBadgesHTML(m) {
  let h = '';
  if (m.signed) h += `<button class="doc-badge signed" data-act="signcert" data-mid="${m.id}">${icon('verified', 14)} Digitally signed by ${esc(senderName(m.signed.by))} · Verify</button>`;
  if (m.corrected) h += `<div class="doc-badge">${icon('spell', 14)} AI-corrected · ${m.corrected} fix${m.corrected === 1 ? '' : 'es'}</div>`;
  return h;
}
function signCertModal(m, req) {
  const sg = m.signed || {};
  const signer = sg.by ? person(sg.by) || (sg.by === 'me' ? S.me : null) : null;
  const trail = [req && [req.t, `Signature requested by ${senderName(req.from)}`], req && [req.t + 40000, `Document opened by ${senderName(sg.by)}`], [sg.at, `Signed by ${senderName(sg.by)} (@${signer?.username || ''})`], [sg.at + 1000, 'Sealed with SHA-256 fingerprint and time-stamp']].filter(Boolean);
  modal({
    title: 'Signature certificate',
    body: `<div class="cert"><div class="cert-head">${icon('verified', 30)}<div><div class="ci-name">${esc(m.name)}</div><div class="ci-sub">Digitally signed on WHATSMORE</div></div></div>
      <div class="kv"><span>Signer</span><b>${esc(senderName(sg.by))} · @${esc(signer?.username || '')}</b></div>
      <div class="kv"><span>Signed at</span><b>${sg.at ? fmtStamp(sg.at) : '—'}</b></div>
      <div class="kv"><span>Signature ID</span><b>${esc(sg.id || '—')}</b></div>
      <div class="kv"><span>Method</span><b>Verified @username + device key</b></div>
      <div class="kv col"><span>Document fingerprint (SHA-256)</span><code>${esc(sg.hash || '—')}</code></div>
      <div class="list-label pad0">Audit trail</div>
      <ol class="trail">${trail.map(([t, l]) => `<li><b>${esc(l)}</b><span>${fmtStamp(t)}</span></li>`).join('')}</ol>
      <div id="cert-verify"></div></div>`,
    actions: [
      {
        label: 'Verify integrity',
        onClick: (root) => {
          if (!m.html) {
            $('#cert-verify', root).innerHTML = `<div class="hint-box flat">${icon('info', 16)}<span>Original bytes are kept by the sender's device.</span></div>`;
            return false;
          }
          sha256(htmlText(m.html)).then((h) => {
            const ok = h === sg.hash;
            $('#cert-verify', root).innerHTML = `<div class="verify ${ok ? 'ok' : 'bad'}">${icon(ok ? 'verified' : 'warning', 20)} ${ok ? 'Document is unchanged since it was signed.' : 'Warning: this document was modified after signing.'}</div>`;
          });
          return false;
        },
      },
      { label: 'Done', primary: true },
    ],
  });
}

// ---------- extra message actions (docs, voice, text)
function extraMsgItems(ch, m) {
  if (m.type === 'deleted') return [];
  const items = [];
  if (m.type === 'doc') {
    items.push({ label: 'Open', icon: 'doc', onClick: () => openDocViewer(m, ch) });
    if (!['image', 'audio', 'video', 'archive', 'app'].includes(fileType(m.ext).kind)) {
      items.push({ label: 'Edit & AI-correct', icon: 'spell', onClick: () => openStudio({ ch, src: m }) });
      items.push({ label: 'Sign document', icon: 'draw', onClick: () => openStudio({ ch, src: m, sign: true }) });
    }
    if (m.signed) items.push({ label: 'Signature certificate', icon: 'verified', onClick: () => signCertModal(m) });
  }
  if (m.type === 'voice') items.push({ label: m.transcript ? 'Hide transcript' : 'Transcribe & summarize', icon: 'sparkle', onClick: () => transcribeVoice(ch, m) });
  if (m.type === 'text') {
    items.push({ label: 'Read aloud', icon: 'speaker', onClick: () => readAloud(m.tr || m.text) });
    items.push({ label: 'Translate to…', icon: 'translate', onClick: () => translateMsgModal(m) });
    if (m.from !== 'me' && scamCheck(m.text).length) items.push({ label: 'Report scam', icon: 'warning', onClick: () => reportScam(ch, m) });
  }
  return items;
}
