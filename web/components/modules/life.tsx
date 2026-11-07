'use client';
/* eslint-disable react-hooks/purity, react-hooks/immutability -- views read the clock and mutate the shared S/ui store, then commit() (see PORTING.md) */
// Digital Wellbeing (+ Do Not Disturb, superapp.js §28) and the Command Center admin preview
// (js/modules.js + cloudplus.js admin modules + superapp.js regions / DR / AI monitoring / developer health).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { S, ui, commit } from '@/lib/state';
import { toast } from '@/lib/overlay';
import { MIN, DAY, dayKey, dayLabel } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Sec, Kpi, Note, ToggleRow, SelectRow } from '@/components/ui/Bits';
import { MS, UL } from './shared';
import { dndActive } from './notifs';

// ---------- DIGITAL WELLBEING
export const screenState = () => MS('screen', () => ({ day: dayKey(Date.now()), min: 38 }));
export function screenMinutes() {
  const st = screenState();
  if (st.day !== dayKey(Date.now())) { st.day = dayKey(Date.now()); st.min = 0; }
  if (!ui.sessionStart) ui.sessionStart = Date.now();
  return st.min + Math.floor((Date.now() - ui.sessionStart) / MIN);
}

export function WellbeingView() {
  const w = S.settings.wellbeing, mins = screenMinutes(), pct = Math.min(100, (mins / w.limit) * 100);
  const hours = [12, 25, 8, 31, 18, 22, mins];
  return (
    <>
      <div className="wb-top">
        <div className="wb-ring"><svg viewBox="0 0 36 36" width="120" height="120"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--track)" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${pct} 100`} transform="rotate(-90 18 18)" strokeLinecap="round" /></svg><div><b>{Math.floor(mins / 60)}h {mins % 60}m</b><span>today</span></div></div>
        <div className="grow"><div className="ci-name">Screen time</div><div className="ci-sub">Daily goal {Math.floor(w.limit / 60)}h {w.limit % 60}m · {pct >= 100 ? 'goal reached — time for a break 🌿' : Math.round(100 - pct) + '% left'}</div>
          <div className="bars sm">{hours.map((v, i) => <div className="bar-col" key={i}><div className="bar-v" style={{ height: `${Math.min(100, (v / 40) * 100)}%` }} /><span>{new Date(Date.now() - (6 - i) * DAY).toLocaleDateString([], { weekday: 'narrow' })}</span></div>)}</div></div>
      </div>
      <Sec title="Controls">
        <ToggleRow path="wellbeing.dnd" label="Do Not Disturb" sub={dndActive() ? 'On now · notifications are silenced (they still appear in the notification center)' : 'Silence notifications on a schedule'} />
        {w.dnd ? <SelectRow path="wellbeing.dndPlan" label="DND schedule" opts={[['always', 'Always, until I turn it off'], ['night', 'Every night 10 PM – 7 AM'], ['work', 'Work hours (Mon–Fri 9–6)'], ['weekend', 'Weekends']]} /> : null}
        <ToggleRow path="wellbeing.focus" label="Focus mode" sub="Pause notifications except calls and favourites" />
        <ToggleRow path="wellbeing.quiet" label="Quiet hours" sub={`Silence notifications ${w.quietFrom}–${w.quietTo} every night`} />
        <ToggleRow path="wellbeing.summary" label="Notification summary" sub="Get non-urgent notifications in one digest at 8 PM" />
        <ToggleRow path="wellbeing.reminder" label="Screen-time reminders" sub="Nudge me when I reach my daily goal" />
        <SelectRow path="wellbeing.limit" label="Daily goal" opts={[[60, '1 hour'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours']]} />
        <SelectRow path="theme" label="Night mode" opts={[['light', 'Off'], ['dark', 'On'], ['system', 'Follow system']]} />
      </Sec>
      <Note ic="heart">Family controls let parents set quiet hours and screen-time goals for children’s accounts, with their consent.</Note>
    </>
  );
}
/** settingHooks entry: wellbeing toggles confirm with a toast (as the original change listener did). */
export function wellbeingSettingHook(path: string, v: unknown) {
  if (path.startsWith('wellbeing') && path !== 'wellbeing.limit' && path !== 'wellbeing.dndPlan') toast(v ? 'On' : 'Off');
}

// ---------- ADMIN COMMAND CENTER
const Mon = ({ l, v, t }: { l: string; v: number; t: string }) => <div className="mon"><span>{l}</span><div className="meter"><div style={{ width: `${v}%` }} /></div><b>{t}</b></div>;

export function AdminView() {
  const st = MS('admin', () => ({ reports: [['Spam', '@kyc.update.desk', 'KYC phishing link reported by 214 users'], ['Fraud', '@quick.loans.247', 'Fake loan offer asking for a fee'], ['Impersonation', '@sbi.helpdesk.official', 'Claims to be a bank helpdesk']], verif: [['Spice Route Kitchen', 'Business verified', 'GST + FSSAI uploaded'], ['Hyderabad Metro Updates', 'Official', 'Authorisation letter uploaded'], ['TechGuru Kiran', 'Creator verified', 'ID + 96K followers']] } as any));
  st.reports ||= []; st.verif ||= [];
  const st2 = MS('admin2', () => ({ users: [['Kiran Tech', '@techguru_kiran', 'Creator', 'Active'], ['Quick Loans 247', '@quick.loans.247', 'Business', 'Under review'], ['Meera Designs', '@meera.designs', 'Personal', 'Active'], ['SBI Helpdesk (fake)', '@sbi.helpdesk.official', 'Personal', 'Suspended']], keys: [['Payments partner API', 'live', '1,200 req/min'], ['Government services gateway', 'live', '300 req/min'], ['AI gateway', 'live', '5,000 req/min'], ['Marketplace partners', 'paused', '600 req/min']] } as any));
  const dr = MS('dr', () => ({ drill: Date.now() - 12 * DAY } as any));
  if (!ui.adm) ui.adm = { users: 1250430, active: 685240, msgs: 18450230, calls: 520340 };
  const k = ui.adm;
  const [, setTick] = useState(0);
  const [held, setHeld] = useState<number[]>([]);
  // MOD_AFTER.admin: live counters
  useEffect(() => {
    const t = setInterval(() => {
      const a = ui.adm;
      a.users += Math.floor(Math.random() * 6); a.active += Math.floor(Math.random() * 20); a.msgs += 180 + Math.floor(Math.random() * 400); a.calls += Math.floor(Math.random() * 12);
      setTick((x) => x + 1);
    }, 1200);
    return () => clearInterval(t);
  }, []);
  const n = (v: number) => v.toLocaleString('en-IN');
  const adRep = (i: number, r: string) => { const [, who] = st.reports.splice(i, 1)[0]; commit(); toast(r === 'ban' ? `${who} banned · reporters notified` : 'Report dismissed'); };
  const adVer = (i: number, r: string) => { const [nm, bd] = st.verif.splice(i, 1)[0]; commit(); toast(r === 'ok' ? `${nm} is now ${bd}` : `${nm} request rejected`); };
  const tx = [['UPI · ₹24,999', '@new.seller.88 → 14 buyers in 10 min', 'High risk'], ['UPI · ₹1,500', '@priya.s → @gotrip', 'Normal'], ['Merchant · ₹86,000', 'Unverified business, first day', 'Review']];
  const regions = [['🇮🇳', 'India (Mumbai + Hyderabad)', 'Primary · data stays in India', '18 ms', 'ok'], ['🌏', 'Asia (Singapore)', 'Active', '41 ms', 'ok'], ['🇪🇺', 'Europe (Frankfurt)', 'Active · GDPR residency', '96 ms', 'ok'], ['🇺🇸', 'North America (Virginia)', 'Standby', '182 ms', 'warn']];
  const drill = () => {
    toast('Failover drill started · switching India → Asia (simulated)…', null, { ms: 2200 });
    setTimeout(() => { const d = MS('dr', () => ({} as any)); d.drill = Date.now(); d.secs = 380 + Math.floor(Math.random() * 90); commit(); toast(`✅ Drill complete in ${d.secs} s · within the 30-minute RTO, zero data loss`); }, 2400);
  };
  return (
    <>
      <a className="cc-link" href="/admin" target="_blank" rel="noopener"><Icon name="dashboard" size={20} /><span className="grow"><b>Open the real Command Center</b><span>Live users, reports, verification and announcements · admins only</span></span><Icon name="chevright" size={18} /></a>
      <div className="kpi-grid">
        <Kpi label="Total users" value={n(k.users)} delta="+2.1%" id="ad-u" /><Kpi label="Active today" value={n(k.active)} delta="+4.3%" id="ad-a" /><Kpi label="Messages today" value={n(k.msgs)} id="ad-m" /><Kpi label="Calls today" value={n(k.calls)} id="ad-c" />
        <Kpi label="Businesses" value="42,560" delta="+380" /><Kpi label="Creators" value="8,920" delta="+64" /><Kpi label="Payments today" value="₹14.6 Cr" delta="+6%" /><Kpi label="System health" value="99.99%" />
      </div>
      <Sec title="System monitoring">
        {([['API latency (p95)', 82, '82 ms'], ['Message delivery', 99.98, '99.98%'], ['Call quality (MOS 4.4)', 88, 'Good'], ['AI latency', 64, '640 ms'], ['Payment success', 99.2, '99.2%'], ['Storage used', 47, '4.7 PB of 10 PB']] as [string, number, string][]).map(([l, v, t]) => <Mon key={l} l={l} v={v} t={t} />)}
      </Sec>
      <Sec title={`Reports queue (${st.reports.length})`}>
        {st.reports.length ? st.reports.map(([c, who, d]: string[], i: number) => (
          <div className="set-row" key={i + who}><span className="pill third">{c}</span><div className="grow"><div className="ci-name">{who}</div><div className="ci-sub">{d}</div></div><button className="btn sm danger" data-act="adrep" data-i={i} data-r="ban" onClick={() => adRep(i, 'ban')}>Ban</button><button className="btn sm" data-act="adrep" data-i={i} data-r="dismiss" onClick={() => adRep(i, 'dismiss')}>Dismiss</button></div>
        )) : <p className="muted">Queue is clear 🎉</p>}
      </Sec>
      <Sec title={`Verification requests (${st.verif.length})`}>
        {st.verif.length ? st.verif.map(([nm, bd, d]: string[], i: number) => (
          <div className="set-row" key={i + nm}><div className="grow"><div className="ci-name">{nm}</div><div className="ci-sub">{bd} · {d}</div></div><button className="btn sm primary" data-act="adver" data-i={i} data-r="ok" onClick={() => adVer(i, 'ok')}>Approve</button><button className="btn sm" data-act="adver" data-i={i} data-r="no" onClick={() => adVer(i, 'no')}>Reject</button></div>
        )) : <p className="muted">No pending requests</p>}
      </Sec>
      <Sec title="Security alerts (38)"><UL items={['⚠️ 12 accounts with unusual login locations — step-up verification sent', '🛡️ Rate limit triggered for 3 bot networks (blocked)', '🔐 2 payment-fraud patterns flagged for review']} /></Sec>
      <Note ic="shield">Production runs this as a separate, access-controlled web admin panel with audit logs for every action.</Note>
      {/* cloudplus.js: more admin modules */}
      <Sec title="User management">
        {st2.users.map((u: string[], i: number) => (
          <div className="set-row" key={u[1]}><div className="grow"><div className="ci-name">{u[0]} <span className="ci-sub">{u[1]}</span></div><div className="ci-sub">{u[2]} account</div></div><span className={`pill ${u[3] === 'Active' ? '' : 'third'}`}>{u[3]}</span>
            <button className="btn sm" data-act="aduser" data-i={i} onClick={() => { u[3] = u[3] === 'Suspended' ? 'Active' : 'Suspended'; commit(); toast(`${u[1]} ${u[3] === 'Suspended' ? 'suspended' : 'restored'} · logged in the audit trail`); }}>{u[3] === 'Suspended' ? 'Restore' : 'Suspend'}</button></div>
        ))}
      </Sec>
      <Sec title="Payment monitoring">
        {tx.map(([a, d, r], i) => (
          <div className="set-row" key={a}><div className="grow"><div className="ci-name">{a}</div><div className="ci-sub">{d}</div></div><span className={`pill ${r === 'Normal' ? '' : 'third'}`}>{r}</span>
            {r === 'Normal' ? null : <button className="btn sm danger" data-act="adhold" disabled={held.includes(i)} onClick={() => { setHeld([...held, i]); toast('Payment held for manual review'); }}>{held.includes(i) ? 'On hold' : 'Hold'}</button>}</div>
        ))}
      </Sec>
      <Sec title="Subscriptions"><div className="kpi-grid"><Kpi label="Premium" value="84,210" delta="+3.2%" /><Kpi label="Business" value="42,560" delta="+380" /><Kpi label="Enterprise" value="312" delta="+4" /><Kpi label="MRR" value="₹2.9 Cr" delta="+5.1%" /></div></Sec>
      <Sec title="API management">
        {st2.keys.map((key: string[], i: number) => (
          <label className="set-row" key={key[0]}><div className="grow"><div className="ci-name">{key[0]}</div><div className="ci-sub">Rate limit {key[2]} · keys rotated every 90 days</div></div>
            <input type="checkbox" className="switch" data-apikey={i} checked={key[1] === 'live'} onChange={(e) => { key[1] = e.target.checked ? 'live' : 'paused'; commit(); toast(`${key[0]} ${key[1]}`); }} /></label>
        ))}
      </Sec>
      {/* superapp.js §36–40 */}
      <Sec title="Global regions">
        {regions.map(([f, nm, s, l, ok]) => <div className="set-row" key={nm}><span className="big-emoji">{f}</span><div className="grow"><div className="ci-name">{nm}</div><div className="ci-sub">{s} · p95 {l}</div></div><span className={`pill ${ok === 'ok' ? 'ok' : 'third'}`}>{ok === 'ok' ? 'Healthy' : 'Standby'}</span></div>)}
      </Sec>
      <Sec title="Disaster recovery">
        <div className="kpi-grid"><Kpi label="RPO target" value="≤ 5 min" /><Kpi label="RTO target" value="≤ 30 min" /><Kpi label="Replication lag" value="1.2 s" /><Kpi label="Last backup" value="14 min ago" /></div>
        <div className="set-row"><div className="grow"><div className="ci-name">Last failover drill</div><div className="ci-sub">{dayLabel(dr.drill)} · India → Asia in {dr.secs || 412} s · no data loss</div></div><button className="btn sm" data-act="drdrill" onClick={drill}>Run drill</button></div>
      </Sec>
      <Sec title="AI monitoring">
        <div className="kpi-grid"><Kpi label="AI requests today" value="4.2M" delta="+8%" /><Kpi label="p95 latency" value="640 ms" delta="-40 ms" /><Kpi label="Safety flags" value="312" /><Kpi label="Cost / 1K req" value="₹3.10" delta="-6%" /></div>
        {([['AI gateway · Model A (general)', 62], ['Model B (translation)', 27], ['On-device model', 11]] as [string, number][]).map(([l, v]) => <Mon key={l} l={l} v={v} t={`${v}%`} />)}
        <div className="ci-sub">The AI gateway routes each task to the best model, so a provider can be swapped without rebuilding the app.</div>
      </Sec>
      <Sec title="Developer health">
        {([['Crash-free sessions', 99.7, '99.7%'], ['Database health', 96, 'Healthy · 38% CPU'], ['Payment failures', 8, '0.8%'], ['Push delivery', 99, '99.1%']] as [string, number, string][]).map(([l, v, t]) => <Mon key={l} l={l} v={v} t={t} />)}
      </Sec>
    </>
  );
}
