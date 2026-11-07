'use client';
// Linked devices (js/devices.js): device list, link-a-device modal with a refreshing QR code, link
// with a code, simulated scan with key exchange, and the per-device menu (rename, key, log out).
import { useEffect, useRef, useState } from 'react';
import { S, ui, commit, refresh } from '@/lib/state';
import { uid, hash, listTime } from '@/lib/util';
import { modal, toast, showMenu, confirmModal } from '@/lib/overlay';
import { Icon } from '@/components/Icon';
import { PageHead, ToggleRow } from '@/components/ui/Bits';
import type { Dict } from '@/lib/types';
import { QRBox } from './qr';

const DEVICE_KINDS: [string, string][] = [['laptop', 'Windows laptop · WHATSMORE Desktop'], ['laptop', 'MacBook Air · WHATSMORE for Mac'], ['tablet', 'iPad · WHATSMORE for iPad'], ['tablet', 'Android tablet'], ['devices', 'Chrome · WHATSMORE Web']];
export const MAX_LINKED = 4;
const DeviceIcon = ({ k }: { k: string }) => <Icon name={k === 'phone' ? 'phone' : k === 'tablet' ? 'tablet' : k === 'laptop' ? 'laptop' : 'devices'} size={24} />;
const fingerprint = (id: string) => Array.from({ length: 4 }, (_, i) => (hash(id + i) % 65536).toString(16).toUpperCase().padStart(4, '0')).join(' ');

export function DevicesPage() {
  const linked = S.devices.filter((d) => !d.primary);
  return (
    <>
      <PageHead title="Linked devices" />
      <div className="side-scroll">
        <div className="dev-hero">
          <div className="dev-art"><Icon name="phone" size={34} /><Icon name="laptop" size={46} /><Icon name="tablet" size={38} /></div>
          <p>Use WHATSMORE on <b>up to {MAX_LINKED} linked devices</b> and 1 phone at the same time. Linked devices keep working even when your phone is offline.</p>
          <button className="btn primary" data-act="linkdevice" disabled={linked.length >= MAX_LINKED} onClick={linkDeviceModal}><Icon name="qr" size={18} /> Link a device</button>
          <div className="ci-sub">{linked.length} of {MAX_LINKED} linked</div>
        </div>
        <div className="list-label">Device status</div>
        {S.devices.map((d) => (
          <div key={d.id} className="set-row dev" data-act="devmenu" data-dev={d.id} role="button" tabIndex={0} onClick={(e) => deviceMenu(d.id, e.currentTarget)}>
            <span className={`dev-ic ${d.current ? 'on' : ''}`}><DeviceIcon k={d.kind} /></span>
            <div className="grow">
              <div className="ci-name">{d.name}</div>
              <div className="ci-sub">{d.primary ? 'Primary phone' : d.current ? <span className="green">This device · active now</span> : 'Last active ' + listTime(d.t).toLowerCase()} · {d.where}</div>
              <div className="ci-sub mono"><Icon name="lock" size={11} /> Key {fingerprint(d.id)}</div>
            </div>
            {d.primary ? null : <Icon name="chevright" size={20} cls="muted" />}
          </div>
        ))}
        <div className="list-label">Options</div>
        <ToggleRow path="devices.syncHistory" label="Sync full chat history" sub="New devices receive an encrypted copy of your recent chats" />
        <ToggleRow path="devices.biometricLink" label="Confirm with fingerprint to link" sub="Extra protection before any new device is added" />
        <ToggleRow path="security.deviceAlerts" label="New device alerts" sub="Get a security alert whenever a device is linked" />
        <div className="hint-box"><Icon name="lock" size={16} /><span>Every device has its own encryption keys. Your personal messages, calls and files stay end-to-end encrypted on all linked devices.</span></div>
        <div className="hint-box"><Icon name="devices" size={16} /><span><b>Try live sync:</b> open this demo in a second browser tab or window. It behaves like a linked device — send a message in one and watch it appear in the other.</span></div>
        {linked.length > 1 ? <div className="pad"><button className="btn danger block" data-act="devlogoutall" onClick={logoutAllDevices}>Log out from all linked devices</button></div> : null}
      </div>
    </>
  );
}

function logoutAllDevices() {
  confirmModal('Log out from all linked devices?', 'Every linked device except your phone and this browser will be signed out.', 'Log out', () => {
    const gone = S.devices.filter((d) => !d.primary && !d.current).map((d) => d.id);
    S.devices = S.devices.filter((d) => !gone.includes(d.id));
    S.settings.sessions = S.settings.sessions.filter((s) => !gone.includes(s.id));
    commit(); toast('Logged out from all linked devices');
  });
}

const newCode = () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

function LinkBody({ h }: { h: { close: () => void } }) {
  const [code, setCode] = useState(newCode);
  const [left, setLeft] = useState(20);
  const [showCode, setShowCode] = useState(false);
  const [kind, setKind] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'bio' | 'linking'>('idle');
  const [step, setStep] = useState(0);
  const linkedName = useRef('');
  useEffect(() => {
    let l = 20;
    const t = setInterval(() => {
      l--;
      if (l <= 0) { l = 20; setCode(newCode()); }
      setLeft(l);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const steps = ['Verifying QR code and device identity', 'Exchanging encryption keys', S.settings.devices?.syncHistory ? `Syncing encrypted history · ${S.chats.length} chats` : 'Setting up (history sync off)', 'Linked'];
  useEffect(() => {
    if (phase !== 'linking') return;
    if (step < steps.length - 1) { const t = setTimeout(() => setStep((s) => s + 1), 900); return () => clearTimeout(t); }
    const [k, name] = DEVICE_KINDS[kind];
    linkedName.current = name;
    const d: Dict = { id: 'd_' + uid(), kind: k, name, where: 'Hyderabad, IN', t: Date.now() };
    S.devices.push(d);
    S.settings.sessions.push({ id: d.id, name, where: d.where, t: d.t });
    commit();
    const t = setTimeout(() => {
      h.close();
      if (S.settings.security.deviceAlerts) {
        toast(<>🔐 Security alert: <b>{name}</b> was linked to your account just now. Not you? Tap to review.</>, () => { ui.tab = 'settings'; ui.page = 'set-devices'; refresh(); }, { ms: 6000 });
      }
    }, 700);
    return () => clearTimeout(t);
    // steps is derived each render; the effect is driven by phase/step only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);
  const scan = () => { if (S.settings.devices?.biometricLink) setPhase('bio'); else { setStep(0); setPhase('linking'); } };
  return (
    <>
      <div className="link-grid">
        <ol className="link-steps">
          <li>Open <b>web.whatsmore.app</b> or WHATSMORE Desktop on your computer or tablet</li>
          <li>Choose <b>Link with phone</b></li>
          <li>Point your phone at this screen to scan the QR code</li>
        </ol>
        <div className="link-qr">
          <QRBox id="lk-qr" text={'whatsmore://link/' + code} />
          <div className="ci-sub" id="lk-timer">Code refreshes in {left}s</div>
          <button className="link-btn" id="lk-code" onClick={() => setShowCode(true)}>Link with a code instead</button>
          <div id="lk-codebox">
            {showCode ? <><div className="link-code">{code.split('').map((c, i) => <span key={i}>{c}</span>)}</div><div className="ci-sub">Enter this code on the other device</div></> : null}
          </div>
        </div>
      </div>
      <div className="hint-box flat">
        <Icon name="devices" size={16} />
        <div className="grow"><b>Demo:</b> simulate scanning from
          <div className="join-sim">
            <select id="lk-kind" value={kind} onChange={(e) => setKind(+e.target.value)}>{DEVICE_KINDS.map(([, n], i) => <option key={i} value={i}>{n}</option>)}</select>
            <button className="btn sm primary" id="lk-go" onClick={scan}>Scan</button>
          </div>
        </div>
      </div>
      <div id="lk-progress">
        {phase === 'bio' ? (
          <div className="bio"><Icon name="key" size={28} /><div className="grow"><b>Confirm it&apos;s you</b><div className="ci-sub">Touch the fingerprint sensor to link {DEVICE_KINDS[kind][1]}</div></div><button className="btn sm primary" id="lk-bio" onClick={() => { setStep(0); setPhase('linking'); }}>👆 Use fingerprint</button></div>
        ) : phase === 'linking' ? (
          <div className="link-prog">
            {steps.map((s, j) => (
              <div key={j} className={`lp-step ${j < step ? 'done' : j === step ? 'now' : ''}`}>
                {j < step ? <Icon name="check" size={16} /> : j === step ? <span className="spin" /> : <span className="dot" />}<span>{s}</span>
              </div>
            ))}
            <div className="meter"><div style={{ width: `${(step / (steps.length - 1)) * 100}%` }} /></div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function linkDeviceModal() {
  if (S.devices.filter((d) => !d.primary).length >= MAX_LINKED) { toast(`You can link up to ${MAX_LINKED} devices. Log out of one first.`); return; }
  const h = { close: () => {} };
  const r = modal({ title: 'Link a device', wide: true, body: <LinkBody h={h} />, actions: [{ label: 'Close' }] });
  h.close = r.close;
}

function deviceMenu(id: string, anchor: Element) {
  const d = S.devices.find((x) => x.id === id);
  if (!d || d.primary) return;
  showMenu(anchor, [
    {
      label: 'Rename', icon: 'edit', onClick: () => modal({
        title: 'Rename device',
        body: <label className="field"><span>Name</span><input id="dv-n" maxLength={40} defaultValue={d.name} autoFocus /></label>,
        actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: (root) => { d.name = root.querySelector<HTMLInputElement>('#dv-n')!.value.trim() || d.name; commit(); } }],
      }),
    },
    {
      label: 'Encryption key', icon: 'lock', onClick: () => modal({
        title: d.name,
        body: <><p className="muted">Compare this key on the device to verify it.</p><div className="sec-code">{fingerprint(d.id).split(' ').concat(fingerprint(d.id + 'x').split(' ')).map((x, i) => <span key={i}>{x}</span>)}</div></>,
        actions: [{ label: 'Done', primary: true }],
      }),
    },
    !d.current && {
      label: 'Log out', icon: 'logout', danger: true, onClick: () => confirmModal(`Log out of ${d.name}?`, 'This device will stop receiving messages until it is linked again.', 'Log out', () => {
        S.devices = S.devices.filter((x) => x !== d); S.settings.sessions = S.settings.sessions.filter((s) => s.id !== d.id); commit(); toast('Device logged out');
      }),
    },
  ]);
}
