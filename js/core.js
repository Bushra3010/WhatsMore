// Core: state, helpers, shared UI primitives (menu, modal, toast)
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uid = () => Math.random().toString(36).slice(2, 10);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const KEY = 'whatsmore-demo-v1';

const app = $('#app'), rail = $('#rail'), sidebar = $('#sidebar'), main = $('#main'), drawer = $('#drawer'), overlayRoot = $('#overlay-root');

const LANGS = { te: 'Telugu', hi: 'Hindi' };
const COLORS = ['#00a884', '#7c4dff', '#e91e63', '#ff9800', '#009688', '#3f51b5', '#f4511e', '#0288d1', '#8e24aa', '#c2185b'];
const PRIVACY_OPTS = [['everyone', 'Everyone'], ['contacts', 'My contacts'], ['selected', 'Selected contacts'], ['close', 'Close friends'], ['private', 'Only me']];
const privacyLabel = (v) => (PRIVACY_OPTS.find((p) => p[0] === v) || [0, 'My contacts'])[1];
const PLANS = {
  free: { name: 'Free', quota: '5 GB', bytes: 5e9, price: '₹0' },
  premium: { name: 'Premium', quota: '100 GB', bytes: 1e11, price: '₹99 / month' },
  business: { name: 'Business', quota: '1 TB', bytes: 1e12, price: '₹499 / month' },
  enterprise: { name: 'Enterprise', quota: 'Unlimited', bytes: 1e14, price: 'Custom' },
};

let S;
// Extra action handlers registered by feature files (merged into A in main.js)
const XA = {};
const ui = {
  tab: 'chats', page: null, active: null, filter: 'all', search: '', ncQuery: '', ngName: '', ngQuery: '', ngPick: new Set(), memQuery: '', memLimit: 20,
  replyTo: null, editing: null, chatSearch: null, searchIdx: 0, drawer: null, unlocked: new Set(),
  typing: {}, emojiOpen: false, emojiTab: 'emoji', draft: {}, filesCat: 'all', filesQuery: '',
  rec: null, playing: null, call: null, story: null, blobs: new Set(),
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) { S = s; return; } }
  } catch (e) { /* ignore */ }
  S = WM_SEED();
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Browser storage is full — large media may not survive a refresh'); }
  }, 250);
}

// ---------- formatting
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayDiff(t) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(t); b.setHours(0, 0, 0, 0); return Math.round((a - b) / DAY); }
const dayKey = (t) => new Date(t).toDateString();
function dayLabel(t) {
  const dd = dayDiff(t), d = new Date(t);
  if (dd === 0) return 'Today';
  if (dd === 1) return 'Yesterday';
  if (dd < 7 && dd > 0) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
function listTime(t) {
  const dd = dayDiff(t);
  if (dd <= 0) return fmtTime(t);
  if (dd === 1) return 'Yesterday';
  if (dd < 7) return new Date(t).toLocaleDateString([], { weekday: 'long' });
  return new Date(t).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}
const callTime = (t) => (dayDiff(t) === 0 ? 'Today' : dayDiff(t) === 1 ? 'Yesterday' : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' })) + ', ' + fmtTime(t);
const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtSize = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' kB' : (b / 1048576).toFixed(1) + ' MB');
// Every file type is supported — this only picks the icon label and colour
const FILE_TYPES = [
  [['pdf'], 'PDF', '#e5474b', 'pdf'], [['doc', 'docx', 'odt', 'rtf', 'pages'], 'DOC', '#2b6fd6', 'word'],
  [['xls', 'xlsx', 'ods', 'numbers'], 'XLS', '#1d9b5f', 'sheet'], [['csv', 'tsv'], 'CSV', '#1d9b5f', 'text'],
  [['ppt', 'pptx', 'odp', 'key'], 'PPT', '#d24726', 'slides'], [['txt', 'md', 'log', 'ini'], 'TXT', '#607d8b', 'text'],
  [['zip', 'rar', '7z', 'tar', 'gz', 'bz2'], 'ZIP', '#8d6e63', 'archive'], [['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'], 'AUDIO', '#ff9800', 'audio'],
  [['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'], 'VIDEO', '#7b1fa2', 'video'], [['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg', 'tiff'], 'IMG', '#0288d1', 'image'],
  [['psd', 'ai', 'fig', 'sketch', 'xd', 'indd', 'cdr'], 'DESIGN', '#5e35b1', 'design'], [['dwg', 'dxf', 'stl', 'step', 'obj'], 'CAD', '#455a64', 'cad'],
  [['apk', 'exe', 'dmg', 'msi', 'ipa', 'deb'], 'APP', '#43a047', 'app'], [['epub', 'mobi'], 'BOOK', '#6d4c41', 'ebook'],
  [['js', 'ts', 'py', 'java', 'kt', 'swift', 'html', 'css', 'json', 'xml', 'c', 'cpp', 'go', 'rb', 'php', 'sql', 'sh', 'yml', 'yaml'], 'CODE', '#37474f', 'text'],
  [['vcf'], 'VCF', '#009688', 'text'], [['ics'], 'ICS', '#e91e63', 'text'],
];
function fileType(ext) {
  ext = String(ext || '').toLowerCase();
  const t = FILE_TYPES.find(([exts]) => exts.includes(ext));
  return t ? { label: t[1], color: t[2], kind: t[3] } : { label: (ext || 'file').toUpperCase().slice(0, 4), color: '#8696a0', kind: 'other' };
}
const docIconHTML = (ext, cls = '') => { const t = fileType(ext); return `<div class="doc-icon ${cls}" style="background:${t.color}">${esc(t.label)}</div>`; };
const initials = (name) => (name || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function isJumbo(t) {
  if (!t || t.length > 30) return false;
  const s = t.replace(/\s/g, '');
  if (!/^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+$/u.test(s)) return false;
  const n = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter().segment(s)].length : s.length / 2;
  return n <= 3;
}
function highlight(text, q) {
  let s = esc(text);
  if (q) s = s.replace(new RegExp('(' + escRe(esc(q)) + ')', 'gi'), '<mark>$1</mark>');
  return s;
}
function fmtText(t, q) {
  let s = esc(t);
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,!?)])/g, '$1<b>$2</b>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, '$1<i>$2</i>');
  s = s.replace(/(^|[\s(])@([a-z0-9._]{3,})/gi, '$1<span class="mention">@$2</span>');
  if (q) s = s.replace(new RegExp('(' + escRe(esc(q)) + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>');
  return s;
}

// ---------- entities
// Indexed lookup: groups can have thousands of members. Contacts are only ever appended.
let contactIdx = null, contactIdxLen = -1, contactIdxArr = null;
function contact(id) {
  if (contactIdxArr !== S.contacts || contactIdxLen !== S.contacts.length) {
    contactIdx = new Map(S.contacts.map((c) => [c.id, c]));
    contactIdxLen = S.contacts.length; contactIdxArr = S.contacts;
  }
  return contactIdx.get(id);
}
const person = (id) => contact(id) || S.directory.find((u) => u.id === id);
const chatById = (id) => S.chats.find((c) => c.id === id);
const chatTitle = (ch) => (ch.secret ? '🔒 ' : '') + (ch.type === 'direct' ? contact(ch.contactId)?.name || 'Unknown' : ch.name);
const senderName = (id) => (id === 'me' ? 'You' : person(id)?.name || 'Unknown');
const firstName = (id) => (id === 'me' ? 'You' : senderName(id).split(' ')[0]);
const lastMsg = (ch) => ch.messages[ch.messages.length - 1];
const lastTime = (ch) => lastMsg(ch)?.t || 0;
const isBiz = (ch) => ch.type === 'direct' && !!contact(ch.contactId)?.business;
const isAdmin = (ch) => ch.type === 'group' && (ch.admins || []).includes('me');
const directChatFor = (cid) => S.chats.find((c) => c.type === 'direct' && c.contactId === cid && !c.secret);
const productById = (pid) => Object.values(S.catalog).flat().find((p) => p.id === pid);
const allUsernames = () => [...S.contacts, ...S.directory].map((u) => u.username);

// ---------- people (groups have no participant limit)
const sample = (arr, n) => (arr.length <= n ? arr.slice() : arr.slice().sort(() => Math.random() - 0.5).slice(0, n));
// Everyone discoverable on WHATSMORE: contacts first, then other users by @username
function findPeople(q, exclude = []) {
  q = (q || '').trim().toLowerCase().replace(/^@/, '');
  const skip = new Set(exclude);
  const people = [...S.contacts.filter((c) => !c.business), ...S.directory.filter((u) => !S.contacts.some((c) => c.id === u.id))]
    .filter((p) => !skip.has(p.id));
  const hits = q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.username.includes(q)) : people;
  return hits.sort((a, b) => (b.isContact ? 1 : 0) - (a.isContact ? 1 : 0) || a.name.localeCompare(b.name));
}
// Make sure a directory user has a contact record so they can be a group member
function ensureContact(id) {
  if (contact(id)) return contact(id);
  const u = S.directory.find((x) => x.id === id);
  if (!u) return null;
  const c = { ...u, isContact: false, online: Math.random() < 0.4 };
  S.contacts.push(c);
  return c;
}
function namesSummary(ids, max = 3) {
  const names = ids.map(firstName);
  if (names.length <= max) return names.join(', ');
  return names.slice(0, max).join(', ') + ` and ${(names.length - max).toLocaleString()} others`;
}
const FIRST = 'Aarav Aditi Akash Ananya Arjun Divya Farhan Gayatri Harsh Isha Karan Kavya Lakshmi Manoj Meera Mohit Nandini Naveen Neha Pooja Rahul Ravi Riya Rohan Sameer Sana Shreya Sneha Suresh Tanvi Varun Vikram Yash Zoya Imran Fatima Joseph Mary Priyanka Kiran'.split(' ');
const LAST = 'Sharma Reddy Rao Khan Patel Iyer Naidu Gupta Singh Verma Das Menon Joshi Nair Shah Kapoor Mehta Pillai Chowdhury Varma'.split(' ');
// Create N new WHATSMORE users (used to simulate people joining via a group invite link)
function generatePeople(n) {
  const out = [], taken = new Set(allUsernames());
  for (let i = 0; i < n; i++) {
    const f = pick(FIRST), l = pick(LAST);
    let un;
    do { un = (f + '.' + l).toLowerCase() + (Math.floor(Math.random() * 9000) + 100); } while (taken.has(un));
    taken.add(un);
    const p = { id: 'g_' + uid(), name: f + ' ' + l, username: un, color: pick(COLORS), generated: 1 };
    S.contacts.push(p);
    out.push(p.id);
  }
  return out;
}

function avatarHTML(o, size = 49, extra = '') {
  o = o || {};
  const fs = Math.round(size * (o.emoji ? 0.5 : 0.4));
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;background:${o.color || '#8696a0'};font-size:${fs}px">${o.emoji ? o.emoji : esc(initials(o.name))}</div>`;
}
function chatAvatar(ch, size = 49) {
  if (ch.type === 'direct') return avatarHTML(contact(ch.contactId), size);
  return avatarHTML({ name: ch.name, emoji: ch.emoji, color: ch.color }, size, 'group');
}
const verifiedHTML = (c) => (c?.business?.verified ? `<span class="verified" title="Verified business">${icon('verified', 16)}</span>` : '');

function preview(m) {
  if (!m) return '';
  switch (m.type) {
    case 'text': return m.text;
    case 'image': return '📷 ' + (m.caption || 'Photo');
    case 'video': return '🎥 ' + (m.caption || 'Video');
    case 'doc': return (m.signed ? '✍️ ' : '📄 ') + m.name;
    case 'signreq': return '✍️ Signature request: ' + m.doc.name;
    case 'voice': return '🎤 Voice message (' + fmtDur(m.dur) + ')';
    case 'sticker': return m.text;
    case 'gif': return '🎞️ GIF';
    case 'payment': return (m.kind === 'request' ? '💳 Payment request ' : '💸 Payment ') + money(m.amount);
    case 'poll': return '📊 POLL: ' + m.question;
    case 'event': return '📅 ' + m.title;
    case 'product': return '🛍️ ' + (productById(m.productId)?.name || 'Product');
    case 'invoice': return '🧾 Invoice ' + m.orderId;
    case 'contact': return '👤 ' + (contact(m.userId)?.name || 'Contact');
    case 'call': return (m.video ? '📹 Video call' : '📞 Voice call') + (m.missed ? ' · missed' : '');
    case 'deleted': return '🚫 This message was deleted';
    case 'system': return m.text;
  }
  return '';
}
function ticks(st) {
  if (st === 'read') return `<span class="tick read">${icon('doneall', 16)}</span>`;
  if (st === 'delivered') return `<span class="tick">${icon('doneall', 16)}</span>`;
  return `<span class="tick">${icon('check', 16)}</span>`;
}

// ---------- toast
function toast(text, onClick, opts = {}) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = opts.html ? text : esc(text);
  if (onClick) { t.classList.add('clickable'); t.onclick = () => { onClick(); t.remove(); }; }
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.ms || 3200);
}
function copyText(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast('Copied to clipboard')).catch(() => toast('Could not copy'));
}

// ---------- popup menu
let outsideHandler = null;
function closeMenu() {
  $('#menu')?.remove();
  if (outsideHandler) { document.removeEventListener('mousedown', outsideHandler, true); outsideHandler = null; }
}
function showMenu(pos, items, opts = {}) {
  closeMenu();
  const list = items.filter(Boolean);
  const el = document.createElement('div');
  el.className = 'menu ' + (opts.cls || '');
  el.id = 'menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = (opts.header || '') + list.map((it, i) => (it === '-' ? '<div class="menu-sep"></div>' :
    `<button class="menu-item ${it.danger ? 'danger' : ''}" data-mi="${i}" role="menuitem">${it.icon ? `<span class="mi-ic" ${it.color ? `style="background:${it.color}"` : ''}>${icon(it.icon, it.color ? 18 : 20)}</span>` : ''}<span>${esc(it.label)}</span></button>`)).join('');
  overlayRoot.appendChild(el);
  const r = pos.getBoundingClientRect ? pos.getBoundingClientRect() : { left: pos.x, right: pos.x, top: pos.y, bottom: pos.y };
  const mw = el.offsetWidth, mh = el.offsetHeight, vw = innerWidth, vh = innerHeight;
  let x = opts.alignLeft ? r.left : r.right - mw;
  let y = opts.above ? r.top - mh - 6 : r.bottom + 4;
  if (x + mw > vw - 8) x = vw - mw - 8;
  if (x < 8) x = 8;
  if (y + mh > vh - 8) y = Math.max(8, r.top - mh - 4);
  if (y < 8) y = 8;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const rb = e.target.closest('[data-react]');
    if (rb && opts.onReact) { closeMenu(); opts.onReact(rb.dataset.react); return; }
    const b = e.target.closest('[data-mi]');
    if (b) { closeMenu(); list[+b.dataset.mi].onClick(); }
  });
  outsideHandler = (e) => { if (!el.contains(e.target)) closeMenu(); };
  setTimeout(() => document.addEventListener('mousedown', outsideHandler, true), 0);
  el.querySelector('button')?.focus({ preventScroll: true });
}

// ---------- modal
function modal({ title, body, actions = [], wide = false, onMount, onClose, cls = '' }) {
  const root = document.createElement('div');
  root.className = 'modal-backdrop';
  root.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-mclose aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-mact="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
  overlayRoot.appendChild(root);
  const close = () => { if (!root.isConnected) return; root.remove(); onClose && onClose(); };
  root._close = close;
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-mclose]')) return close();
    const b = e.target.closest('[data-mact]');
    if (b) { const a = actions[+b.dataset.mact]; const r = a.onClick ? a.onClick(root) : undefined; if (r !== false) close(); }
  });
  onMount && onMount(root, close);
  const f = root.querySelector('[autofocus]') || root.querySelector('input, textarea');
  if (f) setTimeout(() => f.focus(), 30);
  return { root, close };
}
function confirmModal(title, text, label, fn, danger = true) {
  modal({ title, body: `<p class="muted">${esc(text)}</p>`, actions: [{ label: 'Cancel' }, { label, primary: !danger, danger, onClick: fn }] });
}

// ---------- images
function readImage(file, max = 1280) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
function pickFile(id) {
  return new Promise((res) => {
    const inp = $('#' + id);
    inp.value = '';
    inp.onchange = () => res([...inp.files]);
    inp.click();
  });
}

function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name=theme-color]').content = dark ? '#202c33' : '#008069';
}
