// Security architecture: account recovery. Set up a recovery key, a recovery email and trusted
// contacts in Settings → Account & security, then recover from the sign-in screen when the phone
// number or email is lost. Demo only: codes are shown on screen and only a hash of the key is kept.
'use strict';
const recState = () => (S.settings.recovery ||= { email: '', trusted: [], keyHash: '', keyAt: 0 });
const recCount = () => { const r = recState(); return [r.keyHash, r.email, r.trusted.length >= 2].filter(Boolean).length; };
const normKey = (k) => k.toUpperCase().replace(/[^A-Z2-9]/g, '');
async function sha256(t) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return 'h' + hash(t); }
}
function newRecoveryKey() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(24));
  return 'WM-' + [...r].map((x) => A[x % A.length]).join('').match(/.{4}/g).join('-');
}
const trustedPool = () => S.contacts.filter((c) => c.isContact && !c.business && !c.blocked);

function recoverySectionHTML() {
  const r = recState(), n = recCount();
  const row = (act, ic, title, sub, done) => `<div class="set-row clickable" data-act="${act}"><span class="action-ic plain">${icon(ic, 22)}</span><div class="grow"><div class="ci-name">${title}</div><div class="ci-sub">${sub}</div></div>${done ? `<span class="pill ok">${icon('check', 12)} Set</span>` : `<span class="pill">Set up</span>`}</div>`;
  return `<div class="list-label">Account recovery · ${n} of 3 set</div>
    ${row('reckey', 'key', 'Recovery key', r.keyHash ? `Created ${dayLabel(r.keyAt).toLowerCase()} · only a fingerprint is stored` : 'A 24-character key you keep offline', r.keyHash)}
    ${row('recemail', 'doc', 'Recovery email', r.email ? `Verified · ${esc(r.email)}` : 'Get a code by email if you lose your phone', r.email)}
    ${row('rectrusted', 'groups', 'Trusted contacts', r.trusted.length >= 2 ? `${esc(namesSummary(r.trusted, 3))} · any 2 can help you back in` : 'Pick 2–5 people who can vouch for you', r.trusted.length >= 2)}
    ${n ? '' : `<div class="hint-box warn">${icon('warning', 16)}<span>No recovery method yet. If you lose this phone number you could lose access to your account.</span></div>`}`;
}
const _settingsPageRec = settingsPage;
settingsPage = function (p) {
  const h = _settingsPageRec(p);
  return p === 'set-security' ? h.replace('<div class="list-label">Active sessions</div>', recoverySectionHTML() + '<div class="list-label">Active sessions</div>') : h;
};
const refreshSec = () => { save(); if (ui.page === 'set-security') renderSidebar(); };

function recoveryKeyModal() {
  const r = recState();
  const key = newRecoveryKey();
  modal({
    title: r.keyHash ? 'Create a new recovery key' : 'Your recovery key',
    body: `${r.keyHash ? `<p class="muted small">Your old key will stop working.</p>` : ''}
      <div class="rec-key" id="rk-v">${key}</div>
      <div class="btn-row center"><button class="btn sm" id="rk-copy">${icon('copy', 16)} Copy</button><button class="btn sm" id="rk-dl">${icon('download', 16)} Download .txt</button></div>
      ${note('Write it down or save it somewhere safe, offline. WHATSMORE only keeps a fingerprint (SHA-256) of this key, so we can never show it to you again.', 'key')}
      <label class="radio-row"><input type="checkbox" id="rk-ok"> I've saved my recovery key</label>`,
    actions: [{ label: 'Cancel' }, { label: 'Done', primary: true, onClick: (root) => {
      if (!$('#rk-ok', root).checked) { toast('Tick the box once you have saved your key'); return false; }
      sha256(normKey(key)).then((h) => { r.keyHash = h; r.keyAt = Date.now(); refreshSec(); toast('🔑 Recovery key saved'); });
    } }],
    onMount: (root) => {
      $('#rk-copy', root).onclick = () => copyText(key);
      $('#rk-dl', root).onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([`WHATSMORE recovery key\n\n${key}\n\nAccount: @${S.me.username}\nCreated: ${new Date().toLocaleString()}\n\nKeep this offline. Anyone with this key and your account name can recover your account.\n`], { type: 'text/plain' }));
        a.download = 'WHATSMORE-recovery-key.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
    },
  });
}
function recoveryEmailModal() {
  const r = recState();
  let masked = '';
  modal({
    title: 'Recovery email',
    body: `<label class="field"><span>Email address</span><input id="re-e" type="email" placeholder="you@example.com" autocomplete="off" autofocus></label>
      <div id="re-otp" hidden><label class="field"><span>Enter the 6-digit code</span><input id="re-c" inputmode="numeric" maxlength="6" placeholder="••••••"></label><div class="demo-otp">Demo code: <b>${DEMO_OTP}</b></div></div>
      ${r.email ? `<button class="link-btn danger" id="re-rm">Remove ${esc(r.email)}</button>` : ''}`,
    actions: [{ label: 'Cancel' }, { label: 'Send code', primary: true, onClick: (root) => {
      const otp = $('#re-otp', root);
      if (otp.hidden) {
        const v = $('#re-e', root).value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Enter a valid email address'); return false; }
        const [u, d] = v.split('@'); masked = `${u[0]}•••@${d}`;
        otp.hidden = false; $('#re-c', root).focus();
        const b = $('.btn.primary', root); if (b) b.textContent = 'Verify';
        toast(`📨 Demo: code ${DEMO_OTP} “sent” to ${masked}`);
        return false;
      }
      if ($('#re-c', root).value.trim() !== DEMO_OTP) { toast('Incorrect code — use the demo code shown'); return false; }
      r.email = masked; refreshSec(); toast('Recovery email verified');
    } }],
    onMount: (root, close) => { const rm = $('#re-rm', root); if (rm) rm.onclick = () => { r.email = ''; refreshSec(); close(); toast('Recovery email removed'); }; },
  });
}
function trustedContactsModal() {
  const r = recState(), picked = new Set(r.trusted);
  const pool = trustedPool();
  modal({
    title: 'Trusted contacts',
    body: `<p class="muted small">If you lose access, WHATSMORE asks these people for a one-time code. Any <b>2</b> of them can help you back in. They never see your messages.</p>
      <div class="muted small" id="tc-n"></div>
      <div class="pick-list">${pool.map((c) => `<label class="chat-item check-row">${avatarHTML(c, 40)}<div class="ci-body"><div class="ci-name">${esc(c.name)}</div><div class="ci-preview">@${esc(c.username)}</div></div><input type="checkbox" class="check" data-tc="${c.id}" ${picked.has(c.id) ? 'checked' : ''}></label>`).join('')}</div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      if (picked.size && (picked.size < 2 || picked.size > 5)) { toast('Choose between 2 and 5 people'); return false; }
      const added = [...picked].filter((id) => !r.trusted.includes(id));
      r.trusted = [...picked]; refreshSec();
      toast(picked.size ? `Trusted contacts saved${added.length ? ` · ${namesSummary(added, 2)} notified` : ''}` : 'Trusted contacts removed');
    } }],
    onMount: (root) => {
      const n = () => { $('#tc-n', root).textContent = `${picked.size} selected · choose 2–5`; };
      n();
      root.addEventListener('change', (e) => { const id = e.target.dataset.tc; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); n(); });
    },
  });
}
Object.assign(XA, { reckey: recoveryKeyModal, recemail: recoveryEmailModal, rectrusted: trustedContactsModal });

// ---------- recovering an account from the sign-in screen
const REC = { method: null, codes: [], timers: [] };
const recTrustedForDemo = () => { const t = recState().trusted.filter((id) => contact(id)); return t.length >= 2 ? t : trustedPool().slice(0, 3).map((c) => c.id); };
function recScreen() {
  const r = recState();
  if (OB.step === 'recover') return `<div class="ob-card">${icon('key', 40, 'accent')}<h2>Recover your account</h2>
    <p class="muted small">Lost your phone number or email? Choose how to prove it's you.</p>
    <button class="ob-method" data-act="ob" data-go="rec-key">${icon('key', 22)}<div class="grow"><b>Recovery key</b><span>The 24-character key you saved${r.keyHash ? '' : ' · none set on this demo account'}</span></div></button>
    <button class="ob-method" data-act="ob" data-go="rec-trusted">${icon('groups', 22)}<div class="grow"><b>Trusted contacts</b><span>Get codes from 2 people you trust</span></div></button>
    <button class="ob-method" data-act="ob" data-go="rec-email">${icon('doc', 22)}<div class="grow"><b>Recovery email</b><span>${r.email ? 'Send a code to ' + esc(r.email) : 'Not set · uses a demo address'}</span></div></button>
    <div class="err" id="ob-err"></div>
    <button class="link-btn" data-act="ob" data-go="login">← Back to sign in</button></div>`;
  if (OB.step === 'rec-key') return `<div class="ob-card"><h2>Enter recovery key</h2>
    <input id="rk-in" class="ob-input rk-mono" placeholder="WM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" autofocus>
    ${r.keyHash ? '' : `<p class="muted small">This demo account has no recovery key yet. Create one in Settings → Account &amp; security, or use another method.</p>`}
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="rec-checkkey">Recover</button>
    <button class="link-btn" data-act="ob" data-go="recover">← Other methods</button></div>`;
  if (OB.step === 'rec-trusted') {
    const ids = recTrustedForDemo();
    return `<div class="ob-card"><h2>Ask your trusted contacts</h2>
    <p class="muted small">We sent a recovery request to ${esc(namesSummary(ids, 3))}. Ask any <b>2</b> of them for the code they see in WHATSMORE.</p>
    <div class="rec-list">${ids.map((id, i) => `<div class="rec-item">${avatarHTML(contact(id), 32)}<span class="grow">${esc(contact(id).name)}</span><span class="pill ${REC.codes[i] ? 'ok' : ''}">${REC.codes[i] ? 'Code: ' + REC.codes[i] : 'Waiting…'}</span></div>`).join('')}</div>
    <div class="ob-phone"><input id="rt-1" class="ob-input rk-mono" maxlength="6" inputmode="numeric" placeholder="Code 1"><input id="rt-2" class="ob-input rk-mono" maxlength="6" inputmode="numeric" placeholder="Code 2"></div>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="rec-checktrusted">Recover</button>
    <button class="link-btn" data-act="ob" data-go="recover">← Other methods</button></div>`;
  }
  if (OB.step === 'rec-email') return `<div class="ob-card"><h2>Check your email</h2>
    <p class="muted small">Enter the code sent to <b>${esc(r.email || 'r•••@example.com')}</b></p>
    <input id="re-in" class="ob-input rk-mono" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus>
    <div class="demo-otp">Demo code: <b>${DEMO_OTP}</b></div>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="rec-checkemail">Recover</button>
    <button class="link-btn" data-act="ob" data-go="recover">← Other methods</button></div>`;
  if (OB.step === 'rec-done') return `<div class="ob-card"><div class="tick-anim">${icon('check', 46)}</div><h2>Account recovered</h2>
    <p>Welcome back, <b>${esc(S.me.name)}</b> (@${esc(S.me.username)}).</p>
    <div class="hint-box flat">${icon('shield', 16)}<span>For your safety: every other session was logged out, payments are paused for 24 hours, and your contacts will see your security code change.</span></div>
    <button class="btn primary block" data-act="ob" data-go="rec-secure">Set a new PIN</button></div>`;
  return null;
}
const _obScreenRec = obScreen;
obScreen = function () {
  const h = recScreen();
  if (h) return h;
  const out = _obScreenRec();
  return OB.step === 'login' ? out.replace('<button class="link-btn" data-act="ob" data-go="welcome">← Back</button>', `<button class="link-btn" data-act="ob" data-go="recover">Lost access to your ${OB.via === 'phone' ? 'number' : 'email'}? Recover account</button><button class="link-btn" data-act="ob" data-go="welcome">← Back</button>`) : out;
};
function recClear() { REC.timers.forEach(clearTimeout); REC.timers = []; }
function recSucceed(how) {
  recClear();
  const st = S.settings;
  st.sessions = st.sessions.filter((s) => s.current);
  S.devices = S.devices.filter((d) => d.primary);
  st.recovery.lastRecovered = { t: Date.now(), how };
  save();
  OB.step = 'rec-done';
  renderOnboarding();
}
const _obRec = XA.ob;
XA.ob = async (el) => {
  const go = el.dataset.go;
  if (!go.startsWith('rec')) { recClear(); return _obRec(el); }
  const r = recState();
  if (go === 'recover' || go === 'rec-key' || go === 'rec-email') { recClear(); OB.step = go; return renderOnboarding(); }
  if (go === 'rec-trusted') {
    recClear(); REC.codes = []; OB.step = go; renderOnboarding();
    recTrustedForDemo().slice(0, 2).forEach((id, i) => REC.timers.push(setTimeout(() => {
      REC.codes[i] = String(100000 + Math.floor(Math.random() * 900000));
      if (OB.step !== 'rec-trusted') return;
      const a = $('#rt-1')?.value, b = $('#rt-2')?.value;
      renderOnboarding(); if ($('#rt-1')) { $('#rt-1').value = a || ''; $('#rt-2').value = b || ''; }
      toast(`${contact(id).name} shared their code: ${REC.codes[i]}`);
    }, 1800 + i * 2200)));
    return;
  }
  if (go === 'rec-checkkey') {
    const v = normKey($('#rk-in').value);
    if (!r.keyHash) return obErr('No recovery key is set on this account — try trusted contacts or email');
    if (v.length < 26 || (await sha256(v)) !== r.keyHash) return obErr("That key doesn't match. Check it and try again.");
    return recSucceed('key');
  }
  if (go === 'rec-checktrusted') {
    const got = [$('#rt-1').value.trim(), $('#rt-2').value.trim()];
    const ok = got.filter((c, i) => c && REC.codes.includes(c) && got.indexOf(c) === i).length;
    if (ok < 2) return obErr(REC.codes.length < 2 ? 'Waiting for your contacts to share their codes…' : 'Enter two different codes from your trusted contacts');
    return recSucceed('trusted');
  }
  if (go === 'rec-checkemail') {
    if ($('#re-in').value.trim() !== DEMO_OTP) return obErr('Incorrect code — use the demo code shown');
    return recSucceed('email');
  }
  if (go === 'rec-secure') {
    Object.assign(OB, { name: S.me.name, un: S.me.username, hidePhone: S.me.phoneHidden !== false, find: S.settings.privacy.findByUsername || 'everyone', masked: S.me.phoneMasked || OB.masked, step: 'security' });
    return renderOnboarding();
  }
};
