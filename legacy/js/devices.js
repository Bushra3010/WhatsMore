// Linked devices + live multi-tab sync, Anti-scam AI, voice AI, read aloud, translation, data migration
'use strict';

// ---------- migrate saved demo data to include the new features
function migrate() {
  const seed = WM_SEED();
  ['devices', 'mod', 'signature'].forEach((k) => { if (S[k] === undefined) S[k] = seed[k]; });
  Object.entries(seed.settings).forEach(([k, v]) => { if (S.settings[k] === undefined) S.settings[k] = v; });
  if (!S.x2) {
    seed.contacts.forEach((c) => { if (!contact(c.id)) S.contacts.push(c); });
    seed.chats.forEach((c) => { if (!chatById(c.id)) S.chats.push(c); });
    const rm = chatById('ch_ramesh'), seedRm = seed.chats.find((c) => c.id === 'ch_ramesh');
    if (rm && !rm.messages.some((m) => m.type === 'signreq')) { rm.messages.push(...seedRm.messages.slice(-2)); rm.unread = (rm.unread || 0) + 1; }
    S.x2 = 1;
  }
  save();
}

// ---------- linked devices
const DEVICE_KINDS = [['laptop', 'Windows laptop · WHATSMORE Desktop'], ['laptop', 'MacBook Air · WHATSMORE for Mac'], ['tablet', 'iPad · WHATSMORE for iPad'], ['tablet', 'Android tablet'], ['devices', 'Chrome · WHATSMORE Web']];
const MAX_LINKED = 4;
const deviceIcon = (k) => icon(k === 'phone' ? 'phone' : k === 'tablet' ? 'tablet' : k === 'laptop' ? 'laptop' : 'devices', 24);
const fingerprint = (id) => Array.from({ length: 4 }, (_, i) => (hash(id + i) % 65536).toString(16).toUpperCase().padStart(4, '0')).join(' ');
function devicesPage() {
  const linked = S.devices.filter((d) => !d.primary);
  const row = (d) => `<div class="set-row dev" data-act="devmenu" data-dev="${d.id}"><span class="dev-ic ${d.current ? 'on' : ''}">${deviceIcon(d.kind)}</span><div class="grow"><div class="ci-name">${esc(d.name)}</div>
    <div class="ci-sub">${d.primary ? 'Primary phone' : d.current ? '<span class="green">This device · active now</span>' : 'Last active ' + listTime(d.t).toLowerCase()} · ${esc(d.where)}</div><div class="ci-sub mono">${icon('lock', 11)} Key ${fingerprint(d.id)}</div></div>${d.primary ? '' : icon('chevright', 20, 'muted')}</div>`;
  return pageHead('Linked devices') + `<div class="side-scroll">
    <div class="dev-hero"><div class="dev-art">${icon('phone', 34)}${icon('laptop', 46)}${icon('tablet', 38)}</div>
      <p>Use WHATSMORE on <b>up to ${MAX_LINKED} linked devices</b> and 1 phone at the same time. Linked devices keep working even when your phone is offline.</p>
      <button class="btn primary" data-act="linkdevice" ${linked.length >= MAX_LINKED ? 'disabled' : ''}>${icon('qr', 18)} Link a device</button>
      <div class="ci-sub">${linked.length} of ${MAX_LINKED} linked</div></div>
    <div class="list-label">Device status</div>${S.devices.map(row).join('')}
    <div class="list-label">Options</div>
    ${toggleRow('devices.syncHistory', 'Sync full chat history', 'New devices receive an encrypted copy of your recent chats')}
    ${toggleRow('devices.biometricLink', 'Confirm with fingerprint to link', 'Extra protection before any new device is added')}
    ${toggleRow('security.deviceAlerts', 'New device alerts', 'Get a security alert whenever a device is linked')}
    <div class="hint-box">${icon('lock', 16)}<span>Every device has its own encryption keys. Your personal messages, calls and files stay end-to-end encrypted on all linked devices.</span></div>
    <div class="hint-box">${icon('devices', 16)}<span><b>Try live sync:</b> open this demo in a second browser tab or window. It behaves like a linked device — send a message in one and watch it appear in the other.</span></div>
    ${linked.length > 1 ? '<div class="pad"><button class="btn danger block" data-act="devlogoutall">Log out from all linked devices</button></div>' : ''}
  </div>`;
}
function linkDeviceModal() {
  if (S.devices.filter((d) => !d.primary).length >= MAX_LINKED) return toast(`You can link up to ${MAX_LINKED} devices. Log out of one first.`);
  let timer, left = 20, code;
  const newCode = () => { code = Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); return code; };
  modal({
    title: 'Link a device',
    wide: true,
    body: `<div class="link-grid"><ol class="link-steps"><li>Open <b>web.whatsmore.app</b> or WHATSMORE Desktop on your computer or tablet</li><li>Choose <b>Link with phone</b></li><li>Point your phone at this screen to scan the QR code</li></ol>
      <div class="link-qr"><div id="lk-qr" class="qr-box"></div><div class="ci-sub" id="lk-timer">Code refreshes in 20s</div><button class="link-btn" id="lk-code">Link with a code instead</button><div id="lk-codebox"></div></div></div>
      <div class="hint-box flat">${icon('devices', 16)}<div class="grow"><b>Demo:</b> simulate scanning from
        <div class="join-sim"><select id="lk-kind">${DEVICE_KINDS.map(([, n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}</select><button class="btn sm primary" id="lk-go">Scan</button></div></div></div>
      <div id="lk-progress"></div>`,
    actions: [{ label: 'Close' }],
    onClose: () => clearInterval(timer),
    onMount: (root, close) => {
      const draw = () => { const box = $('#lk-qr', root); box.innerHTML = ''; drawQR(box, 'whatsmore://link/' + newCode()); if ($('#lk-codebox', root).innerHTML) showCode(); };
      const showCode = () => { $('#lk-codebox', root).innerHTML = `<div class="link-code">${code.split('').map((c) => `<span>${c}</span>`).join('')}</div><div class="ci-sub">Enter this code on the other device</div>`; };
      draw();
      timer = setInterval(() => { left--; if (left <= 0) { left = 20; draw(); } const t = $('#lk-timer', root); if (t) t.textContent = `Code refreshes in ${left}s`; }, 1000);
      $('#lk-code', root).addEventListener('click', showCode);
      $('#lk-go', root).addEventListener('click', () => {
        const [kind, name] = DEVICE_KINDS[+$('#lk-kind', root).value];
        const go = () => runLinking(root, kind, name, close);
        if (S.settings.devices.biometricLink) {
          $('#lk-progress', root).innerHTML = `<div class="bio">${icon('key', 28)}<div class="grow"><b>Confirm it's you</b><div class="ci-sub">Touch the fingerprint sensor to link ${esc(name)}</div></div><button class="btn sm primary" id="lk-bio">👆 Use fingerprint</button></div>`;
          $('#lk-bio', root).addEventListener('click', go);
        } else go();
      });
    },
  });
}
function runLinking(root, kind, name, close) {
  const steps = ['Verifying QR code and device identity', 'Exchanging encryption keys', S.settings.devices.syncHistory ? `Syncing encrypted history · ${S.chats.length} chats` : 'Setting up (history sync off)', 'Linked'];
  const box = $('#lk-progress', root);
  let i = 0;
  const tick = () => {
    if (!box.isConnected) return;
    box.innerHTML = `<div class="link-prog">${steps.map((s, j) => `<div class="lp-step ${j < i ? 'done' : j === i ? 'now' : ''}">${j < i ? icon('check', 16) : j === i ? '<span class="spin"></span>' : '<span class="dot"></span>'}<span>${esc(s)}</span></div>`).join('')}<div class="meter"><div style="width:${(i / (steps.length - 1)) * 100}%"></div></div></div>`;
    if (i < steps.length - 1) { i++; setTimeout(tick, 900); return; }
    const d = { id: 'd_' + uid(), kind, name, where: 'Hyderabad, IN', t: Date.now() };
    S.devices.push(d);
    S.settings.sessions.push({ id: d.id, name, where: d.where, t: d.t });
    save();
    setTimeout(() => {
      close();
      if (ui.page === 'set-devices') renderSidebar();
      if (S.settings.security.deviceAlerts) toast(`🔐 Security alert: <b>${esc(name)}</b> was linked to your account just now. Not you? Tap to review.`, () => { ui.tab = 'settings'; ui.page = 'set-devices'; renderRail(); renderSidebar(); }, { html: true, ms: 6000 });
    }, 700);
  };
  tick();
}
function deviceMenu(id, anchor) {
  const d = S.devices.find((x) => x.id === id);
  if (!d || d.primary) return;
  showMenu(anchor, [
    { label: 'Rename', icon: 'edit', onClick: () => modal({ title: 'Rename device', body: `<label class="field"><span>Name</span><input id="dv-n" maxlength="40" value="${esc(d.name)}" autofocus></label>`, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: (root) => { d.name = $('#dv-n', root).value.trim() || d.name; save(); renderSidebar(); } }] }) },
    { label: 'Encryption key', icon: 'lock', onClick: () => modal({ title: d.name, body: `<p class="muted">Compare this key on the device to verify it.</p><div class="sec-code">${fingerprint(d.id).split(' ').concat(fingerprint(d.id + 'x').split(' ')).map((x) => `<span>${x}</span>`).join('')}</div>`, actions: [{ label: 'Done', primary: true }] }) },
    !d.current && { label: 'Log out', icon: 'logout', danger: true, onClick: () => confirmModal(`Log out of ${d.name}?`, 'This device will stop receiving messages until it is linked again.', 'Log out', () => { S.devices = S.devices.filter((x) => x !== d); S.settings.sessions = S.settings.sessions.filter((s) => s.id !== d.id); save(); renderSidebar(); toast('Device logged out'); }) },
  ]);
}
Object.assign(XA, {
  linkdevice() { linkDeviceModal(); },
  devmenu(el) { deviceMenu(el.dataset.dev, el); },
  devlogoutall() { confirmModal('Log out from all linked devices?', 'Every linked device except your phone and this browser will be signed out.', 'Log out', () => { const gone = S.devices.filter((d) => !d.primary && !d.current).map((d) => d.id); S.devices = S.devices.filter((d) => !gone.includes(d.id)); S.settings.sessions = S.settings.sessions.filter((s) => !gone.includes(s.id)); save(); renderSidebar(); toast('Logged out from all linked devices'); }); },
});

// Another tab of this demo = another linked device. Pick up its changes live.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try { S = JSON.parse(e.newValue); } catch (err) { return; }
  if (ui.active && !chatById(ui.active)) ui.active = null;
  renderRail();
  if (!$('.modal-backdrop') && !document.activeElement?.matches?.('input, textarea')) renderSidebar(); else refreshSidebar();
  if (ui.active) { renderChatSub(); renderBars(); renderMessages(); } else if (!ui.view) renderMain();
});

// ---------- Anti-scam AI (warns, never blocks — risk is shown with uncertainty)
function scamCheck(t) {
  const s = (t || '').toLowerCase(), r = [];
  if (/\b(otp|one[- ]time password|upi pin|cvv)\b/.test(s) && /\b(share|send|tell|forward|enter)\b/.test(s)) r.push('Asks you to share an OTP / PIN — genuine banks and apps never ask for this');
  if (/(bit\.ly|tinyurl\.com|goo\.gl|rb\.gy|cutt\.ly|is\.gd)\//.test(s) || /https?:\/\/[^\s]*\.(xyz|top|click|tk|buzz|loan)\b/.test(s) || /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(s)) r.push('Contains a shortened or suspicious link');
  if (/\bkyc\b|account (will be )?(blocked|suspended|closed|frozen)|verify your account/.test(s)) r.push('Threatens to block your account or asks for a KYC update');
  if (/(lottery|you have won|you('ve| have) been selected|jackpot|lucky draw|claim (your )?(reward|prize))/.test(s)) r.push('Promises a prize or lottery win');
  if (/(processing fee|registration fee|pay .{0,20}to (claim|receive|unlock))/.test(s)) r.push('Asks for a fee before you receive money');
  if (/(double your money|guaranteed returns?|\d+% (daily|weekly|monthly)|risk[- ]free (profit|returns?))/.test(s)) r.push('Promises unrealistic investment returns');
  if (r.length && /\b(urgent|immediately|today itself|within \d+ (hours?|minutes?)|last chance|right now)\b/.test(s)) r.push('Pressures you to act fast');
  return r;
}
function scamWarningHTML(m) {
  if (m.safe) return '';
  const r = scamCheck(m.text);
  if (!r.length) return '';
  return `<div class="scam-warn"><div class="sw-head">${icon('warning', 16)} Potentially suspicious message</div><ul>${r.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="ci-sub">This message has signs often seen in scams. Review carefully before clicking links or sending money.</div>
    <div class="sw-acts"><button class="link-btn" data-act="scam-report" data-mid="${m.id}">Report &amp; block</button><button class="link-btn" data-act="scam-safe" data-mid="${m.id}">It's safe</button></div></div>`;
}
function reportScam(ch, m) {
  const c = ch.type === 'direct' ? contact(ch.contactId) : contact(m.from);
  confirmModal('Report scam?', `This message will be sent to the WHATSMORE Trust & Safety team${c ? ' and ' + c.name + ' will be blocked' : ''}.`, 'Report & block', () => {
    if (c) c.blocked = true;
    m.reported = true;
    save(); renderChatSub(); renderComposer(); renderMessages({ keep: true });
    toast('🛡️ Reported. Thanks for keeping WHATSMORE safe.');
  });
}
Object.assign(XA, {
  'scam-safe'(el) { const m = msgOf(el); if (m) { m.safe = true; save(); renderMessages({ keep: true }); toast('Marked as safe'); } },
  'scam-report'(el) { const m = msgOf(el); if (m) reportScam(curChat(), m); },
  addcontact() { const c = contact(curChat()?.contactId); if (c) { c.isContact = true; save(); renderBars(); toast(`${c.name} added to contacts`); } },
});
// Links inside a flagged message ask before opening
document.addEventListener('click', (e) => {
  const a = e.target.closest('.bubble a[href]');
  if (!a || !a.closest('.bubble').querySelector('.scam-warn')) return;
  e.preventDefault(); e.stopPropagation();
  confirmModal('Open this link?', `${a.href}\n\nWHATSMORE AI flagged this message as potentially suspicious. Never enter OTPs, PINs or passwords on pages opened from messages like this.`, 'Open anyway', () => window.open(a.href, '_blank', 'noopener'));
}, true);
function extraBarsHTML(ch) {
  if (ch.type !== 'direct') return '';
  const c = contact(ch.contactId);
  if (!c || c.isContact || c.business || c.blocked || ch.request) return '';
  return `<div class="bar warnbar">${icon('warning', 18)}<span class="grow">Not in your contacts · @${esc(c.username)}. Be careful with links and payment requests.</span><button class="link-btn" data-act="block">Block</button><button class="link-btn" data-act="addcontact">Add</button></div>`;
}

// ---------- voice AI
const TRANSCRIPTS = {
  c_siva: { text: 'అన్నా, PRD లో కొన్ని మార్పులు చేశాను, ఒకసారి చూడు. రేపు 11 గంటల మీటింగ్‌కి డెమో రెడీగా ఉంచు.', en: "Brother, I made some changes to the PRD, please check once. Keep the demo ready for tomorrow's 11 o'clock meeting.", sum: 'Review the PRD changes · Demo needed for tomorrow 11 AM meeting' },
  default: { text: 'Hi! Just wanted to check if everything is on track. Call me back when you are free.', sum: 'Check-in · wants a call back' },
};
function transcribeVoice(ch, m) {
  if (m.transcript) { delete m.transcript; save(); return renderMessages({ keep: true }); }
  toast('🎙️ Transcribing on your device…', null, { ms: 1200 });
  setTimeout(() => {
    const t = m.from === 'me' ? { text: '(Your voice note) Running 10 minutes late, start without me.', sum: 'Running late' } : TRANSCRIPTS[m.from] || TRANSCRIPTS.default;
    m.transcript = t.text + (t.en ? `\n🌐 ${t.en}` : '') + `\n🧠 Summary (${Math.max(3, Math.round(m.dur / 4))}s read): ${t.sum}`;
    save(); renderMessages({ keep: true });
  }, 1100);
}
function readAloud(text) {
  if (!('speechSynthesis' in window)) return toast('Text-to-voice is not supported in this browser');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, ''));
  u.lang = /[ఀ-౿]/.test(text) ? 'te-IN' : /[ऀ-ॿ]/.test(text) ? 'hi-IN' : /[஀-௿]/.test(text) ? 'ta-IN' : 'en-IN';
  speechSynthesis.speak(u);
  toast('🔊 Reading aloud');
}

// ---------- translation (demo phrasebook — production uses an on-device / encrypted model)
const LANG_LIST = [['en', 'English'], ['te', 'Telugu'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['kn', 'Kannada'], ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['or', 'Odia'], ['ur', 'Urdu'], ['ar', 'Arabic'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['zh', 'Chinese'], ['ja', 'Japanese']];
const PHRASES = {
  'how are you': { te: 'మీరు ఎలా ఉన్నారు?', hi: 'आप कैसे हैं?', ta: 'எப்படி இருக்கிறீர்கள்?', kn: 'ಹೇಗಿದ್ದೀರಿ?', ml: 'സുഖമാണോ?', mr: 'तुम्ही कसे आहात?', bn: 'আপনি কেমন আছেন?', gu: 'તમે કેમ છો?', pa: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', or: 'ଆପଣ କେମିତି ଅଛନ୍ତି?', ur: 'آپ کیسے ہیں؟', ar: 'كيف حالك؟', fr: 'Comment allez-vous ?', es: '¿Cómo estás?', de: 'Wie geht es dir?', zh: '你好吗？', ja: 'お元気ですか？' },
  'i will come tomorrow': { te: 'నేను రేపు వస్తాను.', hi: 'मैं कल आऊंगा।', ta: 'நான் நாளை வருவேன்.', kn: 'ನಾನು ನಾಳೆ ಬರುತ್ತೇನೆ.', ml: 'ഞാൻ നാളെ വരും.', mr: 'मी उद्या येईन.', bn: 'আমি কাল আসব।', gu: 'હું કાલે આવીશ.', pa: 'ਮੈਂ ਕੱਲ੍ਹ ਆਵਾਂਗਾ।', or: 'ମୁଁ କାଲି ଆସିବି।', ur: 'میں کل آؤں گا۔', ar: 'سآتي غدًا.', fr: 'Je viendrai demain.', es: 'Vendré mañana.', de: 'Ich komme morgen.', zh: '我明天来。', ja: '明日行きます。' },
  'i am fine': { te: 'నేను బాగున్నాను.', hi: 'मैं ठीक हूँ।', ta: 'நான் நன்றாக இருக்கிறேன்.', kn: 'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ.', ml: 'എനിക്ക് സുഖമാണ്.', mr: 'मी ठीक आहे.', bn: 'আমি ভালো আছি।', gu: 'હું મજામાં છું.', pa: 'ਮੈਂ ਠੀਕ ਹਾਂ।', or: 'ମୁଁ ଭଲ ଅଛି।', ur: 'میں ٹھیک ہوں۔', ar: 'أنا بخير.', fr: 'Je vais bien.', es: 'Estoy bien.', de: 'Mir geht es gut.', zh: '我很好。', ja: '元気です。' },
  'thank you': { te: 'ధన్యవాదాలు', hi: 'धन्यवाद', ta: 'நன்றி', kn: 'ಧನ್ಯವಾದಗಳು', ml: 'നന്ദി', mr: 'धन्यवाद', bn: 'ধন্যবাদ', gu: 'આભાર', pa: 'ਧੰਨਵਾਦ', or: 'ଧନ୍ୟବାଦ', ur: 'شکریہ', ar: 'شكرًا', fr: 'Merci', es: 'Gracias', de: 'Danke', zh: '谢谢', ja: 'ありがとう' },
  'good morning': { te: 'శుభోదయం', hi: 'सुप्रभात', ta: 'காலை வணக்கம்', kn: 'ಶುಭೋದಯ', ml: 'സുപ്രഭാതം', mr: 'सुप्रभात', bn: 'সুপ্রভাত', gu: 'સુપ્રભાત', pa: 'ਸ਼ੁਭ ਸਵੇਰ', or: 'ଶୁଭ ସକାଳ', ur: 'صبح بخیر', ar: 'صباح الخير', fr: 'Bonjour', es: 'Buenos días', de: 'Guten Morgen', zh: '早上好', ja: 'おはようございます' },
  'see you soon': { te: 'త్వరలో కలుద్దాం', hi: 'जल्द मिलते हैं', ta: 'விரைவில் சந்திப்போம்', kn: 'ಬೇಗ ಭೇಟಿಯಾಗೋಣ', ml: 'ഉടൻ കാണാം', mr: 'लवकरच भेटू', bn: 'শীঘ্রই দেখা হবে', gu: 'જલ્દી મળીએ', pa: 'ਜਲਦੀ ਮਿਲਦੇ ਹਾਂ', or: 'ଶୀଘ୍ର ଦେଖା ହେବ', ur: 'جلد ملتے ہیں', ar: 'أراك قريبًا', fr: 'À bientôt', es: 'Hasta pronto', de: 'Bis bald', zh: '回头见', ja: 'またね' },
  'where are you': { te: 'మీరు ఎక్కడ ఉన్నారు?', hi: 'आप कहाँ हैं?', ta: 'நீங்கள் எங்கே இருக்கிறீர்கள்?', kn: 'ನೀವು ಎಲ್ಲಿದ್ದೀರಿ?', ml: 'നിങ്ങൾ എവിടെയാണ്?', mr: 'तुम्ही कुठे आहात?', bn: 'আপনি কোথায়?', gu: 'તમે ક્યાં છો?', pa: 'ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ?', or: 'ଆପଣ କେଉଁଠି ଅଛନ୍ତି?', ur: 'آپ کہاں ہیں؟', ar: 'أين أنت؟', fr: 'Où es-tu ?', es: '¿Dónde estás?', de: 'Wo bist du?', zh: '你在哪里？', ja: 'どこにいますか？' },
};
const normPhrase = (s) => String(s).toLowerCase().replace(/\p{Extended_Pictographic}|[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
// Returns { text } or null when the phrase isn't in the demo phrasebook
function translateText(text, to) {
  const n = normPhrase(text);
  let key = Object.keys(PHRASES).find((k) => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k));
  if (!key) key = Object.keys(PHRASES).find((k) => Object.values(PHRASES[k]).some((v) => normPhrase(v) === n));
  if (!key) return null;
  if (to === 'en') return { text: key[0].toUpperCase() + key.slice(1) + (/how|where/.test(key) ? '?' : '.') };
  return { text: PHRASES[key][to] };
}
function translateMsgModal(m) {
  const src = m.tr || m.text;
  modal({
    title: 'Translate message',
    body: `<div class="quote" style="--qc:var(--accent)"><div class="q-main"><div class="q-text">${esc(m.text)}</div></div></div>
      <div class="chips wrap">${LANG_LIST.map(([k, l]) => `<button class="chip" data-tl="${k}">${l}</button>`).join('')}</div><div id="tl-out"></div>`,
    actions: [{ label: 'Done', primary: true }],
    onMount: (root) => root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tl]');
      if (!b) return;
      $$('[data-tl]', root).forEach((x) => x.classList.toggle('on', x === b));
      const to = b.dataset.tl, label = b.textContent;
      const r = to === 'en' && m.tr ? { text: m.tr } : translateText(src, to);
      $('#tl-out', root).innerHTML = r ? `<div class="tl-res"><div class="tr-label">${icon('translate', 12)} ${esc(label)}</div><div class="tl-text">${esc(r.text)}</div><button class="link-btn" id="tl-say">🔊 Listen</button></div>`
        : `<div class="hint-box flat">${icon('info', 16)}<span>The demo translates common phrases (try “How are you?”, “I will come tomorrow”, “Thank you”). Production WHATSMORE translates any message into 100+ languages with an on-device model, so encrypted chats stay private.</span></div>`;
      $('#tl-say', root)?.addEventListener('click', () => readAloud(r.text));
    }),
  });
}
