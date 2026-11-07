'use client';
// Settings tab and settings pages (js/settings.js + the layers added by onboarding.js, superapp.js,
// recovery.js, devices.js and modules.js).
import { useState } from 'react';
import { S, ui, commit, KEY } from '@/lib/state';
import { openPage } from '@/lib/nav';
import { act } from '@/lib/registry';
import { COLORS, PLANS, PRIVACY_OPTS, money, fmtSize, fmtTime, listTime, contact } from '@/lib/util';
import { LANG_LIST } from '@/lib/translate';
import { PROFILES, switchProfile } from '@/lib/profiles';
import { modal, toast, confirmModal } from '@/lib/overlay';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { PageHead, ToggleRow, SelectRow, SettingRow, Note } from '@/components/ui/Bits';
import { Slot } from '@/components/ui/Slot';
import { Logo } from '@/components/app/Logo';
import type { Chat, Message } from '@/lib/types';
import { profileSaveHooks } from './hooks';
import { checkUsername, ensureSettings } from './common';
import { qrModal } from './qr';
import { RecoverySection } from './recovery';
import { startOnboarding } from './Onboarding';

// ---------- actions

export async function saveProfile(raw: { name: string; username: string; about: string }) {
  const name = raw.name.trim(), un = raw.username.trim().toLowerCase(), about = raw.about.trim();
  const p = { name, username: un, about: about || 'Hey there! I am using WHATSMORE.' };
  for (const h of profileSaveHooks) { if (await h(p)) return; }
  if (!name) { toast('Name cannot be empty'); return; }
  const [ok, msg] = checkUsername(un);
  if (ok !== 'ok') { toast(msg); return; }
  Object.assign(S.me, p);
  commit(); toast('Profile saved');
}

export function setPinModal(cb?: () => void) {
  modal({
    title: 'Create chat lock PIN',
    body: <><p className="muted">Locked chats are hidden from your chat list and need this PIN to open.</p><input id="pin-a" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus /><input id="pin-b" className="pin-input" type="password" inputMode="numeric" maxLength={4} placeholder="Confirm" /><div className="err" id="pin-err" /></>,
    actions: [{ label: 'Cancel' }, {
      label: 'Save PIN', primary: true, onClick: (root) => {
        const a = root.querySelector<HTMLInputElement>('#pin-a')!.value, b = root.querySelector<HTMLInputElement>('#pin-b')!.value;
        const err = root.querySelector('#pin-err')!;
        if (!/^\d{4}$/.test(a)) { err.textContent = 'PIN must be 4 digits'; return false; }
        if (a !== b) { err.textContent = "PINs don't match"; return false; }
        S.settings.lockPin = a; commit(); toast('Chat lock PIN saved');
        if (cb) setTimeout(cb, 0);
      },
    }],
  });
}

function resetDemo() {
  confirmModal('Reset demo data?', 'All chats, settings and media you added will be replaced with the original demo data.', 'Reset', () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    location.reload();
  });
}

function downloadData() {
  const strip = (k: string, v: unknown) => (typeof v === 'string' && v.startsWith('data:') && v.length > 200 ? `[${v.slice(5, v.indexOf(';'))} file omitted]` : k === 'lockPin' ? '[hidden]' : v);
  const data = { exportedAt: new Date().toISOString(), app: 'WHATSMORE', profile: S.me, settings: S.settings, contacts: S.contacts.filter((c) => c.isContact), chats: S.chats, payments: S.payments, calls: S.calls, status: S.myStatus, reports: S.reports };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, strip, 2)], { type: 'application/json' }));
  a.download = `WHATSMORE-data-${S.me.username}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Your data download has started');
}

function deleteAccountModal() {
  modal({
    title: 'Delete your account?',
    body: (
      <>
        <p className="muted">This erases your profile, @username, chats, files, payments history and backups from this device. You&apos;ll be removed from all groups. This can&apos;t be undone.</p>
        <Note ic="download">Tip: download your data first from this page.</Note>
        <label className="field"><span>Type <b>@{S.me.username}</b> to confirm</span><input id="da-u" autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus /></label>
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Delete account', danger: true, onClick: (root) => {
        const v = root.querySelector<HTMLInputElement>('#da-u')!.value.trim().replace(/^@/, '').toLowerCase();
        if (v !== S.me.username.toLowerCase()) { toast('Username does not match'); return false; }
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        toast('Account deleted (demo) · starting fresh');
        setTimeout(() => location.reload(), 900);
      },
    }],
  });
}

function reportScam() {
  const opts = { kind: 'scam', name: 'Scam or problem', defaultCat: 'Fraud', details: true };
  if ('reportTarget' in act) act.reportTarget(opts);
  else if ('reportScam' in act) act.reportScam();
  else act.reportTarget(opts);
}

// ---------- small row helpers
const keyClick = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') fn(); };
function ActionRow({ act: a, ic, title, sub, danger, chevron = true, extra, onClick }: { act: string; ic: string; title: string; sub?: string; danger?: boolean; chevron?: boolean; extra?: Record<string, string>; onClick: () => void }) {
  return (
    <div className={`list-row action ${danger ? 'danger' : ''}`} data-act={a} {...extra} role="button" tabIndex={0} onClick={onClick} onKeyDown={keyClick(onClick)}>
      <span className="action-ic plain"><Icon name={ic} size={22} /></span>
      {sub === undefined && danger ? <div className="ci-name">{title}</div> : <div className="grow"><div className="ci-name">{title}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>}
      {chevron ? <Icon name="chevright" size={20} cls="muted" /> : null}
    </div>
  );
}
function ClickRow({ act: a, ic, title, sub, danger, onClick }: { act: string; ic: string; title: string; sub: string; danger?: boolean; onClick: () => void }) {
  return (
    <div className={`set-row clickable ${danger ? 'danger' : ''}`} data-act={a} role="button" tabIndex={0} onClick={onClick} onKeyDown={keyClick(onClick)}>
      <span className="action-ic plain"><Icon name={ic} size={22} /></span>
      <div className="grow"><div className="ci-name">{title}</div><div className="ci-sub">{sub}</div></div>
    </div>
  );
}

// ---------- Settings tab
export function SettingsTab() {
  ensureSettings();
  return (
    <>
      <header className="side-head"><h2>Settings</h2></header>
      <div className="side-scroll">
        <div className="profile-card" data-act="page" data-page="set-profile" role="button" tabIndex={0} onClick={() => openPage('set-profile')} onKeyDown={keyClick(() => openPage('set-profile'))}>
          <Avatar o={S.me} size={64} />
          <div className="grow"><div className="pc-name">{S.me.name}</div><div className="ci-sub">@{S.me.username} · {S.me.about}</div></div>
          <button className="icon-btn accent" data-act="myqr" title="My QR code" aria-label="My QR code" onClick={(e) => { e.stopPropagation(); qrModal(); }}><Icon name="qr" /></button>
        </div>
        <Slot name="settings.account" />
        <SettingRow page="set-security" ic="shield" title="Account & security" sub="Two-step verification, passkeys, active sessions" />
        <SettingRow page="set-devices" ic="devices" title="Linked devices" sub={`${S.devices.filter((d) => !d.primary).length} of 4 linked · desktop, tablet & web`} />
        <SettingRow page="set-profiles" ic="person" title="Profiles" sub="Personal, Business, Creator, Family — one app" />
        <SettingRow page="set-privacy" ic="lock" title="Privacy" sub="Last seen, username discovery, blocked contacts" />
        <SettingRow page="set-data" ic="download" title="Your data & privacy" sub="Download data, permissions, reports, delete account" />
        <SettingRow page="set-ai" ic="sparkle" title="AI & memory" sub={S.settings.aiMemory ? 'AI memory on · you control what AI can use' : 'AI memory off'} />
        <SettingRow page="set-notify" ic="megaphone" title="Notifications" sub="Messages, calls, payments, business, security…" />
        <SettingRow page="set-chats" ic="chat" title="Chats" sub="Theme, enter to send, translation" />
        <SettingRow page="set-payments" ic="rupee" title="Payments" sub={money(S.wallet) + ' demo balance · transaction history'} />
        <SettingRow page="set-storage" ic="cloud" title="Storage & plans" sub={PLANS[S.settings.plan].name + ' plan'} />
        <SettingRow page="set-starred" ic="star" title="Starred messages" />
        <ActionRow act="svc" extra={{ 'data-mod': 'wellbeing' }} ic="timer" title="Digital wellbeing" sub="Screen time, focus mode, quiet hours" onClick={() => act.openView('mod:wellbeing')} />
        <ActionRow act="importchats" ic="importin" title="Import chats" sub="Bring your exported chat history from other apps" onClick={() => act.importChats()} />
        <SettingRow page="set-about" ic="info" title="About WHATSMORE" sub="More Than Chat." />
        <ActionRow act="replayonboard" ic="person" title="Replay welcome & sign-up" sub="Splash, login, OTP and username creation" chevron={false} onClick={startOnboarding} />
        <ActionRow act="resetdemo" ic="logout" title="Reset demo data" danger chevron={false} onClick={resetDemo} />
      </div>
    </>
  );
}

// ---------- Profile
export function ProfilePage() {
  const [name, setName] = useState(S.me.name);
  const [un, setUn] = useState(S.me.username);
  const [about, setAbout] = useState(S.me.about || '');
  const [k, msg] = checkUsername(un);
  return (
    <>
      <PageHead title="Profile" />
      <div className="side-scroll"><div className="form-pad">
        <div className="center"><Avatar o={S.me} size={140} /></div>
        <div className="swatches">
          {COLORS.map((c) => <button key={c} className={`swatch ${S.me.color === c ? 'on' : ''}`} style={{ background: c }} data-act="mecolor" data-c={c} aria-label={`Avatar colour ${c}`} onClick={() => { S.me.color = c; commit(); }} />)}
        </div>
        <label className="field"><span>Your name</span><input id="pf-name" maxLength={25} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Username</span>
          <div className="un-input"><b>@</b><input id="pf-un" maxLength={24} value={un} autoCapitalize="off" spellCheck={false} onChange={(e) => setUn(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} /></div>
          <small id="un-status" className={`un-status ${k}`}>{msg}</small>
        </label>
        <label className="field"><span>About</span><input id="pf-about" maxLength={80} value={about} onChange={(e) => setAbout(e.target.value)} /></label>
        <div className="hint-box"><Icon name="lock" size={16} /><span>Your phone number is never shown. People find you by <b>@username</b> or your QR code, and you approve chat requests from people outside your contacts.</span></div>
        <Slot name="settings.profile" />
        <div className="btn-row">
          <button className="btn" data-act="myqr" onClick={qrModal}><Icon name="qr" size={18} /> My QR</button>
          <button className="btn primary" data-act="saveprofile" onClick={() => saveProfile({ name, username: un, about })}>Save</button>
        </div>
      </div></div>
    </>
  );
}

// ---------- Account & security
export function SecurityPage() {
  const st = S.settings, sec = st.security;
  const score = [sec.twoStep, sec.passkeys, sec.biometric, sec.deviceAlerts, st.lockPin].filter(Boolean).length;
  const logoutAll = () => confirmModal('Log out of all other sessions?', 'Every device except this browser will be signed out.', 'Log out', () => { S.settings.sessions = S.settings.sessions.filter((s) => s.current); commit(); toast('Logged out of all other sessions'); });
  return (
    <>
      <PageHead title="Account & security" />
      <div className="side-scroll">
        <div className="dash">
          <div className="dash-score">
            <svg viewBox="0 0 36 36" width="64" height="64"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--track)" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${score * 20} 100`} transform="rotate(-90 18 18)" strokeLinecap="round" /></svg>
            <b>{score}/5</b>
          </div>
          <div><div className="ci-name">Privacy dashboard</div><div className="ci-sub">{score >= 4 ? 'Your account is well protected 💪' : 'Turn on more protections below to secure your account.'}</div></div>
        </div>
        <div className="list-label">Protection</div>
        <ToggleRow path="security.twoStep" label="Two-step verification" sub="Require a PIN when registering on a new device" />
        <ToggleRow path="security.passkeys" label="Passkeys" sub="Sign in with your fingerprint, face or screen lock" />
        <ToggleRow path="security.biometric" label="Biometric app lock" sub="Unlock WHATSMORE with Face ID / fingerprint" />
        <ToggleRow path="security.deviceAlerts" label="New device alerts" sub="Get notified when your account is used on a new device" />
        <div className="set-row" data-act="setpin" role="button" tabIndex={0} onClick={() => setPinModal()} onKeyDown={keyClick(() => setPinModal())}>
          <div><div className="ci-name">Chat lock PIN</div><div className="ci-sub">{st.lockPin ? 'PIN is set · tap to change' : 'Not set · tap to create'}</div></div>
          <Icon name="chevright" size={20} cls="muted" />
        </div>
        <RecoverySection />
        <Slot name="settings.security" />
        <div className="list-label">Active sessions</div>
        {st.sessions.map((s) => (
          <div className="set-row" key={s.id}>
            <span className="action-ic plain"><Icon name="devices" size={22} /></span>
            <div className="grow"><div className="ci-name">{s.name}</div><div className="ci-sub">{s.where} · {s.current ? <span className="green">This device</span> : 'Active ' + listTime(s.t)}</div></div>
            {s.current ? null : <button className="btn sm danger" data-act="logoutsession" data-s={s.id} onClick={() => { S.settings.sessions = S.settings.sessions.filter((x) => x.id !== s.id); commit(); toast('Session logged out'); }}>Log out</button>}
          </div>
        ))}
        {st.sessions.length > 1 ? <div className="pad"><button className="btn danger block" data-act="logoutall" onClick={logoutAll}>Log out of all other sessions</button></div> : null}
        <div className="hint-box"><Icon name="shield" size={16} /><span>Private chats, calls, groups and backups are end-to-end encrypted. WHATSMORE is designed with Privacy by Design and independent security audits.</span></div>
      </div>
    </>
  );
}

// ---------- Privacy
const VIS: [string, string][] = [['everyone', 'Everyone'], ['contacts', 'My contacts'], ['nobody', 'Nobody']];
export function PrivacyPage() {
  ensureSettings();
  const blocked = S.contacts.filter((c) => c.blocked);
  return (
    <>
      <PageHead title="Privacy" />
      <div className="side-scroll">
        <div className="list-label">Who can see my personal info</div>
        <SelectRow path="privacy.lastSeen" label="Last seen & online" opts={VIS} />
        <SelectRow path="privacy.photo" label="Profile photo" opts={VIS} />
        <SelectRow path="privacy.about" label="About" opts={VIS} />
        <SelectRow path="privacy.status" label="Status" opts={PRIVACY_OPTS.slice(0, 4)} />
        <ToggleRow path="privacy.readReceipts" label="Read receipts" sub="If turned off, you won't send or receive blue ticks." />
        <div className="list-label">Username</div>
        <SelectRow path="privacy.findByUsername" label="Who can find me by @username" opts={VIS} />
        <ToggleRow path="privacy.chatRequests" label="Allow chat requests" sub="People outside your contacts can request to chat" />
        <div className="list-label">Who can reach me</div>
        <SelectRow path="privacy.canMessage" label="Who can message me" opts={VIS} sub="Others send a chat request first" />
        <SelectRow path="privacy.canCall" label="Who can call me" opts={VIS} sub="Calls from others are silenced and listed as missed" />
        <SelectRow path="privacy.canAddGroups" label="Who can add me to groups" opts={VIS} sub="Others must send you an invite you accept" />
        <div className="list-label">Blocked contacts ({blocked.length})</div>
        {blocked.length ? blocked.map((c) => (
          <div className="set-row" key={c.id}>
            <Avatar o={c} size={36} />
            <div className="grow"><div className="ci-name">{c.name}</div><div className="ci-sub">@{c.username}</div></div>
            <button className="btn sm" data-act="unblockc" data-c={c.id} onClick={() => { const x = contact(c.id); if (!x) return; x.blocked = false; commit(); toast(`${x.name} unblocked`); }}>Unblock</button>
          </div>
        )) : <div className="empty-list small">No blocked contacts</div>}
      </div>
    </>
  );
}

// ---------- Chats
export function ChatsPage() {
  return (
    <>
      <PageHead title="Chats" />
      <div className="side-scroll">
        <div className="list-label">Display</div>
        <SelectRow path="theme" label="Theme" opts={[['light', 'Light'], ['dark', 'Dark'], ['system', 'System default']]} />
        <div className="list-label">Chat settings</div>
        <ToggleRow path="enterSend" label="Enter is send" sub="Press Enter to send. Shift + Enter adds a new line." />
        <ToggleRow path="autoTranslate" label="Auto-translate chats" sub="Show English translations under messages in other languages" />
        <SelectRow path="translateTo" label="My language" opts={LANG_LIST} />
        <div className="hint-box"><Icon name="translate" size={16} /><span>Real-time translation lets everyone read the chat in their own language. Demo translations are pre-generated; production would use an on-device or encrypted translation model.</span></div>
      </div>
    </>
  );
}

// ---------- Payments
export function PaymentsPage() {
  return (
    <>
      <PageHead title="Payments" />
      <div className="side-scroll">
        <div className="wallet"><div className="ci-sub">Demo wallet balance</div><div className="wallet-amt">{money(S.wallet)}</div><div className="ci-sub">@{S.me.username}@whatsmore</div></div>
        <div className="list-label">Transaction history</div>
        {S.payments.length ? S.payments.slice().sort((a, b) => b.t - a.t).map((p) => (
          <div className="set-row" key={p.id}>
            <span className={`pay-ic ${p.dir}`}><Icon name={p.dir === 'in' ? 'callin' : 'callout'} size={18} /></span>
            <div className="grow"><div className="ci-name">{p.dir === 'in' ? 'Received from' : 'Paid to'} {p.with}</div><div className="ci-sub">{p.note || ''} · {new Date(p.t).toLocaleDateString([], { day: 'numeric', month: 'short' })}, {fmtTime(p.t)}</div></div>
            <b className={p.dir === 'in' ? 'green' : ''}>{p.dir === 'in' ? '+' : '−'}{money(p.amount)}</b>
          </div>
        )) : <div className="empty-list small">No transactions yet</div>}
        <div className="hint-box"><Icon name="info" size={16} /><span>Payments in this demo are simulated — no real money moves. A production launch would use licensed payment partners and comply with local regulations (e.g. RBI / NPCI for UPI in India).</span></div>
      </div>
    </>
  );
}

// ---------- Storage & plans
const FILECATS: [string, string][] = [['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos'], ['documents', 'Documents'], ['receipts', 'Receipts'], ['invoices', 'Invoices'], ['audio', 'Audio'], ['links', 'Links']];
function fileCat(m: Message) {
  if (m.type === 'image') return 'photos';
  if (m.type === 'video') return 'videos';
  if (m.type === 'voice') return 'audio';
  if (m.type === 'invoice') return 'invoices';
  const n = String(m.name || '').toLowerCase();
  if (/invoice|inv[-_]/.test(n)) return 'invoices';
  if (/receipt|bill/.test(n)) return 'receipts';
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(n)) return 'audio';
  return 'documents';
}
const URL_RE = /https?:\/\/[^\s<]+/g;
function allFiles() {
  const out: { c: Chat; m: Message; cat: string }[] = [];
  S.chats.forEach((c) => {
    if (c.locked && !ui.unlocked.includes(c.id)) return;
    c.messages.forEach((m) => {
      if (['image', 'video', 'doc', 'voice', 'invoice'].includes(m.type) && !m.cloudDedup) out.push({ c, m, cat: fileCat(m) });
      if (m.type === 'text') (String(m.text || '').match(URL_RE) || []).forEach((u, i) => out.push({ c, m: { id: m.id, type: 'link', name: u, url: u, from: m.from, t: m.t + i, size: 1 }, cat: 'links' }));
    });
  });
  return out;
}
const storageUsed = (files: { m: Message }[]) => files.reduce((s, { m }) => s + (m.size || (m.src ? m.src.length * 0.75 : 0) || (m.type === 'voice' ? (m.dur || 0) * 4000 : 180000)), 0);

export function StoragePage() {
  ensureSettings();
  const st = S.settings;
  const files = allFiles(), used = storageUsed(files);
  const byCat: Record<string, number> = {};
  files.forEach(({ cat }) => { byCat[cat] = (byCat[cat] || 0) + 1; });
  const plan = PLANS[st.plan];
  return (
    <>
      <PageHead title="Storage & plans" />
      <div className="side-scroll">
        <div className="storage pad">
          <div className="storage-top"><span>Used</span><span>{fmtSize(used)} of {plan.quota}</span></div>
          <div className="meter"><div style={{ width: `${Math.max(2, (used / plan.bytes) * 100)}%` }} /></div>
          <div className="cat-counts">{FILECATS.slice(1).map(([k, l]) => <span key={k}>{l}: <b>{byCat[k] || 0}</b></span>)}</div>
        </div>
        <div className="list-label">Plans</div>
        <div className="plans">
          {Object.entries(PLANS).map(([k, p]) => (
            <div key={k} className={`plan ${st.plan === k ? 'on' : ''}`}>
              <div className="plan-name">{p.name}</div><div className="plan-q">{p.quota}</div><div className="ci-sub">{p.price}</div>
              {p.perk ? <div className="plan-perk">{p.perk}</div> : null}
              {st.plan === k ? <span className="pill">Current</span> : <button className="btn sm" data-act="chooseplan" data-plan={k} onClick={() => { S.settings.plan = k; commit(); toast(`Switched to ${PLANS[k].name} plan (demo — no charge)`); }}>Choose</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------- About
const FEATURES = ['Private chat 💬', 'Voice & video calls 📞', 'Groups & communities 👥', 'Stories & status 📸', 'Username-based connection 👤', 'End-to-end encryption 🔐', 'AI assistant & translation 🤖', 'Cloud & file sharing ☁️', 'Payments 💳', 'Business accounts 💼', 'Linked devices 💻', 'Any file type · document correction · digital signature ✍️', 'Super-app services: Pay, Market, Citizen, Learn, Family, SOS, News, My Area, Creator 🌍'];
export function AboutPage() {
  return (
    <>
      <PageHead title="About" />
      <div className="side-scroll"><div className="about">
        <div className="logo-big"><Logo size={72} /></div><h2>WHATSMORE</h2><p className="muted">More Than Chat. · Demo v1.0</p>
        <ol className="feat-list">{FEATURES.map((f) => <li key={f}>{f}</li>)}</ol>
        <p className="muted small">CHAT + CALLS + GROUPS + STORIES + USERNAME + SECURITY + AI + CLOUD + PAYMENTS + BUSINESS</p>
      </div></div>
    </>
  );
}

// ---------- Profiles, AI & memory, Notifications (modules.js)
export function ProfilesPage() {
  const st = S.settings;
  const subs: Record<string, string> = { personal: 'Friends & family · @' + S.me.username, business: S.me.name + ' Designs · catalogue, orders, AI replies', creator: 'Followers, subscribers, paid community', family: 'Family Hub, shared calendar, location' };
  return (
    <>
      <PageHead title="Profiles" />
      <div className="side-scroll">
        <p className="pad muted small">One app, separate identities. Each profile has its own chats, notifications, privacy settings, status and profile info.</p>
        {Object.entries(PROFILES).map(([k, [l, e]]) => (
          <div key={k} className="set-row" data-act="setprofile" data-p={k} role="button" tabIndex={0} onClick={() => switchProfile(k)} onKeyDown={keyClick(() => switchProfile(k))}>
            <span className="big-emoji">{e}</span>
            <div className="grow"><div className="ci-name">{l}</div><div className="ci-sub">{subs[k]}</div></div>
            {(st.profile || 'personal') === k ? <span className="pill">Active</span> : null}
          </div>
        ))}
      </div>
    </>
  );
}

export function AIPage() {
  ensureSettings();
  const clear = () => confirmModal('Clear AI memory?', 'WHATSMORE AI will forget your preferences and past AI conversations.', 'Clear', () => { S.mod.ai = null; commit(); toast('AI memory cleared'); });
  return (
    <>
      <PageHead title="AI & memory" />
      <div className="side-scroll">
        <ToggleRow path="aiMemory" label="AI memory" sub="Let WHATSMORE AI remember your preferences. Off = nothing is remembered." />
        <div className="list-label">What AI may use</div>
        <ToggleRow path="aiPerms.chats" label="Chats you choose to summarize" sub="Only when you ask — never in the background" />
        <ToggleRow path="aiPerms.files" label="Files & documents" sub="For summaries, proofreading and smart search" />
        <ToggleRow path="aiPerms.contacts" label="Contact names" sub="To understand “the invoice Ramesh sent”" />
        <ToggleRow path="aiPerms.location" label="Location" sub="For My Area suggestions" />
        <div className="pad"><button className="btn danger block" data-act="clearaimem" onClick={clear}>Clear AI memory</button></div>
        <div className="hint-box"><Icon name="shield" size={16} /><span>Sensitive data (payments, IDs, health) is never used for AI memory. AI runs through a model-agnostic gateway — on-device where possible.</span></div>
      </div>
    </>
  );
}

const NOTIFY: [string, string][] = [['messages', 'Messages'], ['calls', 'Calls'], ['payments', 'Payments'], ['business', 'Business'], ['marketplace', 'Marketplace'], ['community', 'Community & channels'], ['ai', 'AI suggestions'], ['security', 'Security alerts'], ['services', 'Government & services']];
export function NotifyPage() {
  return (
    <>
      <PageHead title="Notifications" />
      <div className="side-scroll">
        <div className="list-label">Notify me about</div>
        {NOTIFY.map(([k, l]) => <ToggleRow key={k} path={'notify.' + k} label={l} />)}
        <div className="hint-box"><Icon name="timer" size={16} /><span>Use Digital wellbeing for focus mode, quiet hours and a daily notification summary.</span></div>
      </div>
    </>
  );
}

// ---------- Your data & privacy (superapp.js §35)
export function DataPage() {
  ensureSettings();
  const pr = S.settings.perms;
  const reports = (S.reports || []) as { id: string; kind: string; name: string; cat: string; t: number; status: string }[];
  return (
    <>
      <PageHead title="Your data & privacy" />
      <div className="side-scroll">
        <div className="list-label">Your data</div>
        <ClickRow act="dldata" ic="download" title="Download my data" sub="Profile, chats, contacts, settings and payments as a JSON file" onClick={downloadData} />
        <div className="list-label">Permissions</div>
        <ToggleRow path="perms.ai" label="AI features" sub="Summaries, smart replies and translation can read the chat you ask about" />
        <ToggleRow path="perms.location" label="Location" sub="Share location, My Area and SOS location" />
        <ToggleRow path="perms.contacts" label="Contacts" sub="Find friends on WHATSMORE from your address book" />
        <ToggleRow path="perms.camera" label="Camera" sub="Video calls, photos and QR scanning" />
        <ToggleRow path="perms.mic" label="Microphone" sub="Voice calls and voice messages" />
        <ToggleRow path="perms.cloud" label="Cloud backup" sub="Encrypted backup of chats and files" />
        <div className="list-label">Devices &amp; sessions</div>
        <SettingRow page="set-devices" ic="devices" title="Device management" sub={`${S.devices.length} device${S.devices.length === 1 ? '' : 's'}`} />
        <SettingRow page="set-security" ic="logout" title="Active sessions & logout" sub={`${S.settings.sessions.length} active`} />
        <div className="list-label">My reports ({reports.length})</div>
        {reports.length ? reports.slice().reverse().map((r) => (
          <div className="set-row" key={r.id}>
            <span className="pill third">{r.cat}</span>
            <div className="grow"><div className="ci-name">{r.kind[0].toUpperCase() + r.kind.slice(1)} · {r.name}</div><div className="ci-sub">{listTime(r.t)} · {r.status}</div></div>
          </div>
        )) : <div className="empty-list small">You haven&apos;t reported anything.</div>}
        <ClickRow act="reportscam" ic="warning" title="Report a scam or problem" sub="Fraud, phishing, security concern" onClick={reportScam} />
        <div className="list-label">Account</div>
        <ClickRow act="delaccount" ic="delete" title="Delete my account" sub="Erases your profile, chats and backups" danger onClick={deleteAccountModal} />
        <Slot name="settings.data" />
        <div className="hint-box"><Icon name="shield" size={16} /><span>Privacy by design: you choose what WHATSMORE can use, and you can take your data with you or delete it at any time.{pr.ai ? '' : ' AI features are off.'}</span></div>
      </div>
    </>
  );
}
