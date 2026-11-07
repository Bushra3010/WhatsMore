'use client';
// Document helpers ported from js/docs.js: names, stamps, hashing, demo document bodies, HTML <-> text,
// download and print. Every variable string placed into document HTML is escaped with esc() exactly as
// the original did; HTML that arrives inside a message (m.html) is sanitised before it is shown.
import { S, ui } from '@/lib/state';
import { esc, fileType, hash, HOUR } from '@/lib/util';
import { toast } from '@/lib/overlay';
import type { Message } from '@/lib/types';

/** Extension the way docs.js computed it ('file' when there is no dot). */
export const extOfName = (name: string) => (String(name).includes('.') ? String(name).split('.').pop()!.toLowerCase() : 'file');
export const withSuffix = (name: string, suffix: string) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? `${name.slice(0, i)}_${suffix}${name.slice(i)}` : `${name}_${suffix}`;
};
export const fmtStamp = (t: number) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const sigId = () => 'WM-SIG-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

export async function sha256(text: string) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // file:// in some browsers has no crypto.subtle
    let h = '';
    for (let i = 0; i < 8; i++) h += (hash(i + ':' + text) >>> 0).toString(16).padStart(8, '0');
    return h;
  }
}
/** Plain text of an HTML string (parsed inertly, nothing runs). */
export const htmlText = (html: string) => (new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();

// ---------- sanitising HTML that came inside a message
const DROP = 'script,style,iframe,frame,frameset,object,embed,link,meta,base,form,noscript,template';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'srcset', 'background', 'poster'];
export function sanitizeHTML(html: string) {
  if (typeof window === 'undefined') return esc(html);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll(DROP).forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(a.name); return; }
      if (URL_ATTRS.includes(name)) {
        const v = a.value.trim().toLowerCase().replace(/[\s\u0000-\u001f]/g, '');
        const okData = name === 'src' && el.tagName === 'IMG' && /^data:image\/(png|jpe?g|gif|webp);/.test(v);
        if (/^(javascript|vbscript):/.test(v) || (v.startsWith('data:') && !okData)) el.removeAttribute(a.name);
      }
    });
  });
  return doc.body.innerHTML;
}

// ---------- demo document bodies (seeded files have no real bytes)
export function demoDocHTML(m: Partial<Message>) {
  const n = String(m.name || '').toLowerCase();
  if (/prd/.test(n))
    return `<h1>WHATSMORE — Product Requirments Document v2</h1><p><b>Owner:</b> Siva · <b>Status:</b> Draft for review</p>
<h2>1. Vision</h2><p>WHATSMORE is more then a chat app. it combines chat , AI, payments and business in one secure platform.</p>
<h2>2. MVP scope</h2><ul><li>Private chat with end-to-end encyption</li><li>Voice and video calls with call links</li><li>Groups with no participant limit</li><li>Username based connection so users dont need to share there phone number</li></ul>
<h2>3. Timeline</h2><p>Designs will be ready untill Friday. The the beta release is planned for december. Every team member must recieve the final PRD before the investor demo on monday at 4 PM.</p>
<h2>4. Security</h2><p>Signal protocol for 1:1 chats and Sender Keys for groups. An independant security audit is neccessary before launch .</p>`;
  if (/agreement|contract|nda/.test(n)) return agreementHTML();
  if (/invoice/.test(n)) {
    const no = (String(m.name).match(/INV-\d+/i) || ['INV-1001'])[0];
    return `<h1>Invoice ${esc(no)}</h1><p><b>From:</b> Ramesh Kumar · Freelance web developer<br><b>To:</b> ${esc(S.me.name)}<br><b>Date:</b> ${esc(new Date(m.t || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
<table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr><tr><td>Website design &amp; development</td><td>1</td><td>₹15,000</td></tr><tr><td>Hosting setup</td><td>1</td><td>₹2,000</td></tr><tr><td>Maintenance (1 month)</td><td>1</td><td>₹1,500</td></tr><tr><td><b>Total</b></td><td></td><td><b>₹18,500</b></td></tr></table>
<p>Please pay via WHATSMORE Pay to @ramesh_k. Thank you for your buisness!</p>`;
  }
  if (/receipt|bill/.test(n))
    return `<h1>Booking Receipt</h1><p><b>Sea Breeze Villa, Goa</b><br>Check-in: Saturday 10 Oct · Check-out: Monday 12 Oct · 4 guests</p>
<table><tr><th>Description</th><th>Amount</th></tr><tr><td>Villa · 2 nights</td><td>₹11,000</td></tr><tr><td>Taxes &amp; fees</td><td>₹1,000</td></tr><tr><td><b>Total paid</b></td><td><b>₹12,000</b></td></tr></table><p>Payment status: PAID · Booking ID GOA-77812</p>`;
  if (fileType(m.ext).kind === 'sheet' || /checklist/.test(n))
    return `<h1>${esc(String(m.name).replace(/\.[^.]+$/, '').replace(/_/g, ' '))}</h1>
<table><tr><th>#</th><th>Check</th><th>Owner</th><th>Status</th></tr><tr><td>1</td><td>End-to-end encryption review</td><td>Arjun</td><td>✅ Done</td></tr><tr><td>2</td><td>Penetration testing</td><td>External</td><td>⏳ Scheduled</td></tr><tr><td>3</td><td>Key management &amp; backups</td><td>Arjun</td><td>⏳ In progress</td></tr><tr><td>4</td><td>Rate limiting &amp; anti-bot</td><td>Siva</td><td>⬜ To do</td></tr><tr><td>5</td><td>Privacy dashboard audit</td><td>Ananya</td><td>⬜ To do</td></tr></table>`;
  return `<h1>${esc(String(m.name).replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))}</h1><p>This ${esc(fileType(m.ext).label)} file was shared on WHATSMORE. In production the original file is opened here; text is extracted (with OCR for scans) so it can be read, corrected and signed.</p><p>Type or paste content here to edit it.</p>`;
}
export function agreementHTML() {
  return `<h1>Freelance Services Agreement</h1><p>This Agreement is made between <b>${esc(S.me.name)}</b> (@${esc(S.me.username)}, “Client”) and <b>Ramesh Kumar</b> (@ramesh_k, “Developer”).</p>
<h2>1. Scope of work</h2><p>The Developer will design and develop the WHATSMORE marketing website, including 6 pages, a blog and a contact form.</p>
<h2>2. Fees &amp; payment</h2><p>The total fee is ₹45,000, payable in two instalments: 50% on signing and 50% on delivery, through WHATSMORE Pay.</p>
<h2>3. Timeline</h2><p>Delivery within 30 days from the date of signing.</p>
<h2>4. Confidentiality</h2><p>Both parties will keep all project infomation confidential.</p>
<h2>5. Signatures</h2>
${typedSigBlock('Ramesh Kumar', 'ramesh_k', Date.now() - 2 * HOUR, 'WM-SIG-R4M3-K8QX')}
<div class="sig-slot" data-for="me" contenteditable="false">Client signature — click <b>Sign</b> to sign here</div>`;
}
export function typedSigBlock(name: string, username: string, at: number, id: string) {
  return `<div class="sig-block" contenteditable="false"><div class="sig-typed">${esc(name)}</div><div class="sig-name">${esc(name)} · @${esc(username)}</div><div class="sig-meta">Digitally signed · ${esc(fmtStamp(at))} · ${esc(id)}</div></div>`;
}
export function imgSigBlock(img: string, at: number, id: string) {
  return `<div class="sig-block" contenteditable="false"><img src="${esc(img)}" alt="Signature"><div class="sig-name">${esc(S.me.name)} · @${esc(S.me.username)}</div><div class="sig-meta">Digitally signed · ${esc(fmtStamp(at))} · ${esc(id)}</div></div>`;
}
export function textToHTML(text: string, ext: string) {
  if (ext === 'csv' || ext === 'tsv') {
    const rows = text.trim().split(/\r?\n/).slice(0, 200).map((r) => r.split(ext === 'tsv' ? '\t' : ','));
    return `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`;
  }
  if (fileType(ext).kind === 'text' && !['txt', 'md', 'log'].includes(ext)) return `<pre>${esc(text)}</pre>`;
  return text
    .split(/\n{2,}/)
    .map((p) => (/^#\s/.test(p) ? `<h1>${esc(p.replace(/^#\s/, ''))}</h1>` : /^##\s/.test(p) ? `<h2>${esc(p.replace(/^##\s/, ''))}</h2>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`))
    .join('');
}
/** The document body as (safe) HTML: edited HTML, extracted text, or the demo body. */
export const docHTMLFor = (m: Partial<Message>) => (m.html ? sanitizeHTML(m.html) : m.content != null ? textToHTML(m.content, m.ext) : demoDocHTML(m));

/** Kinds that cannot be opened in the Studio (viewer). */
export const NOT_EDITABLE = ['image', 'audio', 'video', 'archive', 'app', 'cad', 'design'];
/** Kinds without "Edit & AI-correct" in the message menu. */
export const NOT_EDITABLE_MENU = ['image', 'audio', 'video', 'archive', 'app'];

export const hasBlob = (url?: string) => !!url && ui.blobs.includes(url);

// ---------- download / print
export function docFileHTML(m: Partial<Message>) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.name)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}.sig-block{border-top:1px solid #999;margin-top:24px;padding-top:8px;max-width:320px}.sig-block img{max-height:70px}.sig-typed{font:32px "Segoe Script","Brush Script MT",cursive;color:#1a3d8f}.sig-name{font-weight:bold}.sig-meta{font-size:12px;color:#555}.sig-slot{display:none}</style></head><body>${docHTMLFor(m)}${m.signed ? `<hr><p style="font-size:12px;color:#555">Digitally signed on WHATSMORE · ${esc(m.signed.id)} · SHA-256 ${esc(m.signed.hash)}</p>` : ''}</body></html>`;
}
export function downloadDoc(m: Partial<Message>) {
  const a = document.createElement('a');
  const src = hasBlob(m.url) && !m.html ? m.url : m.data && !m.html ? m.data : null;
  if (src) {
    a.href = src;
    a.download = m.name || 'file';
    a.click();
    return;
  }
  const name = m.name || 'document';
  const word = ['doc', 'docx', 'odt', 'rtf'].includes(m.ext);
  const text = m.content != null && !m.html;
  const blob = new Blob([text ? m.content : docFileHTML(m)], { type: text ? 'text/plain' : word ? 'application/msword' : 'text/html' });
  a.href = URL.createObjectURL(blob);
  a.download = text ? name : word ? name.replace(/\.[^.]+$/, '') + '.doc' : name.replace(/\.[^.]+$/, '') + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function printDoc(m: Partial<Message>) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print or save as PDF');
  w.document.write(docFileHTML(m));
  w.document.close();
  setTimeout(() => w.print(), 300);
}
