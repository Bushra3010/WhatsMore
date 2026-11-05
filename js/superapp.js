// Telugu world-class blueprint gaps (v5): home search/notifications/profile bar (§2), location sharing (§3),
// username reach controls (§5), multi-language group translation (§10), in-call chat + meeting summary (§12),
// seller dashboard (§18), Do Not Disturb (§28), data privacy dashboard (§35), regions / DR / AI monitoring
// in the Command Center (§36–40), reporting everything (§41), Creator verified (§42), Plus & Business Pro
// plans (§44) and every major language (§52).
'use strict';
function ensureV5() {
  const st = S.settings;
  Object.assign(st.privacy, { canMessage: st.privacy.canMessage || 'everyone', canCall: st.privacy.canCall || 'contacts', canAddGroups: st.privacy.canAddGroups || 'contacts' });
  st.perms ||= { ai: true, location: false, contacts: true, camera: true, mic: true, cloud: true };
  st.wellbeing ||= {};
  if (st.wellbeing.dnd === undefined) Object.assign(st.wellbeing, { dnd: false, dndPlan: 'night' });
  S.reports ||= [];
  if (!S.notifLog) seedNotifs();
  if (!PLANS[st.plan]) st.plan = 'free';
}
setTimeout(() => { if (S) { ensureV5(); save(); } }, 0);

// ---------- §44 subscription model: Free, Plus, Business, Business Pro, Enterprise
(() => {
  const ent = PLANS.enterprise; delete PLANS.enterprise;
  Object.assign(PLANS.free, { perk: 'Chat, calls, groups, status' });
  Object.assign(PLANS.premium, { name: 'WHATSMORE Plus', perk: 'Advanced AI · more cloud · premium calling' });
  Object.assign(PLANS.business, { perk: 'Catalogue, orders, invoices, AI replies' });
  PLANS.businesspro = { name: 'Business Pro', quota: '5 TB', bytes: 5e12, price: '₹1,499 / month', perk: 'Advanced analytics + automation · team inbox' };
  PLANS.enterprise = Object.assign(ent, { perk: 'Large organisations · SSO · admin & audit' });
})();

// ---------- §52 every major language (names only; demo phrasebook translates common phrases)
const MORE_LANGS = ['Assamese', 'Konkani', 'Maithili', 'Manipuri', 'Nepali', 'Sanskrit', 'Sindhi', 'Santali', 'Dogri', 'Bhojpuri', 'Kashmiri', 'Afrikaans', 'Albanian', 'Amharic', 'Armenian', 'Azerbaijani', 'Basque', 'Belarusian', 'Bosnian', 'Bulgarian', 'Burmese', 'Catalan', 'Cebuano', 'Chinese (Traditional)', 'Croatian', 'Czech', 'Danish', 'Dutch', 'Esperanto', 'Estonian', 'Filipino', 'Finnish', 'Galician', 'Georgian', 'Greek', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hmong', 'Hungarian', 'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian', 'Javanese', 'Kazakh', 'Khmer', 'Kinyarwanda', 'Korean', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy', 'Malay', 'Maltese', 'Maori', 'Mongolian', 'Norwegian', 'Pashto', 'Persian', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'Samoan', 'Serbian', 'Sesotho', 'Shona', 'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Sundanese', 'Swahili', 'Swedish', 'Tajik', 'Tatar', 'Thai', 'Turkish', 'Turkmen', 'Ukrainian', 'Uyghur', 'Uzbek', 'Vietnamese', 'Welsh', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu'];
MORE_LANGS.forEach((n) => { if (!LANG_LIST.some((l) => l[1] === n)) LANG_LIST.push(['x-' + n.toLowerCase().replace(/[^a-z]+/g, '-'), n]); });
const _translateTextV5 = translateText;
translateText = function (text, to) { const r = _translateTextV5(text, to); return r && r.text ? r : null; };

// ---------- §2 home: search, notifications, profile; greeting in your language
const GREET = { te: ['శుభోదయం', 'శుభ మధ్యాహ్నం', 'శుభ సాయంత్రం'], hi: ['सुप्रभात', 'नमस्कार', 'शुभ संध्या'], ta: ['காலை வணக்கம்', 'மதிய வணக்கம்', 'மாலை வணக்கம்'], kn: ['ಶುಭೋದಯ', 'ಶುಭ ಮಧ್ಯಾಹ್ನ', 'ಶುಭ ಸಂಜೆ'], ml: ['സുപ്രഭാതം', 'ശുഭ ഉച്ച', 'ശുഭ സായാഹ്നം'] };
greeting = function () { const h = new Date().getHours(), i = h < 12 ? 0 : h < 17 ? 1 : 2; return (GREET[S.settings.myLang] || ['Good morning', 'Good afternoon', 'Good evening'])[i]; };
const NCATS = [['messages', 'Messages', 'chat'], ['calls', 'Calls', 'call'], ['payments', 'Payments', 'rupee'], ['business', 'Business', 'store'], ['marketplace', 'Marketplace', 'cart'], ['community', 'Community', 'groups'], ['ai', 'AI', 'sparkle'], ['security', 'Security', 'shield'], ['services', 'Services', 'bank']];
function seedNotifs() {
  const t = Date.now(), log = [];
  S.chats.filter((c) => c.unread > 0 && !c.locked).slice(0, 3).forEach((c, i) => { const m = c.messages[c.messages.length - 1]; log.push({ cat: 'messages', title: chatTitle(c), text: m ? preview(m) : 'New message', t: lastTime(c) || t - i * 60000, chatId: c.id }); });
  const pin = S.payments.filter((p) => p.dir === 'in').sort((a, b) => b.t - a.t)[0];
  if (pin) log.push({ cat: 'payments', title: 'Payment received', text: `${money(pin.amount)} from ${pin.with}`, t: pin.t });
  log.push({ cat: 'business', title: '2 business enquiries', text: 'Sunrise Bakery customers are asking about cake orders', t: t - 50 * MIN });
  log.push({ cat: 'ai', title: 'AI summary available', text: 'Weekend Trip · 3 decisions and 2 pending tasks', t: t - 70 * MIN });
  log.push({ cat: 'security', title: 'New device alert', text: 'Your account was used on WHATSMORE Web · Chrome on macOS', t: t - 3 * HOUR });
  log.push({ cat: 'services', title: 'Electricity bill due', text: 'TSSPDCL · due in 6 days', t: t - 5 * HOUR });
  log.push({ cat: 'community', title: 'Telangana Govt Updates', text: 'New online portal for income certificates is live', t: t - 6 * HOUR });
  log.push({ cat: 'calls', title: 'Missed call', text: 'Ramesh Kumar · voice call', t: t - 8 * HOUR });
  S.notifLog = log.sort((a, b) => b.t - a.t).map((n) => ({ id: uid(), read: false, ...n }));
}
const notifUnread = () => (S.notifLog || []).filter((n) => !n.read).length;
function logNotif(cat, title, text, extra = {}) {
  if (!S.notifLog) return;
  S.notifLog.unshift({ id: uid(), read: false, cat, title, text, t: Date.now(), ...extra });
  S.notifLog.length = Math.min(S.notifLog.length, 80);
  save();
  if (ui.tab === 'home') renderSidebar();
}
const _tabHomeV5 = tabHome;
tabHome = function () {
  ensureV5();
  const n = notifUnread();
  return _tabHomeV5().replace(/<button class="icon-btn" data-act="gotab" data-tab="settings" aria-label="Settings">.*?<\/button>/, '').replace('<div class="head-actions">', `<div class="head-actions"><button class="icon-btn" data-act="homesearch" title="Search" aria-label="Search">${icon('search')}</button><button class="icon-btn bell" data-act="notifs" title="Notifications" aria-label="Notifications${n ? `, ${n} unread` : ''}">${icon('bell')}${n ? `<span class="bell-n">${n > 9 ? '9+' : n}</span>` : ''}</button>`);
};
function notifCenter(cat = 'all') {
  const list = S.notifLog.filter((x) => cat === 'all' || x.cat === cat);
  const catOf = (k) => NCATS.find((c) => c[0] === k) || NCATS[0];
  const body = `<div class="chips wrap"><button class="chip ${cat === 'all' ? 'on' : ''}" data-nc="all">All</button>${NCATS.map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-nc="${k}">${l}</button>`).join('')}</div>
    <div class="nc-list">${list.length ? list.map((x) => `<button class="nc-row ${x.read ? '' : 'unread'}" data-nid="${x.id}"><span class="nc-ic">${icon(catOf(x.cat)[2], 18)}</span><span class="grow"><b>${esc(x.title)}</b><span class="ci-sub">${esc(x.text)}</span></span><span class="ci-sub nowrap">${listTime(x.t)}</span></button>`).join('') : '<div class="empty-list small">Nothing here yet.</div>'}</div>`;
  return body;
}
function openNotifCenter() {
  let cat = 'all';
  const m = modal({
    title: 'Notifications', wide: true, body: `<div id="nc-wrap">${notifCenter(cat)}</div>`,
    actions: [{ label: 'Notification settings', onClick: () => { ui.tab = 'settings'; ui.page = 'set-notify'; renderRail(); renderSidebar(); } }, { label: 'Mark all read', primary: true, onClick: () => { S.notifLog.forEach((x) => { x.read = true; }); save(); renderSidebar(); } }],
    onMount: (root, close) => root.addEventListener('click', (e) => {
      const c = e.target.closest('[data-nc]');
      if (c) { cat = c.dataset.nc; $('#nc-wrap', root).innerHTML = notifCenter(cat); return; }
      const r = e.target.closest('[data-nid]');
      if (!r) return;
      const x = S.notifLog.find((y) => y.id === r.dataset.nid); if (!x) return;
      x.read = true; save(); close(); renderSidebar();
      if (x.chatId && chatById(x.chatId)) return openChat(x.chatId);
      const go = { payments: ['svc', 'pay'], business: ['svc', 'business'], marketplace: ['svc', 'market'], services: ['svc', 'citizen'], community: ['svc', 'news'], ai: ['tab', 'ai'], calls: ['tab', 'calls'], security: ['page', 'set-security'], messages: ['tab', 'chats'] }[x.cat];
      if (go[0] === 'svc') A.svc({ dataset: { mod: go[1] } });
      else if (go[0] === 'tab') A.gotab({ dataset: { tab: go[1] } });
      else A.gotab({ dataset: { tab: 'settings', page: go[1] } });
    }),
  });
  return m;
}
// Every in-app notification is also kept in the notification center (and respects Do Not Disturb)
const _notifyV5 = notify;
notify = function (ch, from, p) {
  const text = typeof p === 'string' ? p : preview({ type: 'text', ...p });
  logNotif(contact(ch.contactId)?.business ? 'business' : 'messages', chatTitle(ch), (ch.type === 'group' ? firstName(from) + ': ' : '') + text, { chatId: ch.id });
  if (dndActive()) return;
  _notifyV5(ch, from, p);
};
function dndActive() {
  const w = S.settings.wellbeing || {};
  if (!w.dnd) return false;
  const h = new Date().getHours(), d = new Date().getDay();
  return w.dndPlan === 'always' || (w.dndPlan === 'night' && (h >= 22 || h < 7)) || (w.dndPlan === 'work' && d >= 1 && d <= 5 && h >= 9 && h < 18) || (w.dndPlan === 'weekend' && (d === 0 || d === 6));
}

// ---------- §3 location sharing (current or live)
const PLACES = [['Hitech City Metro Station', 17.4504, 78.3809], ['Inorbit Mall, Madhapur', 17.4344, 78.3866], ['Gachibowli Stadium', 17.4474, 78.3486], ['Charminar', 17.3616, 78.4747]];
function locationModal(ch) {
  modal({
    title: 'Share location',
    body: `<div class="loc-opts">
      <button class="ob-method" data-loc="now">${icon('place', 22)}<div class="grow"><b>Send your current location</b><span>Accurate to about 20 m</span></div></button>
      <div class="ob-method static">${icon('timer', 22)}<div class="grow"><b>Share live location</b><span>Updates until you stop sharing</span><div class="chips wrap mt">${[[15, '15 min'], [60, '1 hour'], [480, '8 hours']].map(([m, l]) => `<button class="chip" data-live="${m}">${l}</button>`).join('')}</div></div></div>
      <div class="list-label pad0">Nearby places</div>
      ${PLACES.map(([n, la, lo], i) => `<button class="nc-row" data-place="${i}"><span class="nc-ic">${icon('place', 18)}</span><span class="grow"><b>${esc(n)}</b><span class="ci-sub">${la.toFixed(4)}, ${lo.toFixed(4)}</span></span></button>`).join('')}</div>
      ${note('Location is shared only when you choose to, end-to-end encrypted, and live sharing stops automatically. You can turn location access off in Settings → Your data & privacy.', 'lock')}`,
    actions: [{ label: 'Cancel' }],
    onMount: (root, close) => root.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-place]'), now = e.target.closest('[data-loc]'), live = e.target.closest('[data-live]');
      if (!p && !now && !live) return;
      if (p) { const [name, lat, lng] = PLACES[+p.dataset.place]; close(); return sendMsg(ch, { type: 'location', lat, lng, name }); }
      if (!S.settings.perms.location) { toast('Location access is off · turn it on in Settings → Your data & privacy'); return; }
      close();
      const pos = await getPosition();
      sendMsg(ch, { type: 'location', lat: pos.lat, lng: pos.lng, name: pos.demo ? 'Current location (demo)' : 'Current location', acc: pos.acc, live: live ? Date.now() + live.dataset.live * MIN : 0 });
      if (live) toast(`📍 Sharing live location for ${live.textContent}`);
    }),
  });
}
function getPosition() {
  return new Promise((res) => {
    const demo = () => res({ lat: 17.4401, lng: 78.3489, acc: 20, demo: true });
    if (!navigator.geolocation) return demo();
    const t = setTimeout(demo, 6000);
    navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); }, () => { clearTimeout(t); toast('Location unavailable · sending a demo location'); demo(); }, { timeout: 5500, maximumAge: 60000 });
  });
}
function locationHTML(ch, m) {
  const live = m.live && m.live > Date.now();
  const url = `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=16/${m.lat}/${m.lng}`;
  return `<a class="loc-card" href="${url}" target="_blank" rel="noopener"><div class="loc-map"><span class="loc-pin ${live ? 'live' : ''}">${icon('place', 30)}</span></div>
    <div class="loc-info"><b>${esc(m.name || 'Location')}</b><span class="ci-sub">${(+m.lat).toFixed(4)}, ${(+m.lng).toFixed(4)}${m.acc ? ` · ±${m.acc} m` : ''}</span>${live ? `<span class="live-pill">● Live until ${fmtTime(m.live)}</span>` : m.live ? '<span class="ci-sub">Live location ended</span>' : ''}</div></a>
    ${live && m.from === 'me' ? `<div class="card-actions"><button class="link-btn danger" data-act="stoplive" data-mid="${m.id}">Stop sharing</button></div>` : ''}`;
}
XA.stoplive = (el) => { const ch = curChat(); const m = ch?.messages.find((x) => x.id === el.dataset.mid); if (m) { m.live = Date.now() - 1; save(); renderMessages({ keep: true }); toast('Stopped sharing live location'); } };

// ---------- §5 who can reach me
const _settingsPageV5 = settingsPage;
settingsPage = function (p) {
  ensureV5();
  if (p === 'set-data') return dataPageHTML();
  let h = _settingsPageV5(p);
  if (p === 'set-privacy') {
    const vis = [['everyone', 'Everyone'], ['contacts', 'My contacts'], ['nobody', 'Nobody']];
    h = h.replace(/<div class="list-label">Blocked contacts/, `<div class="list-label">Who can reach me</div>
      ${selectRow('privacy.canMessage', 'Who can message me', vis, 'Others send a chat request first')}
      ${selectRow('privacy.canCall', 'Who can call me', vis, 'Calls from others are silenced and listed as missed')}
      ${selectRow('privacy.canAddGroups', 'Who can add me to groups', vis, 'Others must send you an invite you accept')}
      <div class="list-label">Blocked contacts`);
  }
  return h;
};
const _tabSettingsV5 = tabSettings;
tabSettings = function () {
  const anchor = '<div class="list-row action" data-act="page" data-page="set-ai">';
  return _tabSettingsV5().replace(anchor, settingRow('set-data', 'download', 'Your data & privacy', 'Download data, permissions, reports, delete account') + anchor);
};

// ---------- §35 data privacy dashboard
function dataPageHTML() {
  const pr = S.settings.perms;
  const perm = (k, label, sub) => toggleRow('perms.' + k, label, sub);
  return pageHead('Your data & privacy') + `<div class="side-scroll">
    <div class="list-label">Your data</div>
    <div class="set-row clickable" data-act="dldata"><span class="action-ic plain">${icon('download', 22)}</span><div class="grow"><div class="ci-name">Download my data</div><div class="ci-sub">Profile, chats, contacts, settings and payments as a JSON file</div></div></div>
    <div class="list-label">Permissions</div>
    ${perm('ai', 'AI features', 'Summaries, smart replies and translation can read the chat you ask about')}
    ${perm('location', 'Location', 'Share location, My Area and SOS location')}
    ${perm('contacts', 'Contacts', 'Find friends on WHATSMORE from your address book')}
    ${perm('camera', 'Camera', 'Video calls, photos and QR scanning')}
    ${perm('mic', 'Microphone', 'Voice calls and voice messages')}
    ${perm('cloud', 'Cloud backup', 'Encrypted backup of chats and files')}
    <div class="list-label">Devices & sessions</div>
    ${settingRow('set-devices', 'devices', 'Device management', `${S.devices.length} device${S.devices.length === 1 ? '' : 's'}`)}
    ${settingRow('set-security', 'logout', 'Active sessions & logout', `${S.settings.sessions.length} active`)}
    <div class="list-label">My reports (${S.reports.length})</div>
    ${S.reports.length ? S.reports.slice().reverse().map((r) => `<div class="set-row"><span class="pill third">${esc(r.cat)}</span><div class="grow"><div class="ci-name">${esc(r.kind[0].toUpperCase() + r.kind.slice(1))} · ${esc(r.name)}</div><div class="ci-sub">${listTime(r.t)} · ${esc(r.status)}</div></div></div>`).join('') : '<div class="empty-list small">You haven\'t reported anything.</div>'}
    <div class="set-row clickable" data-act="reportscam"><span class="action-ic plain">${icon('warning', 22)}</span><div class="grow"><div class="ci-name">Report a scam or problem</div><div class="ci-sub">Fraud, phishing, security concern</div></div></div>
    <div class="list-label">Account</div>
    <div class="set-row clickable danger" data-act="delaccount"><span class="action-ic plain">${icon('delete', 22)}</span><div class="grow"><div class="ci-name">Delete my account</div><div class="ci-sub">Erases your profile, chats and backups</div></div></div>
    <div class="hint-box">${icon('shield', 16)}<span>Privacy by design: you choose what WHATSMORE can use, and you can take your data with you or delete it at any time.${pr.ai ? '' : ' AI features are off.'}</span></div>
  </div>`;
}
function downloadData() {
  const strip = (k, v) => (typeof v === 'string' && v.startsWith('data:') && v.length > 200 ? `[${v.slice(5, v.indexOf(';'))} file omitted]` : k === 'lockPin' ? '[hidden]' : v);
  const data = { exportedAt: new Date().toISOString(), app: 'WHATSMORE', profile: S.me, settings: S.settings, contacts: S.contacts.filter((c) => c.isContact), chats: S.chats, payments: S.payments, calls: S.calls, status: S.myStatus, reports: S.reports };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, strip, 2)], { type: 'application/json' }));
  a.download = `WHATSMORE-data-${S.me.username}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Your data download has started');
}
function deleteAccountModal() {
  modal({
    title: 'Delete your account?',
    body: `<p class="muted">This erases your profile, @username, chats, files, payments history and backups from this device. You'll be removed from all groups. This can't be undone.</p>
      ${note('Tip: download your data first from this page.', 'download')}
      <label class="field"><span>Type <b>@${esc(S.me.username)}</b> to confirm</span><input id="da-u" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Delete account', danger: true, onClick: (root) => {
      const v = $('#da-u', root).value.trim().replace(/^@/, '').toLowerCase();
      if (v !== S.me.username.toLowerCase()) { toast('Username does not match'); return false; }
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      toast('Account deleted (demo) · starting fresh');
      setTimeout(() => location.reload(), 900);
    } }],
  });
}

// ---------- §41 reporting: users, messages, groups, businesses, channels, scams
const REPORT_CATS = ['Spam', 'Harassment', 'Fraud', 'Impersonation', 'Illegal content', 'Security concern', 'Other'];
function reportTargetModal({ kind, name, excerpt = '', blockable = null, leaveable = null, defaultCat = 'Spam', details = false }) {
  modal({
    title: kind === 'scam' ? 'Report a scam or problem' : `Report ${kind === 'message' ? 'this message' : esc(name)}?`,
    body: `${excerpt ? `<div class="quote" style="--qc:var(--danger)"><div class="q-main"><div class="q-name">${esc(name)}</div><div class="q-text">${esc(excerpt)}</div></div></div>` : ''}
      <p class="muted small">${kind === 'message' ? 'This message and the 4 before it are sent to WHATSMORE Trust & Safety.' : kind === 'scam' ? 'Tell us what happened. Our Trust & Safety team reviews every report.' : 'Recent messages are sent to WHATSMORE Trust & Safety for review.'} They won't know who reported them.</p>
      ${REPORT_CATS.map((c) => `<label class="radio-row"><input type="radio" name="rc" value="${c}" ${c === defaultCat ? 'checked' : ''}> ${c}</label>`).join('')}
      ${details ? '<label class="field"><span>What happened? (optional)</span><textarea id="rc-d" rows="3" maxlength="500"></textarea></label>' : ''}
      ${blockable ? `<label class="radio-row"><input type="checkbox" id="rc-b" checked> Also block ${esc(name)}</label>` : ''}
      ${leaveable ? '<label class="radio-row"><input type="checkbox" id="rc-l"> Also exit this group</label>' : ''}`,
    actions: [{ label: 'Cancel' }, { label: 'Report', danger: true, onClick: (root) => {
      const cat = $('[name="rc"]:checked', root).value;
      S.reports.push({ id: uid(), kind, name, cat, t: Date.now(), status: 'Under review' });
      const adm = MS('admin', () => ({ reports: [], verif: [] }));
      (adm.reports ||= []).unshift([cat === 'Fraud' ? 'Fraud' : cat, name, `Reported by @${S.me.username} · ${kind}${excerpt ? ' · “' + excerpt.slice(0, 50) + '”' : ''}`]);
      if ($('#rc-b', root)?.checked) blockable();
      if ($('#rc-l', root)?.checked) leaveable();
      save();
      logNotif('security', 'Report received', `${cat} · ${name} · we'll update you in Your data & privacy`);
      toast('Report sent. Thanks for keeping WHATSMORE safe.');
      if (ui.page === 'set-data') renderSidebar();
    } }],
  });
}
reportModal = function (c) {
  reportTargetModal({ kind: c.business ? 'business' : 'user', name: c.name, blockable: c.blocked ? null : () => { c.blocked = true; save(); if (curChat()?.contactId === c.id) { renderComposer(); renderChatSub(); } renderDrawer(); } });
};
function reportMessage(ch, m) {
  const c = contact(m.from);
  reportTargetModal({ kind: 'message', name: senderName(m.from), excerpt: preview(m), defaultCat: scamCheck(m.text || '').length ? 'Fraud' : 'Spam', blockable: ch.type === 'direct' && c && !c.blocked ? () => { c.blocked = true; save(); renderComposer(); renderChatSub(); } : null });
}
Object.assign(XA, {
  homesearch() { ui.tab = 'chats'; ui.page = null; renderRail(); renderSidebar(); setTimeout(() => $('#chat-search')?.focus(), 30); },
  notifs() { openNotifCenter(); },
  dldata() { downloadData(); },
  delaccount() { deleteAccountModal(); },
  reportscam() { reportTargetModal({ kind: 'scam', name: 'Scam or problem', defaultCat: 'Fraud', details: true }); },
  reportgroup() { const ch = curChat(); reportTargetModal({ kind: 'group', name: ch.name, leaveable: () => { ch.left = true; ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'You left' }); save(); renderMessages(); renderComposer(); renderDrawer(); refreshSidebar(); } }); },
  reportchannel(el) { const c = CHANNELS.find((x) => x.id === el.dataset.c); if (c) reportTargetModal({ kind: 'channel', name: c.name, defaultCat: 'Spam' }); },
});

// ---------- §42 Creator verified, §12 news channels
BADGES.creator = ['Creator verified', '#8e24aa'];
CHANNELS.find((c) => c.id === 'n5').badge = 'creator';
const _modNewsV5 = MOD_RENDER.news;
MOD_RENDER.news = function () {
  return _modNewsV5()
    .replace(/(<button class="btn sm[^"]*" data-act="nwfollow" data-c="(n\d+)")/g, '<button class="icon-btn sm" data-act="reportchannel" data-c="$2" title="Report channel" aria-label="Report channel">' + icon('warning', 16) + '</button>$1')
    .replace('Business verified (registered business).', 'Business verified (registered business), Creator verified (creator identity and audience checked).');
};

// ---------- §28 Do Not Disturb
const _modWellbeingV5 = MOD_RENDER.wellbeing;
MOD_RENDER.wellbeing = function () {
  ensureV5();
  const w = S.settings.wellbeing;
  const focus = toggleRow('wellbeing.focus', 'Focus mode', 'Pause notifications except calls and favourites');
  const dnd = toggleRow('wellbeing.dnd', 'Do Not Disturb', dndActive() ? 'On now · notifications are silenced (they still appear in the notification center)' : 'Silence notifications on a schedule')
    + (w.dnd ? selectRow('wellbeing.dndPlan', 'DND schedule', [['always', 'Always, until I turn it off'], ['night', 'Every night 10 PM – 7 AM'], ['work', 'Work hours (Mon–Fri 9–6)'], ['weekend', 'Weekends']]) : '');
  return _modWellbeingV5().replace(focus, dnd + focus);
};
document.addEventListener('change', (e) => { if (/^wellbeing\.dnd/.test(e.target.dataset?.setting || '')) setTimeout(() => rerenderView(), 0); });

// ---------- §18 seller dashboard (marketplace)
const seedSeller = () => ({
  products: [
    { id: 'sp1', name: 'Blue cotton shirt', emoji: '👕', price: 1299, stock: 14 }, { id: 'sp2', name: 'Denim jeans', emoji: '👖', price: 1899, stock: 3 },
    { id: 'sp3', name: 'Silk saree', emoji: '🥻', price: 4599, stock: 6 }, { id: 'sp4', name: 'Leather wallet', emoji: '👛', price: 699, stock: 0 },
  ],
  orders: [
    { id: 'SO-2041', who: 'Priya Sharma', item: 'Blue cotton shirt · L', amt: 1299, status: 'New' }, { id: 'SO-2040', who: 'Ananya Rao', item: 'Silk saree', amt: 4599, status: 'Packed' },
    { id: 'SO-2038', who: 'Ramesh Kumar', item: 'Denim jeans · 32', amt: 1899, status: 'Shipped' }, { id: 'SO-2035', who: 'Meera Iyer', item: 'Leather wallet', amt: 699, status: 'Delivered' },
  ],
  promos: [{ id: 'pr1', code: 'DIWALI20', off: 20, until: Date.now() + 9 * DAY, on: true, used: 37 }],
});
const NEXT = { New: 'Packed', Packed: 'Shipped', Shipped: 'Delivered' };
function sellerHTML() {
  const s = MS('seller', seedSeller);
  const rev = [8.2, 11.4, 9.1, 14.8, 12.2, 17.6, 15.3], max = Math.max(...rev), days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const custs = [...new Set(s.orders.map((o) => o.who))];
  return `<div class="kpi-grid">${kpi('Revenue (7d)', money(88600), '+14%')}${kpi('Orders', String(s.orders.length + 42), '+6')}${kpi('Customers', String(custs.length + 118), '+9')}${kpi('Conversion', '4.8%', '+0.6')}</div>
  ${sec('Sales · last 7 days (₹ thousand)', `<div class="bars">${rev.map((v, i) => `<div class="bar-col"><div class="bar-v" style="height:${(v / max) * 100}%" title="₹${v}K"></div><span>${days[i]}</span></div>`).join('')}</div><div class="ci-sub">Top product: 👕 Blue cotton shirt · 38% of sales · most enquiries come from chat (61%)</div>`)}
  ${sec('Inventory', s.products.map((p) => `<div class="set-row"><span class="big-emoji">${p.emoji}</span><div class="grow"><div class="ci-name">${esc(p.name)}</div><div class="ci-sub">${money(p.price)} · ${p.stock ? `${p.stock} in stock` : 'Out of stock'} ${p.stock > 0 && p.stock <= 3 ? '<span class="pill third">Low stock</span>' : ''}</div></div><button class="icon-btn sm" data-act="slstock" data-p="${p.id}" data-d="-1" aria-label="Decrease stock">−</button><b class="stock-n">${p.stock}</b><button class="icon-btn sm" data-act="slstock" data-p="${p.id}" data-d="1" aria-label="Increase stock">+</button></div>`).join(''), `<button class="btn sm" data-act="sladd">${icon('add', 14)} Product</button>`)}
  ${sec('Orders', s.orders.map((o) => `<div class="set-row"><div class="grow"><div class="ci-name">${esc(o.item)}</div><div class="ci-sub">${o.id} · ${esc(o.who)} · ${money(o.amt)}</div></div><span class="pill step-${['New', 'Packed', 'Shipped'].indexOf(o.status) >= 0 ? ['New', 'Packed', 'Shipped'].indexOf(o.status) : 2}">${o.status}</span>${NEXT[o.status] ? `<button class="btn sm primary" data-act="slorder" data-o="${o.id}">Mark ${NEXT[o.status].toLowerCase()}</button>` : ''}</div>`).join(''))}
  ${sec('Customers', custs.map((n) => { const c = S.contacts.find((x) => x.name === n); return `<div class="set-row">${avatarHTML(c || { name: n, color: '#888' }, 34)}<div class="grow"><div class="ci-name">${esc(n)}</div><div class="ci-sub">${s.orders.filter((o) => o.who === n).length} order(s) · ${money(s.orders.filter((o) => o.who === n).reduce((a, o) => a + o.amt, 0))}</div></div>${c ? `<button class="btn sm" data-act="startdm" data-user="${c.id}">${icon('chat', 14)} Chat</button>` : ''}</div>`; }).join(''))}
  ${sec('Promotions', s.promos.map((p) => `<div class="set-row"><span class="pill ${p.on ? 'ok' : ''}">${esc(p.code)}</span><div class="grow"><div class="ci-name">${p.off}% off</div><div class="ci-sub">Until ${new Date(p.until).toLocaleDateString([], { day: 'numeric', month: 'short' })} · used ${p.used} times</div></div><input type="checkbox" class="switch" data-promo="${p.id}" ${p.on ? 'checked' : ''} aria-label="Promotion active"></div>`).join(''), `<button class="btn sm" data-act="slpromo">${icon('add', 14)} Promotion</button>`)}
  ${sec('Payments', `<div class="set-row"><div class="grow"><div class="ci-name">Settled to bank</div><div class="ci-sub">₹74,210 this week · next payout tomorrow 10 AM</div></div></div><div class="set-row"><div class="grow"><div class="ci-name">Pending</div><div class="ci-sub">₹14,390 · in transit with delivery partners</div></div></div>`)}
  ${note('Marketplace commission is charged only on completed orders. Customer chats, orders and payments stay linked to your verified business profile.', 'store')}`;
}
const _modMarketV5 = MOD_RENDER.market;
MOD_RENDER.market = function () {
  const st = MS('market', () => ({ cat: 'all', orders: [] }));
  const seg = `<div class="seg wide"><button class="${st.mode === 'sell' ? '' : 'on'}" data-act="mkmode" data-m="shop">${icon('cart', 16)} Shop</button><button class="${st.mode === 'sell' ? 'on' : ''}" data-act="mkmode" data-m="sell">${icon('store', 16)} Seller dashboard</button></div>`;
  return seg + (st.mode === 'sell' ? sellerHTML() : _modMarketV5());
};
Object.assign(XA, {
  mkmode(el) { MS('market', () => ({})).mode = el.dataset.m; save(); rerenderView(); },
  slstock(el) { const p = MS('seller', seedSeller).products.find((x) => x.id === el.dataset.p); p.stock = Math.max(0, p.stock + +el.dataset.d); save(); rerenderView(); },
  slorder(el) { const o = MS('seller', seedSeller).orders.find((x) => x.id === el.dataset.o); o.status = NEXT[o.status]; save(); rerenderView(); toast(`${o.id} marked ${o.status.toLowerCase()} · ${o.who} notified in chat`); },
  sladd() {
    modal({ title: 'Add product', body: '<label class="field"><span>Name</span><input id="sa-n" maxlength="40" autofocus></label><label class="field"><span>Price (₹)</span><input id="sa-p" type="number" min="1"></label><label class="field"><span>Stock</span><input id="sa-s" type="number" min="0" value="10"></label>',
      actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const n = $('#sa-n', root).value.trim(), p = +$('#sa-p', root).value; if (!n || !(p > 0)) { toast('Add a name and price'); return false; } MS('seller', seedSeller).products.push({ id: uid(), name: n, emoji: '📦', price: p, stock: Math.max(0, +$('#sa-s', root).value || 0) }); save(); rerenderView(); toast('Product added to your catalogue'); } }] });
  },
  slpromo() {
    modal({ title: 'New promotion', body: '<label class="field"><span>Coupon code</span><input id="pm-c" maxlength="16" placeholder="e.g. WEEKEND10" autocapitalize="characters" autofocus></label><label class="field"><span>Discount (%)</span><input id="pm-o" type="number" min="1" max="90" value="10"></label><label class="field"><span>Valid for (days)</span><input id="pm-d" type="number" min="1" value="7"></label>',
      actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: (root) => { const c = $('#pm-c', root).value.trim().toUpperCase().replace(/\s+/g, ''), o = +$('#pm-o', root).value; if (!c || !(o > 0 && o <= 90)) { toast('Add a code and a discount between 1 and 90%'); return false; } MS('seller', seedSeller).promos.push({ id: uid(), code: c, off: o, until: Date.now() + (+$('#pm-d', root).value || 7) * DAY, on: true, used: 0 }); save(); rerenderView(); toast(`Promotion ${c} is live`); } }] });
  },
});
document.addEventListener('change', (e) => { const id = e.target.dataset?.promo; if (!id) return; const p = MS('seller', seedSeller).promos.find((x) => x.id === id); p.on = e.target.checked; save(); toast(`${p.code} ${p.on ? 'activated' : 'paused'}`); });

// ---------- §36–40 Command Center: regions, disaster recovery, AI monitoring, developer health
const _modAdminV5 = MOD_RENDER.admin;
MOD_RENDER.admin = function () {
  const dr = MS('dr', () => ({ drill: Date.now() - 12 * DAY }));
  const regions = [['🇮🇳', 'India (Mumbai + Hyderabad)', 'Primary · data stays in India', '18 ms', 'ok'], ['🌏', 'Asia (Singapore)', 'Active', '41 ms', 'ok'], ['🇪🇺', 'Europe (Frankfurt)', 'Active · GDPR residency', '96 ms', 'ok'], ['🇺🇸', 'North America (Virginia)', 'Standby', '182 ms', 'warn']];
  return _modAdminV5()
    + sec('Global regions', regions.map(([f, n, s, l, k]) => `<div class="set-row"><span class="big-emoji">${f}</span><div class="grow"><div class="ci-name">${n}</div><div class="ci-sub">${s} · p95 ${l}</div></div><span class="pill ${k === 'ok' ? 'ok' : 'third'}">${k === 'ok' ? 'Healthy' : 'Standby'}</span></div>`).join(''))
    + sec('Disaster recovery', `<div class="kpi-grid">${kpi('RPO target', '≤ 5 min', '')}${kpi('RTO target', '≤ 30 min', '')}${kpi('Replication lag', '1.2 s', '')}${kpi('Last backup', '14 min ago', '')}</div>
      <div class="set-row"><div class="grow"><div class="ci-name">Last failover drill</div><div class="ci-sub">${dayLabel(dr.drill)} · India → Asia in ${dr.secs || 412} s · no data loss</div></div><button class="btn sm" data-act="drdrill">Run drill</button></div>`)
    + sec('AI monitoring', `<div class="kpi-grid">${kpi('AI requests today', '4.2M', '+8%')}${kpi('p95 latency', '640 ms', '-40 ms')}${kpi('Safety flags', '312', '')}${kpi('Cost / 1K req', '₹3.10', '-6%')}</div>
      ${[['AI gateway · Model A (general)', 62], ['Model B (translation)', 27], ['On-device model', 11]].map(([l, v]) => `<div class="mon"><span>${l}</span><div class="meter"><div style="width:${v}%"></div></div><b>${v}%</b></div>`).join('')}
      <div class="ci-sub">The AI gateway routes each task to the best model, so a provider can be swapped without rebuilding the app.</div>`)
    + sec('Developer health', [['Crash-free sessions', 99.7, '99.7%'], ['Database health', 96, 'Healthy · 38% CPU'], ['Payment failures', 8, '0.8%'], ['Push delivery', 99, '99.1%']].map(([l, v, t]) => `<div class="mon"><span>${l}</span><div class="meter"><div style="width:${v}%"></div></div><b>${t}</b></div>`).join(''));
};
XA.drdrill = () => {
  toast('Failover drill started · switching India → Asia (simulated)…', null, { ms: 2200 });
  setTimeout(() => { const d = MS('dr', () => ({})); d.drill = Date.now(); d.secs = 380 + Math.floor(Math.random() * 90); save(); if (ui.view === 'mod:admin') rerenderView(); toast(`✅ Drill complete in ${d.secs} s · within the 30-minute RTO, zero data loss`); }, 2400);
};

// ---------- §10 group live translation: everyone reads in their own language
const memberLang = (id) => contact(id)?.lang || 'en';
const _sendMsgV5 = sendMsg;
sendMsg = function (ch, partial, opts) {
  if (ch?.type === 'group' && ch.live && partial?.type === 'text') {
    const langs = [...new Set([ch.live.their, ...ch.members.map(memberLang)])].filter((l) => l !== ch.live.my);
    const outs = langs.map((lang) => ({ lang, text: translateSentences(partial.text, lang) })).filter((x) => x.text && normPhrase(x.text) !== normPhrase(partial.text));
    if (outs.length) partial = { ...partial, liveOuts: outs };
  }
  return _sendMsgV5(ch, partial, opts);
};
const _liveTrV5 = liveTrHTML;
liveTrHTML = function (ch, m) {
  if (ch.live && m.liveOuts?.length) return `<span class="tr live"><span class="tr-label">${icon('translate', 12)} Members read it in their language</span>${m.liveOuts.map((o) => `<span class="lt-line"><b>${esc(langName(o.lang))}:</b> ${esc(o.text)}</span>`).join('')}</span>`;
  return _liveTrV5(ch, m);
};
const _scheduleReplyV5 = scheduleReply;
scheduleReply = function (ch, trig) {
  if (ch?.type === 'group' && ch.live && trig?.type === 'text' && !ch.readOnly) {
    const k = phraseKey(trig.text.split(/(?<=[.?!।])\s+/)[0]);
    const reply = k === 'how are you' ? 'i am fine' : k === 'good morning' ? 'good morning' : k === 'where are you' ? 'i will come tomorrow' : k === 'thank you' ? 'see you soon' : null;
    if (reply) {
      const byLang = {};
      ch.members.forEach((id) => { const l = memberLang(id); if (!byLang[l] && contact(id)) byLang[l] = id; });
      const speakers = Object.entries(byLang).filter(([l]) => l !== ch.live.my).slice(0, 2);
      speakers.forEach(([l, id], i) => simulateIncoming(ch, id, { text: phraseIn(reply, l) }, 900 + i * 2600));
      if (speakers.length) return;
    }
  }
  return _scheduleReplyV5(ch, trig);
};

// ---------- §12 meetings: in-call chat and meeting summary
const _callXButtonsV5 = callXButtonsHTML;
callXButtonsHTML = function (call) {
  const multi = call.room || callPeople(call).length > 1;
  return _callXButtonsV5(call) + (multi ? `<button class="cbtn ${call.sheet === 'chat' ? 'on' : ''}" data-act="call-chat" title="Meeting chat" aria-label="Meeting chat">${icon('chat')}${call.chatUnread ? `<span class="cbadge">${call.chatUnread}</span>` : ''}</button>` : '');
};
const _callXStageV5 = callXStageHTML;
callXStageHTML = function (call) {
  let h = _callXStageV5(call);
  if (call.sheet === 'chat') h += `<div class="call-panel" role="dialog" aria-label="Meeting chat"><div class="row-between"><b>Meeting chat</b><button class="icon-btn sm light" data-act="call-chat" aria-label="Close">${icon('close', 18)}</button></div>
    <div class="mc-list" id="mc-list">${(call.chatLog || []).map((x) => `<div class="mc-msg ${x.who === 'You' ? 'me' : ''}"><b>${esc(x.who)}</b>${esc(x.text)}</div>`).join('') || '<div class="cp-sub">Messages here are seen by everyone in the meeting and saved to the summary.</div>'}</div>
    <form class="mc-form" data-mcform><input id="mc-in" placeholder="Message everyone" autocomplete="off" maxlength="300"><button class="btn sm primary">Send</button></form></div>`;
  return h;
};
XA['call-chat'] = () => { const c = ui.call; c.sheet = c.sheet === 'chat' ? null : 'chat'; c.panel = false; c.chatUnread = 0; renderCall(); if (c.sheet === 'chat') setTimeout(() => { $('#mc-in')?.focus(); const l = $('#mc-list'); if (l) l.scrollTop = l.scrollHeight; }, 30); };
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-mcform]')) return;
  e.preventDefault();
  const c = ui.call, inp = $('#mc-in'), text = inp?.value.trim();
  if (!c || !text) return;
  (c.chatLog ||= []).push({ who: 'You', text, t: Date.now() });
  renderCall(); setTimeout(() => { $('#mc-in')?.focus(); const l = $('#mc-list'); if (l) l.scrollTop = l.scrollHeight; }, 0);
  const people = callPeople(c);
  if (people.length) setTimeout(() => {
    if (ui.call !== c) return;
    const who = senderName(people[Math.floor(Math.random() * people.length)]).split(' ')[0];
    c.chatLog.push({ who, text: pick(['👍 Got it', 'Agreed', 'Can you share the link here?', 'Noted, thanks!', 'I will send the file after the call']), t: Date.now() });
    if (c.sheet !== 'chat') c.chatUnread = (c.chatUnread || 0) + 1;
    renderCall(); const l = $('#mc-list'); if (l) l.scrollTop = l.scrollHeight;
  }, 1800);
});
function meetingSummaryText(call, secs) {
  const people = callPeople(call).map((id) => senderName(id).split(' ')[0]);
  const lines = (call.ccLines || []).map((l) => l.text.en);
  const said = [...new Set(lines)].slice(0, 4);
  const actions = lines.filter((t) => /please|by friday|share|send|ready/i.test(t)).slice(0, 3);
  const chat = (call.chatLog || []).filter((x) => /share|send|file|link/i.test(x.text));
  return ['📝 Meeting summary (AI)', `⏱ ${fmtDur(secs)} · 👥 You${people.length ? ', ' + people.slice(0, 6).join(', ') + (people.length > 6 ? ` +${people.length - 6}` : '') : ''}`,
    said.length ? '• Discussed: ' + said.join(' · ') : '• Discussed: live captions were off, so only the chat and attendance are summarised',
    actions.length || chat.length ? '✅ Action items: ' + [...actions, ...chat.map((x) => `${x.who}: ${x.text}`)].slice(0, 4).join(' · ') : '✅ Action items: none recorded',
    `💬 ${(call.chatLog || []).length} chat message(s)${call.recDur || call.rec ? ' · 🔴 recording saved' : ''}`].join('\n');
}
const _endCallV5 = endCall;
endCall = function () {
  const call = ui.call;
  const secs = call?.start ? Math.round((Date.now() - call.start) / 1000) : 0;
  const multi = call && (call.room || callPeople(call).length > 1);
  _endCallV5();
  if (!call || !multi || secs < 10) return;
  const text = meetingSummaryText(call, secs);
  if (call.ch) setTimeout(() => { sendMsg(call.ch, { type: 'text', text }); toast('📝 Meeting summary posted to the chat'); }, 400);
  else setTimeout(() => modal({ title: 'Meeting summary', body: `<pre class="meet-sum">${esc(text)}</pre>`, actions: [{ label: 'Copy', onClick: () => { copyText(text); return false; } }, { label: 'Done', primary: true }] }), 400);
  logNotif('calls', 'Meeting summary ready', `${fmtDur(secs)} · ${callPeople(call).length + 1} people`);
};
