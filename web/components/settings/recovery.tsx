'use client';
// Account recovery (js/recovery.js): recovery key, recovery email and trusted contacts, set up in
// Settings → Account & security. The recovery screens of the sign-in flow live in Onboarding.tsx.
// Demo only: codes are shown on screen and only a hash of the key is kept.
import { useState } from 'react';
import { S, commit } from '@/lib/state';
import { hash, dayLabel, namesSummary } from '@/lib/util';
import { modal, toast, copyText } from '@/lib/overlay';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Note } from '@/components/ui/Bits';

export const DEMO_OTP = '246810';

export interface RecoveryState { email: string; trusted: string[]; keyHash: string; keyAt: number; lastRecovered?: { t: number; how: string } }
export const recState = (): RecoveryState => (S.settings.recovery ||= { email: '', trusted: [], keyHash: '', keyAt: 0 });
export const recCount = () => { const r = recState(); return [r.keyHash, r.email, r.trusted.length >= 2].filter(Boolean).length; };
export const normKey = (k: string) => k.toUpperCase().replace(/[^A-Z2-9]/g, '');
export async function sha256(t: string) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch { return 'h' + hash(t); }
}
function newRecoveryKey() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(24));
  return 'WM-' + ([...r].map((x) => A[x % A.length]).join('').match(/.{4}/g) || []).join('-');
}
export const trustedPool = () => S.contacts.filter((c) => c.isContact && !c.business && !c.blocked);

function RecRow({ act, ic, title, sub, done, onClick }: { act: string; ic: string; title: string; sub: string; done: boolean; onClick: () => void }) {
  return (
    <div className="set-row clickable" data-act={act} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}>
      <span className="action-ic plain"><Icon name={ic} size={22} /></span>
      <div className="grow"><div className="ci-name">{title}</div><div className="ci-sub">{sub}</div></div>
      {done ? <span className="pill ok"><Icon name="check" size={12} /> Set</span> : <span className="pill">Set up</span>}
    </div>
  );
}

/** "Account recovery · n of 3 set" block on the security page. */
export function RecoverySection() {
  const r = recState(), n = recCount();
  return (
    <>
      <div className="list-label">Account recovery · {n} of 3 set</div>
      <RecRow act="reckey" ic="key" title="Recovery key" sub={r.keyHash ? `Created ${dayLabel(r.keyAt).toLowerCase()} · only a fingerprint is stored` : 'A 24-character key you keep offline'} done={!!r.keyHash} onClick={recoveryKeyModal} />
      <RecRow act="recemail" ic="doc" title="Recovery email" sub={r.email ? `Verified · ${r.email}` : 'Get a code by email if you lose your phone'} done={!!r.email} onClick={recoveryEmailModal} />
      <RecRow act="rectrusted" ic="groups" title="Trusted contacts" sub={r.trusted.length >= 2 ? `${namesSummary(r.trusted, 3)} · any 2 can help you back in` : 'Pick 2–5 people who can vouch for you'} done={r.trusted.length >= 2} onClick={trustedContactsModal} />
      {n ? null : <div className="hint-box warn"><Icon name="warning" size={16} /><span>No recovery method yet. If you lose this phone number you could lose access to your account.</span></div>}
    </>
  );
}

export function recoveryKeyModal() {
  const r = recState();
  const key = newRecoveryKey();
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`WHATSMORE recovery key\n\n${key}\n\nAccount: @${S.me.username}\nCreated: ${new Date().toLocaleString()}\n\nKeep this offline. Anyone with this key and your account name can recover your account.\n`], { type: 'text/plain' }));
    a.download = 'WHATSMORE-recovery-key.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  modal({
    title: r.keyHash ? 'Create a new recovery key' : 'Your recovery key',
    body: (
      <>
        {r.keyHash ? <p className="muted small">Your old key will stop working.</p> : null}
        <div className="rec-key" id="rk-v">{key}</div>
        <div className="btn-row center">
          <button className="btn sm" id="rk-copy" onClick={() => copyText(key)}><Icon name="copy" size={16} /> Copy</button>
          <button className="btn sm" id="rk-dl" onClick={download}><Icon name="download" size={16} /> Download .txt</button>
        </div>
        <Note ic="key">Write it down or save it somewhere safe, offline. WHATSMORE only keeps a fingerprint (SHA-256) of this key, so we can never show it to you again.</Note>
        <label className="radio-row"><input type="checkbox" id="rk-ok" /> I&apos;ve saved my recovery key</label>
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Done', primary: true, onClick: (root) => {
        if (!root.querySelector<HTMLInputElement>('#rk-ok')?.checked) { toast('Tick the box once you have saved your key'); return false; }
        sha256(normKey(key)).then((h) => { r.keyHash = h; r.keyAt = Date.now(); commit(); toast('🔑 Recovery key saved'); });
      },
    }],
  });
}

export function recoveryEmailModal() {
  const r = recState();
  let masked = '';
  const h = { close: () => {} };
  const res = modal({
    title: 'Recovery email',
    body: (
      <>
        <label className="field"><span>Email address</span><input id="re-e" type="email" placeholder="you@example.com" autoComplete="off" autoFocus /></label>
        <div id="re-otp" hidden>
          <label className="field"><span>Enter the 6-digit code</span><input id="re-c" inputMode="numeric" maxLength={6} placeholder="••••••" /></label>
          <div className="demo-otp">Demo code: <b>{DEMO_OTP}</b></div>
        </div>
        {r.email ? <button className="link-btn danger" id="re-rm" onClick={() => { r.email = ''; commit(); h.close(); toast('Recovery email removed'); }}>Remove {r.email}</button> : null}
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Send code', primary: true, onClick: (root) => {
        const otp = root.querySelector<HTMLElement>('#re-otp')!;
        if (otp.hidden) {
          const v = root.querySelector<HTMLInputElement>('#re-e')!.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Enter a valid email address'); return false; }
          const [u, d] = v.split('@'); masked = `${u[0]}•••@${d}`;
          otp.hidden = false; root.querySelector<HTMLInputElement>('#re-c')?.focus();
          const b = root.querySelector('.modal-actions .btn.primary'); if (b) b.textContent = 'Verify';
          toast(`📨 Demo: code ${DEMO_OTP} “sent” to ${masked}`);
          return false;
        }
        if (root.querySelector<HTMLInputElement>('#re-c')!.value.trim() !== DEMO_OTP) { toast('Incorrect code — use the demo code shown'); return false; }
        r.email = masked; commit(); toast('Recovery email verified');
      },
    }],
  });
  h.close = res.close;
}

export function trustedContactsModal() {
  const r = recState(), picked = new Set(r.trusted);
  const pool = trustedPool();
  function Body() {
    const [, setN] = useState(0);
    return (
      <>
        <p className="muted small">If you lose access, WHATSMORE asks these people for a one-time code. Any <b>2</b> of them can help you back in. They never see your messages.</p>
        <div className="muted small" id="tc-n">{picked.size} selected · choose 2–5</div>
        <div className="pick-list">
          {pool.map((c) => (
            <label className="chat-item check-row" key={c.id}>
              <Avatar o={c} size={40} />
              <div className="ci-body"><div className="ci-name">{c.name}</div><div className="ci-preview">@{c.username}</div></div>
              <input type="checkbox" className="check" data-tc={c.id} defaultChecked={picked.has(c.id)} onChange={(e) => { if (e.target.checked) picked.add(c.id); else picked.delete(c.id); setN((x) => x + 1); }} />
            </label>
          ))}
        </div>
      </>
    );
  }
  modal({
    title: 'Trusted contacts',
    body: <Body />,
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: () => {
        if (picked.size && (picked.size < 2 || picked.size > 5)) { toast('Choose between 2 and 5 people'); return false; }
        const added = [...picked].filter((id) => !r.trusted.includes(id));
        r.trusted = [...picked]; commit();
        toast(picked.size ? `Trusted contacts saved${added.length ? ` · ${namesSummary(added, 2)} notified` : ''}` : 'Trusted contacts removed');
      },
    }],
  });
}
