// Blueprint §1 privacy-first chat, §3 two-way live translation, §16 separate profiles, §2 AI image enhancement
'use strict';

// ---------- forwarding controls
const FORWARD_LIMIT = 5;
const noForward = (ch) => !!(ch && (ch.secret || ch.privacy?.noForward));

// ---------- secret chat
function startSecretChat(contactId) {
  const c = contact(contactId);
  if (!c) return;
  let ch = S.chats.find((x) => x.secret && x.contactId === contactId);
  if (!ch) {
    const t = Date.now();
    ch = {
      id: 'ch_' + uid(), type: 'direct', contactId, secret: true, unread: 0, disappearing: '24h',
      privacy: { noForward: true, screenshotAlert: true, hideReceipts: false, hideLastSeen: true },
      messages: [{ id: uid(), type: 'system', from: 'system', t, text: `🔒 Secret chat with ${c.name}. Messages are end-to-end encrypted, stay only on this device, can't be forwarded or copied, and disappear after 24 hours. Screenshot alerts are on.` }],
    };
    S.chats.push(ch);
    save();
  }
  ui.tab = 'chats'; ui.page = null; renderRail(); renderSidebar();
  openChat(ch.id);
}
function secretPickModal() {
  const people = S.contacts.filter((c) => c.isContact && !c.business);
  modal({
    title: 'New secret chat',
    body: `<p class="muted small">${icon('lock', 14)} Device-only, end-to-end encrypted, no forwarding or copying, disappears after 24 hours, with screenshot alerts.</p><div class="pick-list">${people.map((c) => `<button class="chat-item check-row bare-btn" data-secret="${c.id}">${avatarHTML(c, 40)}<div class="ci-body"><div class="ci-name">${esc(c.name)}</div><div class="ci-preview">@${esc(c.username)}</div></div></button>`).join('')}</div>`,
    onMount: (root, close) => root.addEventListener('click', (e) => { const b = e.target.closest('[data-secret]'); if (b) { close(); startSecretChat(b.dataset.secret); } }),
  });
}

// ---------- per-chat privacy
function chatPrivacyModal(ch) {
  const p = (ch.privacy ||= {});
  const direct = ch.type === 'direct';
  const canEdit = direct || isAdmin(ch);
  const row = (k, label, sub, locked) => `<label class="set-row plain"><div class="grow"><div class="ci-name">${label}</div><div class="ci-sub">${sub}</div></div><input type="checkbox" class="switch" data-cp="${k}" ${p[k] || (locked && ch.secret) ? 'checked' : ''} ${(!canEdit || (locked && ch.secret)) ? 'disabled' : ''}></label>`;
  modal({
    title: 'Chat privacy',
    body: `${ch.secret ? `<p class="muted small">${icon('lock', 14)} This is a secret chat — forwarding, copying and screenshot alerts are always on.</p>` : ''}
      ${!canEdit ? `<p class="muted small">Only group admins can change these settings.</p>` : ''}
      ${row('noForward', direct ? 'Disable forwarding & copying' : 'Members can’t forward or copy', 'Messages from this chat can’t be forwarded to other chats or copied', true)}
      ${row('screenshotAlert', 'Screenshot alerts', 'Notify the chat when a screenshot is detected', true)}
      ${row('hideReceipts', 'Hide my read receipts here', 'They won’t see blue ticks from you in this chat only')}
      ${direct ? row('hideLastSeen', 'Hide my last seen & online', 'Only for this person — your global setting stays the same') : ''}
      ${row('noSave', 'Don’t save media to gallery', 'Photos and videos from this chat stay inside WHATSMORE')}
      <div class="hint-box flat">${icon('info', 16)}<span>Screenshot detection depends on the device. Android apps can block screenshots; iOS and browsers can only detect some of them, so alerts are best-effort.</span></div>`,
    actions: [{ label: 'Done', primary: true }],
    onMount: (root) => root.addEventListener('change', (e) => {
      const k = e.target.dataset.cp;
      if (!k) return;
      p[k] = e.target.checked;
      if (k === 'noForward' || k === 'screenshotAlert') ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You turned ${p[k] ? 'on' : 'off'} ${k === 'noForward' ? 'forwarding & copying restrictions' : 'screenshot alerts'} for this chat` });
      save(); if (ui.active === ch.id) { renderBars(); renderMessages(); }
    }),
  });
}

// Best-effort screenshot detection: browsers only see some OS shortcuts
function screenshotDetected() {
  const ch = chatById(ui.active);
  if (!ch || !(ch.secret || ch.privacy?.screenshotAlert)) return;
  ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: '📸 You took a screenshot' });
  save(); renderMessages();
  toast(`Screenshot alert sent to ${chatTitle(ch).replace('🔒 ', '')}`);
}
document.addEventListener('keyup', (e) => { if (e.key === 'PrintScreen') screenshotDetected(); });
document.addEventListener('keydown', (e) => { if (e.metaKey && e.shiftKey && ['3', '4', '5', '#', '$', '%'].includes(e.key)) screenshotDetected(); });
// Secret chats hide their content when the window loses focus (app switcher / screen recording)
const secretBlur = (on) => { const ch = chatById(ui.active); main.classList.toggle('secret-hide', !!(on && ch?.secret)); };
window.addEventListener('blur', () => secretBlur(true));
window.addEventListener('focus', () => secretBlur(false));
document.addEventListener('visibilitychange', () => secretBlur(document.hidden));

// ---------- two-way live translation (§3)
const ALIASES = {
  'ఎలా ఉన్నారు': 'how are you', 'ఎలా ఉన్నావు': 'how are you', 'कैसे हो': 'how are you', 'आप कैसे हो': 'how are you', 'how r u': 'how are you',
  'im fine': 'i am fine', 'i m fine': 'i am fine', 'i am good': 'i am fine', 'నేను బాగున్నా': 'i am fine', 'thanks': 'thank you', 'see you': 'see you soon',
};
function phraseKey(piece) {
  const n = normPhrase(piece);
  if (!n) return null;
  if (ALIASES[n]) return ALIASES[n];
  if (PHRASES[n]) return n;
  return Object.keys(PHRASES).find((k) => Object.values(PHRASES[k]).some((v) => normPhrase(v) === n)) || null;
}
const englishOf = (k) => k[0].toUpperCase() + k.slice(1).replace(/\bi\b/g, 'I') + (/^(how|where)/.test(k) ? '?' : '.');
function phraseIn(k, lang) { return lang === 'en' ? englishOf(k) : PHRASES[k]?.[lang]; }
// Sentence-by-sentence phrasebook translation; null if any sentence is unknown (demo limitation)
function translateSentences(text, to) {
  const parts = String(text).split(/(?<=[.?!।])\s+/).filter((x) => normPhrase(x));
  if (!parts.length) return null;
  const out = parts.map((p) => { const k = phraseKey(p); return k ? phraseIn(k, to) : null; });
  return out.every(Boolean) ? out.join(' ') : null;
}
const langName = (k) => (LANG_LIST.find((l) => l[0] === k) || [k, k])[1];
function liveTrHTML(ch, m) {
  if (!ch.live || m.type !== 'text') return '';
  if (m.liveOut) return `<span class="tr live"><span class="tr-label">${icon('translate', 12)} They read it in ${esc(langName(m.liveOut.lang))}</span>${esc(m.liveOut.text)}</span>`;
  if (m.from === 'me' || (m.tr && (ch.translate || S.settings.autoTranslate))) return '';
  const r = translateSentences(m.text, ch.live.my);
  if (!r || normPhrase(r) === normPhrase(m.text)) return '';
  return `<span class="tr live"><span class="tr-label">${icon('translate', 12)} In ${esc(langName(ch.live.my))}</span>${esc(r)}</span>`;
}
function liveTranslateModal(ch) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  const cur = ch.live || { my: S.settings.myLang || 'te', their: c?.lang || 'en' };
  const opts = (sel) => LANG_LIST.map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');
  modal({
    title: '🌐 Live translation',
    body: `<p class="muted small">Each person writes and reads in their own language. The original message is always kept.</p>
      <label class="field"><span>I read and write in</span><select id="lt-my">${opts(cur.my)}</select></label>
      <label class="field"><span>${c ? esc(c.name) + ' reads' : 'Group members read'} in</span><select id="lt-their">${opts(cur.their)}</select></label>
      <div class="hint-box flat">${icon('sparkle', 16)}<span>Try it: write “ఎలా ఉన్నారు?” (Telugu) — they receive “How are you?”, and their English reply reaches you in Telugu. The demo uses a phrasebook (how are you, I am fine, thank you, good morning, where are you, I will come tomorrow, see you soon). Production uses an on-device model for 100+ languages so encrypted chats stay private.</span></div>`,
    actions: [
      ch.live && { label: 'Turn off', danger: true, onClick: () => { ch.live = null; save(); renderBars(); renderMessages({ keep: true }); toast('Live translation off'); } },
      { label: 'Cancel' },
      { label: ch.live ? 'Save' : 'Turn on', primary: true, onClick: (root) => {
        ch.live = { my: $('#lt-my', root).value, their: $('#lt-their', root).value };
        S.settings.myLang = ch.live.my;
        save(); renderBars(); renderMessages({ keep: true });
        toast(`Live translation on · you ${langName(ch.live.my)} ⇄ them ${langName(ch.live.their)}`);
      } },
    ].filter(Boolean),
  });
}
// Outgoing: attach the version the other person reads
const _sendMsgLive = sendMsg;
sendMsg = function (ch, partial, opts) {
  if (ch?.live && partial?.type === 'text' && ch.live.their !== ch.live.my) {
    const r = translateSentences(partial.text, ch.live.their);
    if (r && normPhrase(r) !== normPhrase(partial.text)) partial = { ...partial, liveOut: { lang: ch.live.their, text: r } };
  }
  return _sendMsgLive(ch, partial, opts);
};
// Incoming: with live translation on, the contact answers in their own language
const _scheduleReplyLive = scheduleReply;
scheduleReply = function (ch, trig) {
  if (ch?.live && ch.type === 'direct' && trig?.type === 'text' && !contact(ch.contactId)?.business && !contact(ch.contactId)?.blocked) {
    const k = phraseKey(trig.text.split(/(?<=[.?!।])\s+/)[0]);
    const reply = k === 'how are you' ? ['i am fine', 'how are you'] : k === 'thank you' ? ['see you soon'] : k === 'good morning' ? ['good morning', 'how are you'] : k === 'where are you' ? ['i will come tomorrow'] : null;
    if (reply) return simulateIncoming(ch, ch.contactId, { text: reply.map((x) => phraseIn(x, ch.live.their)).join(' ') }, 900);
  }
  return _scheduleReplyLive(ch, trig);
};

// ---------- extra chat bars, head menu items, message menu items
const _extraBarsPriv = extraBarsHTML;
extraBarsHTML = function (ch) {
  let h = _extraBarsPriv(ch);
  if (ch.secret) h += `<div class="bar secretbar">${icon('lock', 18)}<span class="grow">Secret chat · on this device only · disappears in 24 h · no forwarding · screenshot alerts</span></div>`;
  else if (ch.privacy?.noForward || ch.privacy?.screenshotAlert) h += `<div class="bar" data-act="chatprivacy">${icon('shield', 18)}<span class="grow">${[ch.privacy.noForward && 'Forwarding off', ch.privacy.screenshotAlert && 'Screenshot alerts on'].filter(Boolean).join(' · ')}</span><span class="link-btn">Privacy</span></div>`;
  if (ch.live) h += `<div class="bar livebar" data-act="livetr">${icon('translate', 18)}<span class="grow">Live translation · you <b>${esc(langName(ch.live.my))}</b> ⇄ them <b>${esc(langName(ch.live.their))}</b></span><span class="link-btn">Change</span></div>`;
  return h;
};
function extraHeadItems(ch) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  return [
    { label: ch.live ? 'Live translation · on' : 'Live translation', icon: 'translate', onClick: () => liveTranslateModal(ch) },
    { label: 'Chat privacy', icon: 'shield', onClick: () => chatPrivacyModal(ch) },
    c && !ch.secret && !c.business && { label: 'Start secret chat', icon: 'lock', onClick: () => startSecretChat(c.id) },
  ];
}
const _extraMsgItemsPriv = extraMsgItems;
extraMsgItems = function (ch, m) {
  const items = _extraMsgItemsPriv(ch, m);
  if (m.type === 'image') items.push({ label: 'Enhance with AI', icon: 'sparkle', onClick: () => enhanceImage(ch, m) });
  return items;
};
Object.assign(XA, {
  chatprivacy() { chatPrivacyModal(curChat()); },
  livetr() { liveTranslateModal(curChat()); },
  newsecret() { secretPickModal(); },
});
// "New secret chat" shortcut on the New chat page
const _newChatListPriv = newChatListHTML;
newChatListHTML = function () {
  const h = _newChatListPriv();
  if (ui.ncQuery.trim()) return h;
  return `<div class="list-row action" data-act="newsecret"><span class="action-ic" style="background:#37474f">${icon('lock', 22)}</span><div><div class="ci-name">New secret chat</div><div class="ci-sub">Device-only · no forwarding · disappears in 24 h</div></div></div>` + h;
};

// ---------- AI image enhancement
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function enhanceImage(ch, m) {
  if (!m.src) return toast('Send a real photo to try AI enhance — demo pictures are illustrations');
  let img;
  try { img = await loadImg(m.src); } catch (e) { return toast('Could not open this photo'); }
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d');
  cx.filter = 'contrast(1.14) saturate(1.3) brightness(1.06)';
  cx.drawImage(img, 0, 0);
  // light sharpen: overlay a slightly offset, low-opacity copy with "overlay" blending
  cx.filter = 'none'; cx.globalAlpha = 0.18; cx.globalCompositeOperation = 'overlay'; cx.drawImage(cv, -1, -1); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  const out = cv.toDataURL('image/jpeg', 0.88);
  modal({
    title: '✨ AI photo enhance', wide: true,
    body: `<div class="ba"><figure><img src="${m.src}" alt="Original"><figcaption>Original</figcaption></figure><figure><img src="${out}" alt="Enhanced"><figcaption>Enhanced · colour, contrast, light, sharpness</figcaption></figure></div><p class="muted small">Demo uses on-device filters. Production adds AI upscaling, denoise and low-light repair.</p>`,
    actions: [{ label: 'Cancel' }, { label: 'Send enhanced copy', primary: true, onClick: () => { sendMsg(ch, { type: 'image', src: out, caption: (m.caption ? m.caption + ' ' : '') + '✨ Enhanced' }); } }],
  });
}

// ---------- multiple profiles with separate chats (§16)
const profileOf = (c) => c.profile || 'personal';
function profileMatch(c) {
  const p = S.settings.profile || 'personal';
  return p === 'personal' ? !['business', 'creator'].includes(profileOf(c)) : profileOf(c) === p;
}
const _chatListProf = chatListHTML;
chatListHTML = function (mode) {
  const p = S.settings.profile || 'personal';
  const h = _chatListProf(mode);
  if (mode || p === 'personal' || ui.search.trim()) return h;
  const [name, e] = PROFILES[p];
  return `<div class="profile-banner">${e} <b>${name} profile</b> · separate chats, notifications and status<button class="link-btn" data-act="setprofile" data-p="personal">Back to Personal</button></div>` + h;
};
const _notifyProf = notify;
notify = function (ch, from, p) {
  if (!profileMatch(ch)) {
    const [name, e] = PROFILES[profileOf(ch)] || PROFILES.personal;
    return toast(`${e} New message in your ${name} profile`, () => switchProfile(profileOf(ch)));
  }
  return _notifyProf(ch, from, p);
};
const _switchProfileProf = switchProfile;
switchProfile = function (k) {
  _switchProfileProf(k);
  const ch = chatById(ui.active);
  if (ch && !profileMatch(ch)) closeChat();
  renderRail();
};
// New chats belong to the profile you are using
const _startDMProf = startDM;
startDM = function (userId) {
  const before = new Set(S.chats.map((c) => c.id));
  _startDMProf(userId);
  const p = S.settings.profile || 'personal';
  if (p !== 'personal') S.chats.filter((c) => !before.has(c.id)).forEach((c) => { c.profile = p; save(); refreshSidebar(); });
};
