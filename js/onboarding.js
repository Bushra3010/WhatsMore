// Blueprint Stage 2 screens: splash → welcome → login/registration (phone or email + OTP) → username creation → security → done.
// Demo only: nothing is sent anywhere, the OTP is shown on screen, and only a masked number is kept.
'use strict';
const OB = { step: 'splash', via: 'phone', id: '', code: '', name: '', un: '', hidePhone: true, find: 'everyone', pin: '', passkey: false };
const DEMO_OTP = '246810';
const ONB_LANGS = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी'], ['ta', 'தமிழ்'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം']];

function obSuggest(name) {
  const base = (name || 'user').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'user';
  const taken = new Set(allUsernames());
  return [base, base.replace(/\./g, ''), base + '.wm', base + (new Date().getFullYear() % 100), base + '_' + (hash(base) % 900 + 100)]
    .filter((u, i, a) => u.length >= 3 && u.length <= 24 && !taken.has(u) && a.indexOf(u) === i).slice(0, 3);
}
const obDots = (n) => `<div class="ob-dots">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`;
function obScreen() {
  const s = OB.step;
  if (s === 'splash') return `<div class="ob-splash">${logoSVG(96)}<h1>WHATSMORE</h1><p>More Than Chat</p><div class="ob-pillars">${['💬 Chat', '🤖 AI', '💳 Pay', '💼 Business', '🏛️ Services', '🌍 Community'].map((x) => `<span>${x}</span>`).join('')}</div><div class="ob-load"><div></div></div><div class="ob-foot">${icon('lock', 13)} End-to-end encrypted</div></div>`;
  if (s === 'welcome') return `<div class="ob-card">${logoSVG(64)}<h2>Welcome to WHATSMORE</h2><p class="muted">Chat. AI. Pay. Business. Services. Community.<br>One secure app for your digital life.</p>
    <label class="field"><span>App language</span><select id="ob-lang">${ONB_LANGS.map(([k, l]) => `<option value="${k}" ${k === (S.settings.myLang || 'en') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn primary block" data-act="ob" data-go="login" data-via="phone">${icon('phone', 18)} Continue with phone number</button>
    <button class="btn block" data-act="ob" data-go="login" data-via="email">${icon('doc', 18)} Continue with email</button>
    <p class="muted small">By continuing you agree to the Terms and Privacy Policy. <button class="link-btn" data-act="ob" data-go="skip">Skip demo setup</button></p></div>`;
  if (s === 'login') return `<div class="ob-card">${obDots(1)}<h2>${OB.via === 'phone' ? 'Enter your phone number' : 'Enter your email'}</h2>
    <p class="muted small">We'll send a one-time code to verify it's you. ${OB.via === 'phone' ? 'Your number stays hidden — people connect with your @username.' : ''}</p>
    ${OB.via === 'phone' ? `<div class="ob-phone"><select id="ob-cc" aria-label="Country code"><option>+91</option><option>+1</option><option>+44</option><option>+971</option><option>+65</option></select><input id="ob-id" inputmode="tel" maxlength="12" placeholder="98765 43210" autocomplete="off" value="${esc(OB.id)}" autofocus></div>`
      : `<input id="ob-id" class="ob-input" type="email" placeholder="you@example.com" autocomplete="off" value="${esc(OB.id)}" autofocus>`}
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="otp">Send code</button>
    <button class="link-btn" data-act="ob" data-go="welcome">← Back</button></div>`;
  if (s === 'otp') return `<div class="ob-card">${obDots(2)}<h2>Verify it's you</h2><p class="muted small">Enter the 6-digit code sent to <b>${esc(OB.masked)}</b></p>
    <div class="ob-otp">${Array.from({ length: 6 }, (_, i) => `<input class="otp-box" data-otp="${i}" inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" ${i === 0 ? 'autofocus' : ''}>`).join('')}</div>
    <div class="demo-otp">Demo code: <b>${DEMO_OTP}</b> <button class="link-btn" data-act="ob" data-go="autofill">Fill it in</button></div>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="verify">Verify</button>
    <button class="link-btn" data-act="ob" data-go="login">Change ${OB.via === 'phone' ? 'number' : 'email'}</button></div>`;
  if (s === 'profile') {
    const sug = obSuggest(OB.name);
    return `<div class="ob-card">${obDots(3)}<h2>Create your profile</h2>
    <div class="center">${avatarHTML({ name: OB.name || '?', color: S.me.color }, 84)}</div>
    <label class="field"><span>Your name</span><input id="ob-name" maxlength="25" value="${esc(OB.name)}" placeholder="e.g. Anil Kumar" autofocus></label>
    <label class="field"><span>Choose a unique username</span><div class="un-input"><b>@</b><input id="ob-un" maxlength="24" value="${esc(OB.un)}" placeholder="anilkumar" autocapitalize="off" spellcheck="false"></div><small id="ob-un-st" class="un-status"></small></label>
    <div class="chips wrap" id="ob-sug">${sug.map((u) => `<button class="chip" data-act="ob" data-go="sug" data-u="${u}">@${u}</button>`).join('')}</div>
    <label class="set-row plain"><div class="grow"><div class="ci-name">Hide my phone number</div><div class="ci-sub">Recommended · people find you only by @username or QR</div></div><input type="checkbox" class="switch" id="ob-hide" ${OB.hidePhone ? 'checked' : ''}></label>
    <label class="field"><span>Who can find me by @username</span><select id="ob-find"><option value="everyone">Everyone</option><option value="contacts" ${OB.find === 'contacts' ? 'selected' : ''}>My contacts</option><option value="nobody" ${OB.find === 'nobody' ? 'selected' : ''}>Nobody</option></select></label>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="security">Continue</button></div>`;
  }
  if (s === 'security') return `<div class="ob-card">${obDots(4)}<h2>Secure your account</h2><p class="muted small">Security is built in from day one.</p>
    <label class="field"><span>Two-step verification PIN (optional)</span><input id="ob-pin" class="pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></label>
    <label class="set-row plain"><div class="grow"><div class="ci-name">Passkey on this device</div><div class="ci-sub">Sign in with fingerprint, face or screen lock</div></div><input type="checkbox" class="switch" id="ob-pass"></label>
    <label class="set-row plain"><div class="grow"><div class="ci-name">New device alerts</div><div class="ci-sub">Get notified when your account is used elsewhere</div></div><input type="checkbox" class="switch" checked disabled></label>
    <div class="hint-box flat">${icon('shield', 16)}<span>Personal messages and calls are end-to-end encrypted. Encryption keys never leave your devices.</span></div>
    <button class="btn primary block" data-act="ob" data-go="done">Finish</button></div>`;
  if (s === 'done') return `<div class="ob-card">${obDots(5)}<div class="tick-anim">${icon('check', 46)}</div><h2>You're all set!</h2>
    <p>Welcome, <b>${esc(OB.name)}</b>. Friends can reach you at <b class="accent">@${esc(OB.un)}</b>${OB.hidePhone ? ' — your phone number stays private' : ''}.</p>
    <button class="btn primary block" data-act="ob" data-go="enter">Start using WHATSMORE</button></div>`;
  return '';
}
function renderOnboarding() {
  let el = $('#onboard');
  if (!el) { el = document.createElement('div'); el.id = 'onboard'; el.className = 'onboard'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome to WHATSMORE'); overlayRoot.appendChild(el); }
  el.innerHTML = obScreen();
  const f = el.querySelector('[autofocus]');
  if (f && innerWidth > 760) setTimeout(() => f.focus(), 30);
  if (OB.step === 'profile') obCheckUn();
  if (OB.step === 'splash') setTimeout(() => { if (OB.step === 'splash') { OB.step = 'welcome'; renderOnboarding(); } }, 1800);
}
function startOnboarding() {
  Object.assign(OB, { step: 'splash', id: '', code: '', name: S.me.name || '', un: '', hidePhone: true });
  renderOnboarding();
}
function closeOnboarding() { $('#onboard')?.remove(); }
const obErr = (t) => { const e = $('#ob-err'); if (e) e.textContent = t; };
function obCheckUn() {
  const inp = $('#ob-un'), st = $('#ob-un-st');
  if (!inp || !st) return;
  const v = inp.value.trim().toLowerCase();
  if (!v) { st.className = 'un-status'; st.textContent = ''; return; }
  const [k, msg] = checkUsername(v);
  st.className = 'un-status ' + k; st.textContent = msg;
}
XA.ob = (el) => {
  const go = el.dataset.go;
  if (go === 'skip') { S.settings.onboarded = true; save(); closeOnboarding(); return; }
  if (go === 'login') { OB.via = el.dataset.via || OB.via; const l = $('#ob-lang'); if (l) S.settings.myLang = l.value; OB.step = 'login'; return renderOnboarding(); }
  if (go === 'welcome') { OB.step = 'welcome'; return renderOnboarding(); }
  if (go === 'otp') {
    const v = $('#ob-id').value.trim();
    if (OB.via === 'phone') {
      const d = v.replace(/\D/g, '');
      if (d.length < 8) return obErr('Enter a valid phone number');
      OB.masked = `${$('#ob-cc').value} ••••• ••${d.slice(-3)}`;
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return obErr('Enter a valid email address');
      const [u, dom] = v.split('@');
      OB.masked = `${u[0]}•••@${dom}`;
    }
    OB.id = ''; // only the masked form is kept
    OB.step = 'otp';
    toast(`📨 Demo: code ${DEMO_OTP} “sent” to ${OB.masked}`);
    return renderOnboarding();
  }
  if (go === 'autofill') { $$('.otp-box').forEach((b, i) => { b.value = DEMO_OTP[i]; }); return; }
  if (go === 'verify') {
    const code = $$('.otp-box').map((b) => b.value).join('');
    if (code !== DEMO_OTP) { obErr('Incorrect code — use the demo code shown'); $('.ob-otp')?.classList.add('shake'); setTimeout(() => $('.ob-otp')?.classList.remove('shake'), 400); return; }
    OB.step = 'profile';
    return renderOnboarding();
  }
  if (go === 'sug') { $('#ob-un').value = el.dataset.u; return obCheckUn(); }
  if (go === 'security') {
    const name = $('#ob-name').value.trim(), un = $('#ob-un').value.trim().toLowerCase();
    if (!name) return obErr('Enter your name');
    const [k, msg] = checkUsername(un);
    if (k !== 'ok') return obErr(msg);
    Object.assign(OB, { name, un, hidePhone: $('#ob-hide').checked, find: $('#ob-find').value, step: 'security' });
    return renderOnboarding();
  }
  if (go === 'done') {
    const pin = $('#ob-pin').value;
    if (pin && !/^\d{6}$/.test(pin)) return toast('Two-step PIN must be 6 digits (or leave it empty)');
    OB.pin = pin; OB.passkey = $('#ob-pass').checked;
    Object.assign(S.me, { name: OB.name, username: OB.un, phoneMasked: OB.masked, phoneHidden: OB.hidePhone });
    S.settings.privacy.findByUsername = OB.find;
    S.settings.security.twoStep = !!OB.pin || S.settings.security.twoStep;
    if (OB.passkey) S.settings.security.passkeys = true;
    S.settings.onboarded = true;
    save();
    OB.step = 'done';
    return renderOnboarding();
  }
  if (go === 'enter') { closeOnboarding(); renderRail(); renderSidebar(); renderMain(); toast(`👋 Welcome to WHATSMORE, ${OB.name.split(' ')[0]}!`); }
};
XA.replayonboard = () => { startOnboarding(); };
// OTP boxes: auto-advance, backspace, paste
document.addEventListener('input', (e) => {
  if (e.target.id === 'ob-un') { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); obCheckUn(); }
  if (e.target.id === 'ob-name' && OB.step === 'profile') { const box = $('#ob-sug'); if (box) box.innerHTML = obSuggest(e.target.value).map((u) => `<button class="chip" data-act="ob" data-go="sug" data-u="${u}">@${u}</button>`).join(''); }
  const i = e.target.dataset?.otp;
  if (i == null) return;
  const v = e.target.value.replace(/\D/g, '');
  if (v.length > 1) { $$('.otp-box').forEach((b, j) => { b.value = v[j] || ''; }); return; }
  e.target.value = v;
  if (v && +i < 5) $(`[data-otp="${+i + 1}"]`)?.focus();
});
document.addEventListener('keydown', (e) => {
  const i = e.target.dataset?.otp;
  if (i != null && e.key === 'Backspace' && !e.target.value && +i > 0) $(`[data-otp="${+i - 1}"]`)?.focus();
  if (e.key === 'Enter' && e.target.closest?.('#onboard') && !e.isComposing) { const b = $('#onboard .btn.primary'); if (b) { e.preventDefault(); b.click(); } }
});
// Settings: replay entry
const _tabSettingsOb = tabSettings;
tabSettings = function () {
  return _tabSettingsOb().replace('<div class="list-row action danger" data-act="resetdemo">', `<div class="list-row action" data-act="replayonboard"><span class="action-ic plain">${icon('person', 22)}</span><div class="grow"><div class="ci-name">Replay welcome & sign-up</div><div class="ci-sub">Splash, login, OTP and username creation</div></div></div><div class="list-row action danger" data-act="resetdemo">`);
};
// main.js loads data after this file; show the flow once on first run
setTimeout(() => { if (S && !S.settings.onboarded) startOnboarding(); }, 0);
