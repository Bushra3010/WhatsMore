// Blueprint §14 Cloud (smart folders, links, duplicates, backup), §13 voice status, §7 SOS audio,
// §9 Learn from your PDF, §5 more marketplace categories, admin modules, and separate-profile demo chats
'use strict';

// ---------- demo data for the new features (fresh and saved states)
const _migratePlus = migrate;
migrate = function () {
  _migratePlus();
  if (S.x3) return;
  const now = Date.now(), m = (from, extra) => ({ id: uid(), from, t: now - Math.floor(Math.random() * 5 * DAY) - HOUR, status: 'read', reactions: {}, ...extra });
  const push = (cid, msg) => { const ch = chatById(cid); if (ch) { ch.messages.push(msg); ch.messages.sort((a, b) => a.t - b.t); } };
  push('ch_mom', m('c_mom', { type: 'doc', name: 'Aadhaar_Card_Mom.pdf', ext: 'pdf', size: 412000, pages: 1, caption: 'Keep a copy of my Aadhaar 🙏' }));
  push('ch_mom', m('c_mom', { type: 'doc', name: 'Electricity_Bill_Oct.pdf', ext: 'pdf', size: 96000, pages: 1 }));
  push('ch_family', m('c_ananya', { type: 'doc', name: 'Class10_Report_Card_Ananya.pdf', ext: 'pdf', size: 288000, pages: 3 }));
  push('ch_family', m('c_siva', { type: 'image', art: { emoji: '🍛', bg: 'linear-gradient(135deg,#f6d365,#fda085)' }, caption: 'Family dinner last night ❤️' }));
  push('ch_family', m('c_mom', { type: 'image', art: { emoji: '🎂', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)' }, caption: "Siva's birthday party 🎉" }));
  push('ch_siva', m('c_siva', { type: 'doc', name: 'PAN_Card_Siva.pdf', ext: 'pdf', size: 204000, pages: 1, caption: 'For the company registration' }));
  push('ch_siva', m('c_siva', { type: 'doc', name: 'WHATSMORE_PRD_v2.pdf', ext: 'pdf', size: 1240000, pages: 18, forwarded: true }));
  push('ch_siva', m('c_siva', { type: 'text', text: 'Design files are here: https://figma.com/whatsmore-design and the roadmap https://whatsmore.app/roadmap' }));
  // Separate profiles have their own chats
  const mkC = (id, name, username, color, about) => { if (!contact(id)) S.contacts.push({ id, name, username, color, about, isContact: false, online: true }); };
  mkC('p_kavya', 'Kavya Iyer', 'kavya.iyer', '#00897b', 'Café owner');
  mkC('p_imran', 'Imran Khan', 'imran.k', '#6d4c41', 'Startup founder');
  mkC('p_nisha', 'Nisha (subscriber)', 'nisha.designs', '#8e24aa', 'Design student');
  const enc = (t) => ({ id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' });
  const chat = (id, cid, profile, msgs) => { if (!chatById(id)) S.chats.push({ id, type: 'direct', contactId: cid, profile, unread: 1, messages: [enc(now - 2 * DAY), ...msgs] }); };
  chat('ch_cust1', 'p_kavya', 'business', [m('p_kavya', { type: 'text', text: 'Hi! How much is a logo design for my café? ☕', t: now - 40 * MIN })]);
  chat('ch_cust2', 'p_imran', 'business', [m('p_imran', { type: 'text', text: 'Order ORD-2300 received, thanks. When will the UI kit be delivered?', t: now - 3 * HOUR })]);
  chat('ch_fan1', 'p_nisha', 'creator', [m('p_nisha', { type: 'text', text: 'Loved your “10 UI tricks” video! Will you do a live Q&A on Figma? 🙌', t: now - 2 * HOUR })]);
  ['ch_family', 'ch_mom'].forEach((id) => { const c = chatById(id); if (c) c.profile = 'family'; });
  // A voice status from Siva
  const sv = S.statuses.find((s) => s.contactId === 'c_siva');
  if (sv && !sv.items.some((i) => i.type === 'voice')) sv.items.push({ type: 'voice', dur: 9, caption: 'Big news coming soon. WHATSMORE beta opens next week!', t: now - 30 * MIN });
  S.backup = S.backup || { last: now - 26 * HOUR, size: 0 };
  S.x3 = 1;
  save();
};

// ---------- cloud: links, duplicates, smart folders, backup
const URL_RE = /https?:\/\/[^\s<]+/g;
const _allFilesPlus = allFiles;
allFiles = function () {
  const out = _allFilesPlus().filter((x) => !x.m.cloudDedup);
  S.chats.forEach((c) => {
    if (c.locked && !ui.unlocked.has(c.id)) return;
    c.messages.forEach((m) => { if (m.type === 'text') (m.text.match(URL_RE) || []).forEach((u, i) => out.push({ c, m: { id: m.id, type: 'link', name: u, url: u, from: m.from, t: m.t + i, size: 1 }, cat: 'links' })); });
  });
  return out.sort((a, b) => b.m.t - a.m.t);
};
const DOC_FOLDERS = [['aadhaar', '🪪', 'Aadhaar', /aadhaar/i], ['pan', '💳', 'PAN', /\bpan[\s_-]?card|\bpan\b/i], ['education', '🎓', 'Education', /report|marks|certificate|school|college|syllabus|chapter|exam|notes/i], ['business', '💼', 'Business', /invoice|inv[-_]|prd|gst|proposal|contract|audit|checklist|quotation|agreement|deck|security/i], ['bills', '🧾', 'Bills', /bill|receipt|recharge|electricity|water/i]];
const PHOTO_FOLDERS = [['events', '🎉', 'Events', (x) => /birthday|party|wedding|festival|event|🎉|🎂/i.test(x.m.caption || '')], ['family', '🏡', 'Family', (x) => ['ch_family', 'ch_mom'].includes(x.c.id) || /family|mom|amma/i.test(x.m.caption || '')], ['travel', '✈️', 'Travel', (x) => /trip|travel|beach|goa|sunset|tank bund|hotel|staying|🏖|🏝|🌅/i.test((x.m.caption || '') + ' ' + chatTitle(x.c))], ['work', '🏢', 'Work', (x) => /project|office|work|team/i.test(chatTitle(x.c) + ' ' + (x.m.caption || ''))]];
function folderOf(x) {
  if (x.cat === 'photos') return (PHOTO_FOLDERS.find(([, , , f]) => f(x)) || [])[0] || null;
  if (['documents', 'receipts', 'invoices'].includes(x.cat)) return (DOC_FOLDERS.find(([, , , re]) => re.test(x.m.name || '')) || [])[0] || null;
  return null;
}
function findDuplicates() {
  const groups = {};
  allFiles().filter((x) => x.m.type === 'doc' || (x.m.type === 'image' && x.m.src)).forEach((x) => {
    const k = x.m.type === 'doc' ? `${x.m.name}|${x.m.size}` : `img|${x.m.src.length}|${x.m.src.slice(-40)}`;
    (groups[k] ||= []).push(x);
  });
  return Object.values(groups).filter((g) => g.length > 1);
}
const fileSize = (m) => m.size || (m.src ? m.src.length * 0.75 : 0) || (m.type === 'voice' ? m.dur * 4000 : 180000);
function cloudHomeHTML() {
  const files = allFiles();
  const count = (list, key) => files.filter((x) => folderOf(x) === key).length;
  const dups = findDuplicates(), dupBytes = dups.reduce((s, g) => s + g.slice(1).reduce((a, x) => a + fileSize(x.m), 0), 0);
  const b = S.backup || {};
  const tile = ([k, e, n]) => `<button class="folder" data-act="cfolder" data-f="${k}"><span class="big-emoji">${e}</span><b>${n}</b><span class="ci-sub">${count(files, k)} file${count(files, k) === 1 ? '' : 's'}</span></button>`;
  return `<div class="list-label">Smart folders · Documents</div><div class="folder-grid">${DOC_FOLDERS.map(tile).join('')}</div>
    <div class="list-label">Smart folders · Photos</div><div class="folder-grid">${PHOTO_FOLDERS.map(tile).join('')}</div>
    ${dups.length ? `<div class="cloud-card warn"><span class="big-emoji">🧹</span><div class="grow"><b>${dups.length} duplicate file${dups.length === 1 ? '' : 's'}</b><div class="ci-sub">${esc(dups.map((g) => fileName(g[0].m)).slice(0, 2).join(', '))} · free up ${fmtSize(Math.round(dupBytes))}</div></div><button class="btn sm primary" data-act="cdedup">Clean up</button></div>` : ''}
    <div class="cloud-card"><span class="big-emoji">🔐</span><div class="grow"><b>Encrypted backup</b><div class="ci-sub">Last backup ${b.last ? listTime(b.last) + ' · ' + fmtTime(b.last) : 'never'} · end-to-end encrypted with your key</div></div><button class="btn sm" data-act="cbackup">Back up now</button></div>
    <div class="list-label">Recent files</div>`;
}
const _filesListPlus = filesListHTML;
filesListHTML = function () {
  if (ui.folder) {
    const def = [...DOC_FOLDERS, ...PHOTO_FOLDERS].find((f) => f[0] === ui.folder);
    const items = allFiles().filter((x) => folderOf(x) === ui.folder);
    return `<div class="folder-head"><button class="icon-btn sm" data-act="cfolder" data-f="" aria-label="Back to all files">${icon('back', 20)}</button><span class="big-emoji">${def[1]}</span><b>${def[2]}</b><span class="ci-sub">${items.length} file${items.length === 1 ? '' : 's'} · auto-organised</span></div>` + (items.length ? items.map(fileRow).join('') : '<div class="empty-list">Nothing here yet. WHATSMORE files new documents and photos here automatically.</div>');
  }
  const h = _filesListPlus();
  return !ui.filesQuery.trim() && ui.filesCat === 'all' ? h.replace(/(<div class="examples">[\s\S]*?<\/div>)/, `$1${cloudHomeHTML()}`) : h;
};
const _fileRowPlus = fileRow;
fileRow = function (x) {
  if (x.cat !== 'links') return _fileRowPlus(x);
  let host = x.m.url;
  try { host = new URL(x.m.url).host; } catch (e) { /* keep raw */ }
  return `<div class="file-row" data-act="openmsg" data-chat="${x.c.id}" data-mid="${x.m.id}"><div class="file-thumb"><div class="mini-ic">${icon('link', 22)}</div></div><div class="ci-body"><div class="ci-name">${esc(host)}</div><div class="ci-preview">${esc(x.m.url)} · ${esc(senderName(x.m.from))} · ${esc(chatTitle(x.c))}</div></div><span class="pill">Link</span></div>`;
};
Object.assign(XA, {
  cfolder(el) { ui.folder = el.dataset.f || null; renderSidebar(); },
  cdedup() {
    const dups = findDuplicates();
    const n = dups.reduce((s, g) => s + g.length - 1, 0);
    confirmModal('Clean up duplicates?', `${n} extra cop${n === 1 ? 'y' : 'ies'} will be removed from WHATSMORE Cloud storage. The newest copy is kept, and messages stay in your chats.`, 'Clean up', () => {
      dups.forEach((g) => g.slice(1).forEach((x) => { const real = x.c.messages.find((mm) => mm.id === x.m.id); if (real) real.cloudDedup = true; }));
      save(); renderSidebar(); toast(`Removed ${n} duplicate cop${n === 1 ? 'y' : 'ies'}`);
    }, false);
  },
  cbackup() {
    const m = modal({ title: 'Encrypted backup', body: `<p class="muted">Backing up chats, photos and documents. Everything is encrypted on this device before upload — not even WHATSMORE can read it.</p><div class="meter big"><div id="bk-bar" style="width:0%"></div></div><p class="ci-sub" id="bk-t">Encrypting…</p>`, actions: [{ label: 'Hide' }] });
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 12);
      const bar = $('#bk-bar', m.root); if (bar) bar.style.width = p + '%';
      const t = $('#bk-t', m.root); if (t) t.textContent = p < 100 ? `Encrypting and uploading… ${Math.round(p)}%` : 'Backup complete ✓';
      if (p >= 100) { clearInterval(iv); S.backup = { last: Date.now(), size: storageUsed() }; save(); if (ui.tab === 'files') renderSidebar(); toast('🔐 Encrypted backup complete'); }
    }, 250);
  },
});

// ---------- voice status (§13)
function voiceStoryHTML(it) {
  const bars = Array.from({ length: 34 }, (_, i) => 8 + (hash((it.t || 0) + ':' + i) % 40));
  return `<div class="story-voice"><div class="sv-mic">${icon('mic', 40)}</div><div class="sv-wave">${bars.map((h) => `<i style="height:${h}px"></i>`).join('')}</div><div class="sv-dur">🎤 Voice status · ${fmtDur(it.dur || 0)}</div>
    ${it.src ? `<audio src="${it.src}" autoplay></audio>` : `<button class="btn sm" data-act="svplay">🔊 Play</button>`}</div>`;
}
XA.svplay = () => { const st = ui.story, it = st?.owners[st.oi].items[st.ii]; if (it?.caption) readAloud(it.caption); };
function voiceStatusModal() {
  let rec = null, chunks = [], start = 0, timer = null, stream = null, sim = false;
  const stopAll = () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  modal({
    title: '🎤 Voice status',
    body: `<div class="vs-rec"><button class="vs-btn" id="vs-btn" aria-label="Start recording">${icon('mic', 36)}</button><div class="rec-time" id="vs-t">0:00 / 1:00</div><p class="muted small" id="vs-msg">Tap to record up to 60 seconds</p></div>
      <label class="field"><span>Who can hear this?</span><select id="vs-priv">${PRIVACY_OPTS.map(([v, l]) => `<option value="${v}" ${v === S.settings.privacy.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel', onClick: () => { stopAll(); try { rec?.stop(); } catch (e) { /* ignore */ } } }, {
      label: 'Post', primary: true, onClick: (root) => {
        if (!start) { toast('Record something first'); return false; }
        const dur = Math.max(1, Math.round((Date.now() - start) / 1000)), privacy = $('#vs-priv', root).value;
        const post = (src) => { S.myStatus.items.push({ type: 'voice', src, dur: Math.min(60, dur), t: Date.now(), privacy, views: 0, caption: src ? '' : 'Voice status recorded on WHATSMORE' }); save(); renderRail(); if (ui.tab === 'status') renderSidebar(); toast('🎤 Voice status posted · ' + privacyLabel(privacy)); };
        stopAll();
        if (rec && rec.state !== 'inactive') { rec.onstop = () => { const fr = new FileReader(); fr.onload = () => post(fr.result); fr.readAsDataURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); } else post(null);
      },
    }],
    onClose: stopAll,
    onMount: (root) => $('#vs-btn', root).addEventListener('click', async () => {
      if (start) return;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream); rec.ondataavailable = (e) => e.data.size && chunks.push(e.data); rec.start(); } catch (e) { sim = true; }
      start = Date.now();
      $('#vs-btn', root).classList.add('live');
      $('#vs-msg', root).textContent = sim ? 'Recording (simulated — microphone unavailable). Tap Post when done.' : 'Recording… tap Post when done';
      timer = setInterval(() => { const s = (Date.now() - start) / 1000; const t = $('#vs-t', root); if (t) t.textContent = `${fmtDur(s)} / 1:00`; if (s >= 60) { $('[data-mact="1"]', root)?.click(); } }, 250);
    }),
  });
}
XA.vrstatus = voiceStatusModal;
XA.voicestatus = voiceStatusModal;
const _tabStatusPlus = tabStatus;
tabStatus = function () {
  return _tabStatusPlus().replace('<button class="icon-btn" data-act="addstatus"', `<button class="icon-btn" data-act="voicestatus" title="Voice status" aria-label="Record voice status">${icon('mic')}</button><button class="icon-btn" data-act="addstatus"`);
};

// ---------- SOS: optional audio recording (§7)
const _modSOSPlus = MOD_RENDER.sos;
MOD_RENDER.sos = function () {
  return _modSOSPlus().replace('<section class="vsec"><div class="vsec-head"><h3>Emergency contacts', `${sec('Options', toggleRow('emergency.record', 'Record 15 seconds of audio', 'Sent to your emergency contacts with your location. Off by default — needs microphone permission.') + toggleRow('emergency.call112', 'Show “Call 112” as soon as SOS starts', 'One tap to reach emergency services'))}<section class="vsec"><div class="vsec-head"><h3>Emergency contacts`);
};
const _sosgoPlus = XA.sosgo;
XA.sosgo = function () {
  const was = ui.sosActive;
  _sosgoPlus();
  const iv = setInterval(() => {
    if (!ui.sosActive || ui.sosActive === was) return;
    clearInterval(iv);
    if (S.settings.emergency.call112) toast('📞 Tap to call 112', () => { location.href = 'tel:112'; }, { ms: 15000 });
    if (S.settings.emergency.record) sosRecord();
  }, 400);
  setTimeout(() => clearInterval(iv), 20000);
};
async function sosRecord() {
  const send = (src, dur) => S.settings.emergency.contacts.forEach((cid) => { const ch = directChatFor(cid); if (ch) sendMsg(ch, { type: 'voice', dur, src, caption: '🆘 SOS audio' }); });
  toast('🎙️ Recording 15 seconds of audio for your emergency contacts', null, { ms: 4000 });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const fr = new FileReader(); fr.onload = () => send(fr.result, 15); fr.readAsDataURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); };
    rec.start();
    setTimeout(() => rec.state !== 'inactive' && rec.stop(), 15000);
  } catch (e) { setTimeout(() => send(null, 15), 15000); }
}

// ---------- Learn: explain / quiz from your own PDF (§9)
TOPICS.chapter = {
  title: 'Photosynthesis — your uploaded chapter',
  explain: TOPICS.photosynthesis.explain,
  qs: [...TOPICS.photosynthesis.qs,
    ['What is the main source of energy for photosynthesis?', ['Sunlight', 'Moonlight', 'Heat from soil', 'Wind'], 0],
    ['Through which openings do leaves take in CO₂?', ['Stomata', 'Roots', 'Xylem', 'Petals'], 0],
    ['Which part carries water from roots to leaves?', ['Phloem', 'Xylem', 'Stomata', 'Cuticle'], 1],
    ['In which cell organelle does photosynthesis happen?', ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'], 2],
    ['Plants that make their own food are called…', ['Heterotrophs', 'Autotrophs', 'Parasites', 'Saprophytes'], 1],
    ['Which colour of light is least absorbed by chlorophyll?', ['Red', 'Blue', 'Green', 'Violet'], 2],
    ['Excess glucose is stored in plants as…', ['Starch', 'Protein', 'Fat', 'Vitamin'], 0],
    ['Which test shows starch in a leaf?', ['Iodine test', 'Litmus test', 'Flame test', 'Lime-water test'], 0],
    ['The splitting of water in light is called…', ['Photolysis', 'Respiration', 'Transpiration', 'Osmosis'], 0],
    ['Which gas turns lime water milky?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2],
    ['Photosynthesis mostly happens in which cells of the leaf?', ['Mesophyll', 'Epidermis', 'Root hair', 'Guard cells only'], 0],
    ['Which of these is NOT needed for photosynthesis?', ['Water', 'Carbon dioxide', 'Sunlight', 'Oxygen'], 3],
    ['Desert plants like cactus mainly photosynthesise in their…', ['Roots', 'Stems', 'Flowers', 'Seeds'], 1],
    ['The by-product released into the air is…', ['Oxygen', 'Glucose', 'Water vapour only', 'Nitrogen'], 0],
    ['Who depends on photosynthesis for food?', ['Only plants', 'Only animals', 'Almost all living things', 'Only fungi'], 2],
  ],
};
XA.lnupload = async () => {
  const f = (await pickFile('file-any'))[0];
  if (!f) return;
  const st = MS('learn', () => ({}));
  st.pdf = { name: f.name, size: f.size };
  st.topic = 'chapter'; st.quiz = null;
  save(); rerenderView();
  toast(`📄 ${f.name} read by AI · chapter detected`);
};
XA.lnexplainte = () => { const st = MS('learn', () => ({})); st.lang = 'te'; save(); rerenderView(); };
const _modLearnPlus = MOD_RENDER.learn;
MOD_RENDER.learn = function () {
  const st = MS('learn', () => ({ topic: 'photosynthesis', lang: 'en', quiz: null }));
  const card = st.pdf ? `<div class="cloud-card"><span class="doc-icon ext-pdf">PDF</span><div class="grow"><b>${esc(st.pdf.name)}</b><div class="ci-sub">AI detected chapter: Photosynthesis · 20 quiz questions ready (demo uses a sample chapter)</div></div></div>
    <div class="btn-row left"><button class="btn sm" data-act="lnexplainte">Explain this chapter in simple Telugu</button><button class="btn sm primary" data-act="lnquiz">Create 20 multiple-choice questions</button></div>` : '';
  return card + _modLearnPlus();
};

// ---------- Marketplace: digital products and professional services (§5)
SELLERS.c_digi = { name: 'SkillUp Digital', username: 'skillup', emoji: '💾', color: '#3949ab', cat: 'digital', about: 'Courses, e-books & templates', category: 'Digital products', hours: 'Instant delivery · 24×7', address: 'Online',
  products: [{ id: 'dg1', name: 'Python in Telugu — video course', price: 499, emoji: '🎓', bg: 'linear-gradient(135deg,#667eea,#764ba2)', desc: '40 lessons · lifetime access', stock: true, rating: 4.8 }, { id: 'dg2', name: 'Resume template pack', price: 149, emoji: '📄', bg: 'linear-gradient(135deg,#89f7fe,#66a6ff)', desc: '12 editable templates', stock: true, rating: 4.5 }, { id: 'dg3', name: 'UPSC notes e-book', price: 299, emoji: '📚', bg: 'linear-gradient(135deg,#fddb92,#d1fdff)', desc: 'PDF · 320 pages', stock: true, rating: 4.6 }] };
SELLERS.c_pro = { name: 'TaxEasy Advisors', username: 'taxeasy', emoji: '👔', color: '#455a64', cat: 'pro', about: 'CA, legal & business filings', category: 'Professional services', hours: 'Mon–Sat · 9:30 AM – 6:30 PM', address: 'Somajiguda, Hyderabad',
  products: [{ id: 'pr1', name: 'Income tax return filing', price: 999, emoji: '🧾', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)', desc: 'By a chartered accountant', stock: true, rating: 4.7 }, { id: 'pr2', name: 'GST registration', price: 1999, emoji: '🏢', bg: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', desc: '3–5 working days', stock: true, rating: 4.5 }, { id: 'pr3', name: '30-min legal consultation', price: 799, emoji: '⚖️', bg: 'linear-gradient(135deg,#d4fc79,#96e6a1)', desc: 'Video call with a lawyer', stock: true, rating: 4.6 }] };
MARKET_CATS.push(['digital', '💾 Digital'], ['pro', '👔 Professional']);

// ---------- Admin command center: more modules
const _modAdminPlus = MOD_RENDER.admin;
MOD_RENDER.admin = function () {
  const st = MS('admin2', () => ({ users: [['Kiran Tech', '@techguru_kiran', 'Creator', 'Active'], ['Quick Loans 247', '@quick.loans.247', 'Business', 'Under review'], ['Meera Designs', '@meera.designs', 'Personal', 'Active'], ['SBI Helpdesk (fake)', '@sbi.helpdesk.official', 'Personal', 'Suspended']], keys: [['Payments partner API', 'live', '1,200 req/min'], ['Government services gateway', 'live', '300 req/min'], ['AI gateway', 'live', '5,000 req/min'], ['Marketplace partners', 'paused', '600 req/min']] }));
  const tx = [['UPI · ₹24,999', '@new.seller.88 → 14 buyers in 10 min', 'High risk'], ['UPI · ₹1,500', '@priya.s → @gotrip', 'Normal'], ['Merchant · ₹86,000', 'Unverified business, first day', 'Review']];
  return _modAdminPlus() +
    sec('User management', st.users.map(([n, u, t, s], i) => `<div class="set-row"><div class="grow"><div class="ci-name">${esc(n)} <span class="ci-sub">${esc(u)}</span></div><div class="ci-sub">${t} account</div></div><span class="pill ${s === 'Active' ? '' : 'third'}">${s}</span><button class="btn sm" data-act="aduser" data-i="${i}">${s === 'Suspended' ? 'Restore' : 'Suspend'}</button></div>`).join('')) +
    sec('Payment monitoring', tx.map(([a, d, r]) => `<div class="set-row"><div class="grow"><div class="ci-name">${a}</div><div class="ci-sub">${esc(d)}</div></div><span class="pill ${r === 'Normal' ? '' : 'third'}">${r}</span>${r === 'Normal' ? '' : '<button class="btn sm danger" data-act="adhold">Hold</button>'}</div>`).join('')) +
    sec('Subscriptions', `<div class="kpi-grid">${kpi('Premium', '84,210', '+3.2%')}${kpi('Business', '42,560', '+380')}${kpi('Enterprise', '312', '+4')}${kpi('MRR', '₹2.9 Cr', '+5.1%')}</div>`) +
    sec('API management', st.keys.map(([n, s, r], i) => `<label class="set-row"><div class="grow"><div class="ci-name">${n}</div><div class="ci-sub">Rate limit ${r} · keys rotated every 90 days</div></div><input type="checkbox" class="switch" data-apikey="${i}" ${s === 'live' ? 'checked' : ''}></label>`).join(''));
};
Object.assign(XA, {
  aduser(el) { const u = S.mod.admin2.users[+el.dataset.i]; u[3] = u[3] === 'Suspended' ? 'Active' : 'Suspended'; save(); rerenderView(); toast(`${u[1]} ${u[3] === 'Suspended' ? 'suspended' : 'restored'} · logged in the audit trail`); },
  adhold(el) { el.textContent = 'On hold'; el.disabled = true; toast('Payment held for manual review'); },
});
document.addEventListener('change', (e) => { const i = e.target.dataset?.apikey; if (i == null) return; const k = S.mod.admin2.keys[+i]; k[1] = e.target.checked ? 'live' : 'paused'; save(); toast(`${k[0]} ${k[1]}`); });
