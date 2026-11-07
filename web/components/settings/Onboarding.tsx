'use client';
// Full-screen onboarding (js/onboarding.js + js/recovery.js + the account screens of js/cloud.js):
// splash → welcome → (live) create account / sign in / forgot password, or the demo phone/email OTP
// flow → profile with @username → security → done, plus account recovery screens.
// Demo only: nothing is sent anywhere for the OTP flow, the OTP is shown on screen, and only a masked number is kept.
import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { S, commit } from '@/lib/state';
import { act } from '@/lib/registry';
import { allUsernames, hash, namesSummary, contact } from '@/lib/util';
import { toast } from '@/lib/overlay';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/app/Logo';
import { checkUsername, ensureSettings } from './common';
import { DEMO_OTP, recState, normKey, sha256, trustedPool } from './recovery';

const ONB_LANGS: [string, string][] = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी'], ['ta', 'தமிழ்'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം']];
const OB = { via: 'phone', masked: '', name: '', un: '', hidePhone: true, find: 'everyone', pin: '', passkey: false };
const ACC = { name: '', un: '', email: '' };
let recTimers: ReturnType<typeof setTimeout>[] = [];

const useOb = create<{ open: boolean; step: string; err: string; busy: boolean; codes: string[] }>(() => ({ open: false, step: 'splash', err: '', busy: false, codes: [] }));
const setStep = (step: string) => useOb.setState({ step, err: '', busy: false });
const obErr = (err: string) => useOb.setState({ err });
const liveOn = () => 'liveSignUp' in act;
const $ = <T extends HTMLElement = HTMLInputElement>(sel: string) => document.querySelector<T>(`#onboard ${sel}`);
const val = (sel: string) => $(sel)?.value ?? '';

export function startOnboarding() {
  Object.assign(OB, { name: S.me.name || '', un: '', hidePhone: true });
  recClear();
  useOb.setState({ open: true, step: 'splash', err: '', busy: false, codes: [] });
}
function closeOnboarding() { recClear(); useOb.setState({ open: false }); }
export function openAccountFlow(step: string) {
  startOnboarding();
  setStep(step);
}

function obSuggest(name: string) {
  const base = (name || 'user').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'user';
  const taken = new Set(allUsernames());
  return [base, base.replace(/\./g, ''), base + '.wm', base + (new Date().getFullYear() % 100), base + '_' + (hash(base) % 900 + 100)]
    .filter((u, i, a) => u.length >= 3 && u.length <= 24 && !taken.has(u) && a.indexOf(u) === i).slice(0, 3);
}
const Dots = ({ n }: { n: number }) => <div className="ob-dots">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? 'on' : ''} />)}</div>;
const Err = () => <div className="err" id="ob-err">{useOb((s) => s.err)}</div>;
function ObBtn({ go, data, cls = 'btn primary block', children }: { go: string; data?: Record<string, string>; cls?: string; children: ReactNode }) {
  const busy = useOb((s) => s.busy);
  const primary = cls.includes('primary') && cls.startsWith('btn');
  const extra: Record<string, string> = {};
  Object.entries(data || {}).forEach(([k, v]) => { extra['data-' + k] = v; });
  return (
    <button className={`${cls} ${primary && busy ? 'loading' : ''}`} disabled={primary && busy} data-act="ob" data-go={go} {...extra} onClick={() => ob(go, data)}>{children}</button>
  );
}

// ---------- recovery helpers
function recClear() { recTimers.forEach(clearTimeout); recTimers = []; }
const recTrustedForDemo = () => { const t = recState().trusted.filter((id) => contact(id)); return t.length >= 2 ? t : trustedPool().slice(0, 3).map((c) => c.id); };
function recSucceed(how: string) {
  recClear();
  const st = S.settings;
  st.sessions = st.sessions.filter((s) => s.current);
  S.devices = S.devices.filter((d) => d.primary);
  recState().lastRecovered = { t: Date.now(), how };
  commit();
  setStep('rec-done');
}

// ---------- the step handler (XA.ob in the original, all layers merged)
async function ob(go: string, data: Record<string, string> = {}) {
  // recovery steps (recovery.js)
  if (go.startsWith('rec')) {
    const r = recState();
    if (go === 'recover' || go === 'rec-key' || go === 'rec-email') { recClear(); return setStep(go); }
    if (go === 'rec-trusted') {
      recClear(); useOb.setState({ codes: [] }); setStep(go);
      recTrustedForDemo().slice(0, 2).forEach((id, i) => recTimers.push(setTimeout(() => {
        const code = String(100000 + Math.floor(Math.random() * 900000));
        const codes = useOb.getState().codes.slice(); codes[i] = code;
        useOb.setState({ codes });
        if (useOb.getState().step !== 'rec-trusted') return;
        toast(`${contact(id)?.name} shared their code: ${code}`);
      }, 1800 + i * 2200)));
      return;
    }
    if (go === 'rec-checkkey') {
      const v = normKey(val('#rk-in'));
      if (!r.keyHash) return obErr('No recovery key is set on this account — try trusted contacts or email');
      if (v.length < 26 || (await sha256(v)) !== r.keyHash) return obErr("That key doesn't match. Check it and try again.");
      return recSucceed('key');
    }
    if (go === 'rec-checktrusted') {
      const codes = useOb.getState().codes;
      const got = [val('#rt-1').trim(), val('#rt-2').trim()];
      const ok = got.filter((c, i) => c && codes.includes(c) && got.indexOf(c) === i).length;
      if (ok < 2) return obErr(codes.filter(Boolean).length < 2 ? 'Waiting for your contacts to share their codes…' : 'Enter two different codes from your trusted contacts');
      return recSucceed('trusted');
    }
    if (go === 'rec-checkemail') {
      if (val('#re-in').trim() !== DEMO_OTP) return obErr('Incorrect code — use the demo code shown');
      return recSucceed('email');
    }
    if (go === 'rec-secure') {
      Object.assign(OB, { name: S.me.name, un: S.me.username, hidePhone: S.me.phoneHidden !== false, find: S.settings.privacy.findByUsername || 'everyone', masked: S.me.phoneMasked || OB.masked });
      return setStep('security');
    }
    return;
  }
  recClear();

  // live account steps (cloud.js)
  if (go.startsWith('acct')) {
    if (!liveOn()) { toast('Accounts are unavailable — the Supabase library did not load'); return; }
    if (go === 'acct-signup' || go === 'acct-signin') { const l = $<HTMLSelectElement>('#ob-lang'); if (l) S.settings.myLang = l.value; return setStep(go); }
    const email = val('#ac-email').trim(), pw = val('#ac-pw');
    ACC.email = email;
    if (go === 'acct-forgot') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return obErr('Enter your email above first');
      const res = (await act.liveResetPassword(email)) as { error?: string } | undefined;
      if (res?.error) return obErr(res.error);
      toast('📨 If that email has an account, a reset link is on its way (limited to a few emails per hour)', null, { ms: 6000 });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return obErr('Enter a valid email address');
    if (go === 'acct-login') {
      if (!pw) return obErr('Enter your password');
      useOb.setState({ busy: true });
      const res = (await act.liveSignIn({ email, password: pw })) as { error?: string } | undefined;
      useOb.setState({ busy: false });
      if (res?.error) return obErr(res.error === 'Invalid login credentials' ? 'Wrong email or password' : res.error);
      S.settings.onboarded = true; commit();
      closeOnboarding();
      toast(`👋 Welcome back, ${S.me.name.split(' ')[0]}!`);
      return;
    }
    if (go === 'acct-create') {
      const name = val('#ac-name').trim(), un = val('#ac-un').trim().toLowerCase();
      Object.assign(ACC, { name, un });
      if (!name) return obErr('Enter your name');
      if (!/^[a-z0-9._]{3,24}$/.test(un)) return obErr('Username: 3–24 letters, numbers, dot or underscore');
      if (pw.length < 8) return obErr('Password must be at least 8 characters');
      useOb.setState({ busy: true });
      const free = await act.liveUsernameAvailable(un);
      if (free === false) { useOb.setState({ busy: false }); return obErr(`@${un} is already taken — try another`); }
      const res = (await act.liveSignUp({ name, username: un, email, password: pw })) as { error?: string } | undefined;
      useOb.setState({ busy: false });
      if (res?.error) {
        const m = res.error;
        return obErr(/database error/i.test(m) ? `@${un} was just taken — try another` : /registered/i.test(m) ? 'That email already has an account — sign in instead' : m);
      }
      Object.assign(OB, { name, un, hidePhone: true });
      S.settings.onboarded = true; commit();
      return setStep('done');
    }
    return;
  }

  // demo flow (onboarding.js)
  if (go === 'skip') { S.settings.onboarded = true; commit(); closeOnboarding(); return; }
  if (go === 'login') { OB.via = data.via || OB.via; const l = $<HTMLSelectElement>('#ob-lang'); if (l) S.settings.myLang = l.value; return setStep('login'); }
  if (go === 'welcome') return setStep('welcome');
  if (go === 'otp') {
    const v = val('#ob-id').trim();
    if (OB.via === 'phone') {
      const d = v.replace(/\D/g, '');
      if (d.length < 8) return obErr('Enter a valid phone number');
      OB.masked = `${val('#ob-cc')} ••••• ••${d.slice(-3)}`;
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return obErr('Enter a valid email address');
      const [u, dom] = v.split('@');
      OB.masked = `${u[0]}•••@${dom}`;
    }
    toast(`📨 Demo: code ${DEMO_OTP} “sent” to ${OB.masked}`);
    return setStep('otp');
  }
  if (go === 'autofill') { document.querySelectorAll<HTMLInputElement>('#onboard .otp-box').forEach((b, i) => { b.value = DEMO_OTP[i]; }); return; }
  if (go === 'verify') {
    const code = [...document.querySelectorAll<HTMLInputElement>('#onboard .otp-box')].map((b) => b.value).join('');
    if (code !== DEMO_OTP) {
      obErr('Incorrect code — use the demo code shown');
      const box = $<HTMLElement>('.ob-otp'); box?.classList.add('shake'); setTimeout(() => box?.classList.remove('shake'), 400);
      return;
    }
    return setStep('profile');
  }
  if (go === 'security') {
    const name = val('#ob-name').trim(), un = val('#ob-un').trim().toLowerCase();
    if (!name) return obErr('Enter your name');
    const [k, msg] = checkUsername(un);
    if (k !== 'ok') return obErr(msg);
    Object.assign(OB, { name, un, hidePhone: !!$('#ob-hide')?.checked, find: val('#ob-find') });
    return setStep('security');
  }
  if (go === 'done') {
    const pin = val('#ob-pin');
    if (pin && !/^\d{6}$/.test(pin)) { toast('Two-step PIN must be 6 digits (or leave it empty)'); return; }
    OB.pin = pin; OB.passkey = !!$('#ob-pass')?.checked;
    Object.assign(S.me, { name: OB.name, username: OB.un, phoneMasked: OB.masked, phoneHidden: OB.hidePhone });
    S.settings.privacy.findByUsername = OB.find;
    S.settings.security.twoStep = !!OB.pin || S.settings.security.twoStep;
    if (OB.passkey) S.settings.security.passkeys = true;
    S.settings.onboarded = true;
    commit();
    return setStep('done');
  }
  if (go === 'enter') { closeOnboarding(); commit(); toast(`👋 Welcome to WHATSMORE, ${OB.name.split(' ')[0]}!`); }
}

// ---------- screens
function Splash() {
  return (
    <div className="ob-splash">
      <Logo size={96} /><h1>WHATSMORE</h1><p>More Than Chat</p><div className="tri-bar" />
      <div className="brand-line">Connect. Communicate. Create. Pay. Work. Discover.</div>
      <div className="ob-pillars">{['💬 Chat', '🤖 AI', '💳 Pay', '💼 Business', '🏛️ Services', '🌍 Community'].map((x) => <span key={x}>{x}</span>)}</div>
      <div className="ob-load"><div /></div>
      <div className="ob-foot"><Icon name="lock" size={13} /> End-to-end encrypted</div>
    </div>
  );
}

const LangField = () => (
  <label className="field"><span>App language</span>
    <select id="ob-lang" defaultValue={S.settings.myLang || 'en'}>{ONB_LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  </label>
);

function Welcome() {
  if (liveOn()) {
    return (
      <div className="ob-card">
        <Logo size={64} /><h2>Welcome to WHATSMORE</h2>
        <p className="muted">Chat. AI. Pay. Business. Services. Community.<br />One secure app for your digital life.</p>
        <LangField />
        <ObBtn go="acct-signup"><Icon name="personadd" size={18} /> Create an account</ObBtn>
        <ObBtn go="acct-signin" cls="btn block"><Icon name="person" size={18} /> Sign in</ObBtn>
        <p className="muted small">By continuing you agree to the Terms and Privacy Policy.</p>
        <ObBtn go="skip" cls="link-btn">Try the demo without an account</ObBtn>
      </div>
    );
  }
  return (
    <div className="ob-card">
      <Logo size={64} /><h2>Welcome to WHATSMORE</h2>
      <p className="muted">Chat. AI. Pay. Business. Services. Community.<br />One secure app for your digital life.</p>
      <LangField />
      <ObBtn go="login" data={{ via: 'phone' }}><Icon name="phone" size={18} /> Continue with phone number</ObBtn>
      <ObBtn go="login" data={{ via: 'email' }} cls="btn block"><Icon name="doc" size={18} /> Continue with email</ObBtn>
      <p className="muted small">By continuing you agree to the Terms and Privacy Policy. <ObBtn go="skip" cls="link-btn">Skip demo setup</ObBtn></p>
    </div>
  );
}

function Login() {
  return (
    <div className="ob-card">
      <Dots n={1} />
      <h2>{OB.via === 'phone' ? 'Enter your phone number' : 'Enter your email'}</h2>
      <p className="muted small">We&apos;ll send a one-time code to verify it&apos;s you. {OB.via === 'phone' ? 'Your number stays hidden — people connect with your @username.' : ''}</p>
      {OB.via === 'phone' ? (
        <div className="ob-phone">
          <select id="ob-cc" aria-label="Country code"><option>+91</option><option>+1</option><option>+44</option><option>+971</option><option>+65</option></select>
          <input id="ob-id" inputMode="tel" maxLength={12} placeholder="98765 43210" autoComplete="off" autoFocus />
        </div>
      ) : <input id="ob-id" className="ob-input" type="email" placeholder="you@example.com" autoComplete="off" autoFocus />}
      <Err />
      <ObBtn go="otp">Send code</ObBtn>
      <ObBtn go="recover" cls="link-btn">Lost access to your {OB.via === 'phone' ? 'number' : 'email'}? Recover account</ObBtn>
      <ObBtn go="welcome" cls="link-btn">← Back</ObBtn>
    </div>
  );
}

function Otp() {
  const onInput = (i: number) => (e: React.FormEvent<HTMLInputElement>) => {
    const t = e.currentTarget, v = t.value.replace(/\D/g, '');
    const boxes = [...document.querySelectorAll<HTMLInputElement>('#onboard .otp-box')];
    if (v.length > 1) { boxes.forEach((b, j) => { b.value = v[j] || ''; }); return; }
    t.value = v;
    if (v && i < 5) boxes[i + 1]?.focus();
  };
  const onKey = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && i > 0) document.querySelector<HTMLInputElement>(`#onboard [data-otp="${i - 1}"]`)?.focus();
  };
  return (
    <div className="ob-card">
      <Dots n={2} />
      <h2>Verify it&apos;s you</h2>
      <p className="muted small">Enter the 6-digit code sent to <b>{OB.masked}</b></p>
      <div className="ob-otp">
        {Array.from({ length: 6 }, (_, i) => <input key={i} className="otp-box" data-otp={i} inputMode="numeric" aria-label={`Digit ${i + 1}`} autoFocus={i === 0} onInput={onInput(i)} onKeyDown={onKey(i)} />)}
      </div>
      <div className="demo-otp">Demo code: <b>{DEMO_OTP}</b> <ObBtn go="autofill" cls="link-btn">Fill it in</ObBtn></div>
      <Err />
      <ObBtn go="verify">Verify</ObBtn>
      <ObBtn go="login" cls="link-btn">Change {OB.via === 'phone' ? 'number' : 'email'}</ObBtn>
    </div>
  );
}

function Profile() {
  const [name, setName] = useState(OB.name);
  const [un, setUn] = useState(OB.un);
  const [k, msg] = un ? checkUsername(un) : ['', ''];
  return (
    <div className="ob-card">
      <Dots n={3} />
      <h2>Create your profile</h2>
      <div className="center"><Avatar o={{ name: name || '?', color: S.me.color }} size={84} /></div>
      <label className="field"><span>Your name</span><input id="ob-name" maxLength={25} value={name} placeholder="e.g. Anil Kumar" autoFocus onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Choose a unique username</span>
        <div className="un-input"><b>@</b><input id="ob-un" maxLength={24} value={un} placeholder="anilkumar" autoCapitalize="off" spellCheck={false} onChange={(e) => setUn(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} /></div>
        <small id="ob-un-st" className={`un-status ${k}`}>{msg}</small>
      </label>
      <div className="chips wrap" id="ob-sug">
        {obSuggest(name).map((u) => <button key={u} className="chip" data-act="ob" data-go="sug" data-u={u} onClick={() => setUn(u)}>@{u}</button>)}
      </div>
      <label className="set-row plain"><div className="grow"><div className="ci-name">Hide my phone number</div><div className="ci-sub">Recommended · people find you only by @username or QR</div></div><input type="checkbox" className="switch" id="ob-hide" defaultChecked={OB.hidePhone} /></label>
      <label className="field"><span>Who can find me by @username</span>
        <select id="ob-find" defaultValue={OB.find}><option value="everyone">Everyone</option><option value="contacts">My contacts</option><option value="nobody">Nobody</option></select>
      </label>
      <Err />
      <ObBtn go="security">Continue</ObBtn>
    </div>
  );
}

function Security() {
  return (
    <div className="ob-card">
      <Dots n={4} />
      <h2>Secure your account</h2><p className="muted small">Security is built in from day one.</p>
      <label className="field"><span>Two-step verification PIN (optional)</span><input id="ob-pin" className="pin-input" type="password" inputMode="numeric" maxLength={6} placeholder="••••••" /></label>
      <label className="set-row plain"><div className="grow"><div className="ci-name">Passkey on this device</div><div className="ci-sub">Sign in with fingerprint, face or screen lock</div></div><input type="checkbox" className="switch" id="ob-pass" /></label>
      <label className="set-row plain"><div className="grow"><div className="ci-name">New device alerts</div><div className="ci-sub">Get notified when your account is used elsewhere</div></div><input type="checkbox" className="switch" defaultChecked disabled /></label>
      <div className="hint-box flat"><Icon name="shield" size={16} /><span>Personal messages and calls are end-to-end encrypted. Encryption keys never leave your devices.</span></div>
      <ObBtn go="done">Finish</ObBtn>
    </div>
  );
}

function Done() {
  const live = 'liveIsSignedIn' in act && !!act.liveIsSignedIn();
  return (
    <div className="ob-card">
      <Dots n={5} />
      <div className="tick-anim"><Icon name="check" size={46} /></div>
      <h2>You&apos;re all set!</h2>
      <p>Welcome, <b>{OB.name}</b>. Friends can reach you at <b className="accent">@{OB.un}</b>{OB.hidePhone ? (live ? ' — your email stays private' : ' — your phone number stays private') : ''}.</p>
      <ObBtn go="enter">Start using WHATSMORE</ObBtn>
    </div>
  );
}

function AcctSignup() {
  const [un, setUn] = useState(ACC.un);
  const [res, setRes] = useState<{ u: string; ok: boolean | null } | null>(null);
  const valid = /^[a-z0-9._]{3,24}$/.test(un);
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const t = setTimeout(async () => {
      const ok = await act.liveUsernameAvailable(un);
      if (alive) setRes({ u: un, ok: ok == null ? null : !!ok });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [un, valid]);
  const st = !un ? { cls: '', text: '' }
    : !valid ? { cls: 'bad', text: '3–24 characters: letters, numbers, dot or underscore' }
      : res?.u !== un ? { cls: '', text: 'Checking…' }
        : res.ok == null ? { cls: '', text: 'Could not check right now' } : res.ok ? { cls: 'ok', text: `✓ @${un} is available` } : { cls: 'bad', text: `@${un} is already taken` };
  return (
    <div className="ob-card">
      <Logo size={56} /><h2>Create your account</h2>
      <p className="muted small">Friends find you by your unique @username. Your email stays private.</p>
      <label className="field"><span>Your name</span><input id="ac-name" maxLength={40} defaultValue={ACC.name} placeholder="e.g. Anil Kumar" autoComplete="name" autoFocus /></label>
      <label className="field"><span>Choose a unique username</span>
        <div className="un-input"><b>@</b><input id="ac-un" maxLength={24} value={un} placeholder="anilkumar" autoCapitalize="off" spellCheck={false} autoComplete="username" onChange={(e) => setUn(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} /></div>
        <small id="ac-un-st" className={`un-status ${st.cls}`}>{st.text}</small>
      </label>
      <label className="field"><span>Email</span><input id="ac-email" type="email" defaultValue={ACC.email} placeholder="you@example.com" autoComplete="email" /></label>
      <label className="field"><span>Password (at least 8 characters)</span><input id="ac-pw" type="password" minLength={8} autoComplete="new-password" /></label>
      <Err />
      <ObBtn go="acct-create">Create account</ObBtn>
      <ObBtn go="acct-signin" cls="link-btn">I already have an account</ObBtn>
      <ObBtn go="welcome" cls="link-btn">← Back</ObBtn>
    </div>
  );
}

function AcctSignin() {
  return (
    <div className="ob-card">
      <Logo size={56} /><h2>Sign in</h2>
      <label className="field"><span>Email</span><input id="ac-email" type="email" defaultValue={ACC.email} placeholder="you@example.com" autoComplete="email" autoFocus /></label>
      <label className="field"><span>Password</span><input id="ac-pw" type="password" autoComplete="current-password" /></label>
      <Err />
      <ObBtn go="acct-login">Sign in</ObBtn>
      <ObBtn go="acct-forgot" cls="link-btn">Forgot password?</ObBtn>
      <ObBtn go="acct-signup" cls="link-btn">Create a new account</ObBtn>
      <ObBtn go="welcome" cls="link-btn">← Back</ObBtn>
    </div>
  );
}

// ---------- recovery screens (recovery.js)
const OtherMethods = () => <ObBtn go="recover" cls="link-btn">← Other methods</ObBtn>;
function M({ go, ic, title, sub }: { go: string; ic: string; title: string; sub: string }) {
  return <button className="ob-method" data-act="ob" data-go={go} onClick={() => ob(go)}><Icon name={ic} size={22} /><div className="grow"><b>{title}</b><span>{sub}</span></div></button>;
}
function Recover() {
  const r = recState();
  return (
    <div className="ob-card">
      <Icon name="key" size={40} cls="accent" /><h2>Recover your account</h2>
      <p className="muted small">Lost your phone number or email? Choose how to prove it&apos;s you.</p>
      <M go="rec-key" ic="key" title="Recovery key" sub={`The 24-character key you saved${r.keyHash ? '' : ' · none set on this demo account'}`} />
      <M go="rec-trusted" ic="groups" title="Trusted contacts" sub="Get codes from 2 people you trust" />
      <M go="rec-email" ic="doc" title="Recovery email" sub={r.email ? 'Send a code to ' + r.email : 'Not set · uses a demo address'} />
      <Err />
      <ObBtn go="login" cls="link-btn">← Back to sign in</ObBtn>
    </div>
  );
}
function RecKey() {
  const r = recState();
  return (
    <div className="ob-card">
      <h2>Enter recovery key</h2>
      <input id="rk-in" className="ob-input rk-mono" placeholder="WM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} autoFocus />
      {r.keyHash ? null : <p className="muted small">This demo account has no recovery key yet. Create one in Settings → Account &amp; security, or use another method.</p>}
      <Err />
      <ObBtn go="rec-checkkey">Recover</ObBtn>
      <OtherMethods />
    </div>
  );
}
function RecTrusted() {
  const codes = useOb((s) => s.codes);
  const ids = recTrustedForDemo();
  return (
    <div className="ob-card">
      <h2>Ask your trusted contacts</h2>
      <p className="muted small">We sent a recovery request to {namesSummary(ids, 3)}. Ask any <b>2</b> of them for the code they see in WHATSMORE.</p>
      <div className="rec-list">
        {ids.map((id, i) => (
          <div className="rec-item" key={id}><Avatar o={contact(id)} size={32} /><span className="grow">{contact(id)?.name}</span><span className={`pill ${codes[i] ? 'ok' : ''}`}>{codes[i] ? 'Code: ' + codes[i] : 'Waiting…'}</span></div>
        ))}
      </div>
      <div className="ob-phone">
        <input id="rt-1" className="ob-input rk-mono" maxLength={6} inputMode="numeric" placeholder="Code 1" />
        <input id="rt-2" className="ob-input rk-mono" maxLength={6} inputMode="numeric" placeholder="Code 2" />
      </div>
      <Err />
      <ObBtn go="rec-checktrusted">Recover</ObBtn>
      <OtherMethods />
    </div>
  );
}
function RecEmail() {
  const r = recState();
  return (
    <div className="ob-card">
      <h2>Check your email</h2>
      <p className="muted small">Enter the code sent to <b>{r.email || 'r•••@example.com'}</b></p>
      <input id="re-in" className="ob-input rk-mono" maxLength={6} inputMode="numeric" placeholder="••••••" autoFocus />
      <div className="demo-otp">Demo code: <b>{DEMO_OTP}</b></div>
      <Err />
      <ObBtn go="rec-checkemail">Recover</ObBtn>
      <OtherMethods />
    </div>
  );
}
function RecDone() {
  return (
    <div className="ob-card">
      <div className="tick-anim"><Icon name="check" size={46} /></div>
      <h2>Account recovered</h2>
      <p>Welcome back, <b>{S.me.name}</b> (@{S.me.username}).</p>
      <div className="hint-box flat"><Icon name="shield" size={16} /><span>For your safety: every other session was logged out, payments are paused for 24 hours, and your contacts will see your security code change.</span></div>
      <ObBtn go="rec-secure">Set a new PIN</ObBtn>
    </div>
  );
}

const SCREENS: Record<string, () => ReactNode> = {
  splash: Splash, welcome: Welcome, login: Login, otp: Otp, profile: Profile, security: Security, done: Done,
  'acct-signup': AcctSignup, 'acct-signin': AcctSignin,
  recover: Recover, 'rec-key': RecKey, 'rec-trusted': RecTrusted, 'rec-email': RecEmail, 'rec-done': RecDone,
};

/** Always-mounted overlay: shows the onboarding when open, and opens it on first run. */
export function Onboarding() {
  const { open, step } = useOb();
  useEffect(() => {
    ensureSettings();
    if (!S.settings.onboarded) startOnboarding();
  }, []);
  useEffect(() => {
    if (!open || step !== 'splash') return;
    const t = setTimeout(() => { if (useOb.getState().step === 'splash') setStep('welcome'); }, 1800);
    return () => clearTimeout(t);
  }, [open, step]);
  if (!open) return null;
  const Screen = SCREENS[step] || Splash;
  return (
    <div id="onboard" className="onboard" role="dialog" aria-modal="true" aria-label="Welcome to WHATSMORE"
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
        const b = document.querySelector<HTMLButtonElement>('#onboard .btn.primary');
        if (b && !(e.target as HTMLElement).matches('button')) { e.preventDefault(); b.click(); }
      }}>
      <Screen key={step} />
    </div>
  );
}
