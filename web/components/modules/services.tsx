'use client';
/* eslint-disable react-hooks/purity -- views read the clock (progress of orders, events) */
// Citizen Services and Emergency SOS (js/modules.js + SOS options/audio from js/cloudplus.js).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { S, ui, commit, refresh } from '@/lib/state';
import { modal, toast, readDataURL } from '@/lib/overlay';
import { sendMsg, simulateIncoming } from '@/lib/actions';
import { directChatFor, firstName, fmtTime } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Note, ToggleRow } from '@/components/ui/Bits';
import { MS, UL, modalWith, val, fmtStamp, getLocation } from './shared';
import { payBill } from './pay';

// ---------- CITIZEN SERVICES
const CITIZEN: [string, string, string, string, number][] = [
  ['cert', '🧾', 'Certificates', 'Birth, income, caste, residence', 1], ['elec', '⚡', 'Electricity', 'Pay bill · new connection · complaints', 1], ['water', '💧', 'Water', 'Bill · tanker · leakage complaint', 1],
  ['transport', '🚍', 'Transport', 'Driving licence · vehicle tax · bus pass', 1], ['municipal', '🏛️', 'Municipal', 'Property tax · trade licence', 1], ['grievance', '📢', 'Public grievance', 'Report potholes, garbage, streetlights', 1],
  ['health', '🏥', 'Health', 'Hospital appointments (partner)', 0], ['edu', '🎓', 'Education', 'Scholarships · exam results', 1],
];
const ctzState = () => MS('citizen', () => ({ apps: [] as any[] }));

function ctz(k: string) {
  const def = CITIZEN.find((c) => c[0] === k)!;
  const st = ctzState();
  const file = (title: string, steps: string[], prefix: string) => { const a = { id: prefix + '-' + Math.floor(1e5 + Math.random() * 9e5), title, steps, t: Date.now() }; st.apps.push(a); commit(); toast(`Submitted · reference ${a.id}`); };
  if (k === 'elec' || k === 'water') return payBill(k === 'elec' ? 0 : 1);
  if (k === 'grievance') {
    return modal({
      title: '📢 Public grievance',
      body: <><label className="field"><span>Category</span><select id="gv-c"><option>Pothole / road damage</option><option>Garbage not collected</option><option>Streetlight not working</option><option>Water leakage</option><option>Other</option></select></label><label className="field"><span>Describe the problem</span><textarea id="gv-d" rows={3} placeholder="Where and what?" /></label><label className="radio-row"><input type="checkbox" defaultChecked /> Attach my current location (with permission)</label></>,
      actions: [{ label: 'Cancel' }, { label: 'Submit', primary: true, onClick: (root) => file('Grievance: ' + val(root, '#gv-c'), ['Registered', 'Assigned to officer', 'In progress', 'Resolved'], 'GRV') }],
    });
  }
  if (k === 'cert' || k === 'transport' || k === 'municipal' || k === 'edu') {
    const opts = ({ cert: ['Income certificate', 'Birth certificate', 'Caste certificate', 'Residence certificate'], transport: ['Driving licence renewal', 'Vehicle tax payment', 'Student bus pass'], municipal: ['Property tax receipt', 'Trade licence'], edu: ['Post-matric scholarship', 'Exam results'] } as Record<string, string[]>)[k];
    return modal({
      title: `${def[1]} ${def[2]}`,
      body: <><p className="muted small"><Icon name="verified" size={14} /> Official government service · your WHATSMORE ID is used only with your consent.</p><label className="field"><span>Service</span><select id="ct-s">{opts.map((o) => <option key={o}>{o}</option>)}</select></label><label className="field"><span>Applicant name</span><input id="ct-n" defaultValue={S.me.name} /></label><label className="field"><span>Upload supporting document</span><input type="file" id="ct-f" /></label></>,
      actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: (root) => file(val(root, '#ct-s'), ['Submitted', 'Documents verified', 'Approved', 'Issued · digitally signed'], 'APP') }],
    });
  }
  modal({ title: def[2], body: <><p className="muted">{def[3]}</p><Note>This is a third-party partner service, not an official government service. WHATSMORE labels the difference clearly.</Note></>, actions: [{ label: 'Book appointment', primary: true, onClick: () => file('Hospital appointment', ['Requested', 'Confirmed', 'Visited'], 'HSP') }] });
}

export function CitizenView() {
  const st = ctzState();
  useEffect(() => {
    const t = setInterval(() => { if (S.mod.citizen?.apps?.some((a: any) => Date.now() - a.t < 60000)) refresh(); }, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="official-banner"><Icon name="bank" size={20} /><div><b>Official services only from verified sources</b><div className="ci-sub">Government services connect through official APIs and authorised integrations. Each tile shows whether it is an official government service or a third-party partner.</div></div></div>
      <div className="biller-grid">{CITIZEN.map(([k, e, n, s, off]) => <button key={k} className="biller" data-act="ctz" data-k={k} onClick={() => ctz(k)}><span className="big-emoji">{e}</span><b>{n}</b><span className="ci-sub">{s}</span><span className={`pill ${off ? 'gov' : 'third'}`}>{off ? '✓ Official' : 'Third-party'}</span></button>)}</div>
      {st.apps.length ? (
        <Sec title="My applications & complaints">
          {st.apps.slice().reverse().map((a: any) => { const step = Math.min(a.steps.length - 1, Math.floor((Date.now() - a.t) / 15000)); return (
            <div className="app-row" key={a.id}><div className="row-between"><b>{a.title}</b><span className="pill">{a.steps[step]}</span></div><div className="ci-sub">{a.id} · {fmtStamp(a.t)}</div><div className="track">{a.steps.map((s: string, i: number) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}</div></div>
          ); })}
        </Sec>
      ) : null}
      <Sec title="Government notifications">
        {[['🗳️', 'Voter list revision', 'Check and update your details by 30 Nov', 'Election Office'], ['💉', 'Free health camp', 'Sunday 9 AM–1 PM at Community Hall, Ward 12', 'Health Department'], ['🚧', 'Road works', 'Traffic diversion on Main Road till Friday', 'Municipal Corporation']].map(([e, t, d, by]) => (
          <div className="set-row" key={t}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{t}</div><div className="ci-sub">{d}</div></div><span className="pill gov"><Icon name="verified" size={12} /> {by}</span></div>
        ))}
      </Sec>
      <Sec title="Emergency numbers">
        <div className="chips wrap">{[['112', 'Emergency'], ['100', 'Police'], ['101', 'Fire'], ['108', 'Ambulance'], ['1098', 'Child helpline'], ['1930', 'Cyber crime']].map(([n, l]) => <a key={n} className="chip" href={`tel:${n}`}>{l} · <b>{n}</b></a>)}</div>
      </Sec>
    </>
  );
}

// ---------- EMERGENCY SOS
async function sosRecord() {
  const send = (src: string | null, dur: number) => S.settings.emergency.contacts.forEach((cid: string) => { const ch = directChatFor(cid); if (ch) sendMsg(ch, { type: 'voice', dur, src, caption: '🆘 SOS audio' }); });
  toast('🎙️ Recording 15 seconds of audio for your emergency contacts', null, { ms: 4000 });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream), chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); send(await readDataURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })), 15); };
    rec.start();
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 15000);
  } catch { setTimeout(() => send(null, 15), 15000); }
}
async function sosFire() {
  const loc = (await getLocation()) || ['17.44010', '78.34890'];
  const link = `https://maps.google.com/?q=${loc[0]},${loc[1]}`;
  ui.sosActive = { at: Date.now() };
  S.settings.emergency.contacts.forEach((cid: string) => {
    const ch = directChatFor(cid);
    if (!ch) return;
    sendMsg(ch, { type: 'text', text: `🆘 SOS — ${S.settings.emergency.message}\n📍 Live location: ${link}` });
    simulateIncoming(ch, cid, '😟 Calling you now! Stay where you are, I’m coming.', 2500);
  });
  refresh();
  toast('🆘 SOS sent with your location to your emergency contacts', null, { ms: 5000 });
  // cloudplus.js: call 112 shortcut and optional audio recording
  if (S.settings.emergency.call112) toast('📞 Tap to call 112', () => { location.href = 'tel:112'; }, { ms: 15000 });
  if (S.settings.emergency.record) sosRecord();
}
function SosCountdown({ close }: { close: () => void }) {
  const [n, setN] = useState(5);
  useEffect(() => {
    let left = 5;
    const t = setInterval(() => {
      left--;
      setN(left);
      if (left > 0) return;
      clearInterval(t);
      close();
      sosFire();
    }, 1000);
    return () => clearInterval(t);
  }, [close]);
  return <div className="sos-count"><div id="sos-n">{n}</div><p className="muted">Alerting your emergency contacts…</p></div>;
}
function sosGo() {
  if (!S.settings.emergency.contacts.length) return toast('Choose at least one emergency contact first');
  modalWith({ title: 'Starting SOS', actions: [{ label: 'Cancel SOS', danger: true }] }, (close) => <SosCountdown close={close} />);
}
function sosSafe() {
  ui.sosActive = null;
  S.settings.emergency.contacts.forEach((cid: string) => { const ch = directChatFor(cid); if (ch) sendMsg(ch, { type: 'text', text: "✅ I'm safe now. Location sharing stopped. Thank you!" }); });
  refresh(); toast('Location sharing stopped');
}

export function SOSView() {
  const em = S.settings.emergency, active = ui.sosActive;
  return (
    <>
      <div className="sos-wrap">
        {active ? (
          <div className="sos-live"><div className="sos-pulse">SOS</div><b>SOS is active</b><div className="ci-sub">Live location shared with {em.contacts.length} contact{em.contacts.length === 1 ? '' : 's'} · {fmtTime(active.at)}</div><button className="btn primary" data-act="sossafe" onClick={sosSafe}>I&apos;m safe — stop sharing</button></div>
        ) : (
          <><button className="sos-btn" data-act="sosgo" onClick={sosGo}><span>SOS</span><small>Tap to start</small></button><p className="muted small center-t">A 5-second countdown prevents accidental alerts. You can cancel any time.</p></>
        )}
      </div>
      <Sec title="When SOS starts"><UL items={['📍 Shares your current location (with permission)', `💬 Sends your emergency message to ${em.contacts.map(firstName).join(', ') || 'no one yet'}`, '📞 Shows a one-tap call button for 112', '🎙️ Optional audio recording, only if you allow it']} /></Sec>
      <Sec title="Options">
        <ToggleRow path="emergency.record" label="Record 15 seconds of audio" sub="Sent to your emergency contacts with your location. Off by default — needs microphone permission." />
        <ToggleRow path="emergency.call112" label="Show “Call 112” as soon as SOS starts" sub="One tap to reach emergency services" />
      </Sec>
      <Sec title="Emergency contacts">
        {S.contacts.filter((c) => c.isContact && !c.business).map((c) => (
          <label className="set-row" key={c.id}><Avatar o={c} size={36} /><div className="grow"><div className="ci-name">{c.name}</div><div className="ci-sub">@{c.username}</div></div>
            <input type="checkbox" className="switch" data-sosc={c.id} checked={em.contacts.includes(c.id)} onChange={(e) => { em.contacts = e.target.checked ? [...new Set([...em.contacts, c.id])] : em.contacts.filter((x: string) => x !== c.id); commit(); }} /></label>
        ))}
      </Sec>
      <Sec title="Emergency message"><textarea id="sos-msg" className="ta" rows={3} maxLength={300} value={em.message} onChange={(e) => { em.message = e.target.value; commit(); }} /></Sec>
      <div className="chips wrap">{[['112', 'Emergency'], ['100', 'Police'], ['108', 'Ambulance'], ['1091', 'Women helpline']].map(([n, l]) => <a key={n} className="chip" href={`tel:${n}`}>📞 {l} · <b>{n}</b></a>)}</div>
      <Note ic="shield">Location and recording always need your permission and follow privacy law. Nothing is shared until SOS is confirmed.</Note>
    </>
  );
}
