'use client';
/* eslint-disable react-hooks/immutability -- views mutate the shared S/ui store, then commit() (see PORTING.md) */
// WHATSMORE Pay (js/modules.js modPay + flows).
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { S } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { openChat } from '@/lib/actions';
import { act } from '@/lib/registry';
import { money } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Note } from '@/components/ui/Bits';
import { payFlow, amountModal, chatPicker, modalWith, val, fmtStamp } from './shared';

export const BILLERS: [string, string, string, number][] = [['⚡', 'Electricity', 'State Electricity Board', 1240], ['💧', 'Water', 'Municipal Water Board', 380], ['📺', 'DTH', 'DTH Recharge', 449], ['🌐', 'Broadband', 'Fibre Internet', 799], ['🔥', 'Gas cylinder', 'LPG booking', 905], ['🚗', 'FASTag', 'FASTag recharge', 500]];
const findUser = (v: string) => [...S.contacts, ...S.directory].find((x) => x.username === v.trim().toLowerCase().replace(/^@/, ''));

function payScan() {
  modalWith({ title: 'Scan & pay', actions: [{ label: 'Close' }] }, (close) => (
    <>
      <div className="scan-box demo"><div className="scan-frame" /><div className="scan-msg">Point your camera at any UPI / WHATSMORE QR</div></div>
      <p className="muted small">Demo: choose a merchant QR to simulate scanning.</p>
      <div className="chips wrap">{['Sunrise Bakery', 'Glow Salon', 'Metro Kirana Store', 'Auto-rickshaw driver'].map((m) => (
        <button key={m} className="chip" data-merchant={m} onClick={() => { close(); amountModal(`Pay ${m}`, (amt, nt) => payFlow({ to: m, amount: amt, note: nt || 'QR payment' })); }}>{m}</button>
      ))}</div>
    </>
  ));
}

function PayUserBody() {
  const [who, setWho] = useState('');
  const u = who ? findUser(who) : undefined;
  return (
    <>
      <label className="field"><span>Username</span><div className="un-input"><b>@</b><input id="pu-un" placeholder="priya.s" autoCapitalize="off" autoFocus value={who} onChange={(e) => setWho(e.target.value)} /></div><small className={`un-status ${u ? 'ok' : ''}`} id="pu-who">{u ? '✓ ' + u.name + ' · phone number stays private' : ''}</small></label>
      <label className="field"><span>Amount (₹)</span><input id="pu-amt" type="number" min={1} inputMode="decimal" /></label>
      <label className="field"><span>Note</span><input id="pu-note" maxLength={60} /></label>
    </>
  );
}
function payUser() {
  modal({
    title: 'Pay @username', body: <PayUserBody />,
    actions: [{ label: 'Cancel' }, { label: 'Continue', primary: true, onClick: (root) => { const u = findUser(val(root, '#pu-un')); if (!u) { toast('No WHATSMORE user with that username'); return false; } const amount = +val(root, '#pu-amt'), note = val(root, '#pu-note').trim(); setTimeout(() => payFlow({ to: u.name + ' (@' + u.username + ')', amount, note }), 0); } }],
  });
}
function payRequest() { chatPicker('Request money from…', (chats) => { setTimeout(() => { openChat(chats[0].id); act.payModal(chats[0]); }, 0); }, { single: true, label: 'Next' }); }
function paySplit() { const groups = S.chats.filter((c) => c.type === 'group' && !c.left && c.members?.length); const g = groups.find((c) => c.id === 'ch_trip') || groups[0]; if (g) { openChat(g.id); act.payModal(g); } }

function QRBox({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; QRCode.toDataURL(text, { margin: 1, width: 220 }).then((u) => { if (alive.current) setSrc(u); }).catch(() => {}); return () => { alive.current = false; }; }, [text]);
  return <div id="pq" className="qr-box">{src ? <img src={src} alt="QR code" width={220} height={220} /> : null}</div>;
}
function payMyQR() {
  modal({
    title: 'Receive money',
    body: <div className="qr-card"><Avatar o={S.me} size={56} /><div className="pc-name">{S.me.name}</div><div className="accent">{S.me.username}@whatsmore</div><QRBox text={`upi://pay?pa=${S.me.username}@whatsmore&pn=${encodeURIComponent(S.me.name)}`} /><p className="muted small">Anyone can scan to pay you — your phone number stays private.</p></div>,
    actions: [{ label: 'Done', primary: true }],
  });
}
function payRecharge() {
  const plans: [number, string][] = [[199, '1.5 GB/day · 28 days'], [299, '2 GB/day · 28 days'], [719, '2 GB/day · 84 days'], [2999, '2.5 GB/day · 365 days']];
  modal({
    title: 'Mobile recharge',
    body: (
      <>
        <label className="field"><span>Mobile number</span><input id="rc-n" inputMode="tel" maxLength={10} placeholder="98xxxxxx10" autoFocus /></label>
        <label className="field"><span>Operator</span><select id="rc-op"><option>Jio</option><option>Airtel</option><option>Vi</option><option>BSNL</option></select></label>
        <div className="list-label pad0">Popular plans</div>
        {plans.map(([p, d], i) => <label className="radio-row" key={p}><input type="radio" name="rcp" value={p} defaultChecked={i === 1} /> <b>₹{p}</b> <span className="muted small">{d}</span></label>)}
      </>
    ),
    actions: [{ label: 'Cancel' }, { label: 'Recharge', primary: true, onClick: (root) => { const n = val(root, '#rc-n'); if (!/^\d{10}$/.test(n)) { toast('Enter a 10-digit mobile number'); return false; } const amt = +val(root, 'input[name=rcp]:checked'), op = val(root, '#rc-op'); setTimeout(() => payFlow({ to: `${op} recharge · ${n}`, amount: amt, note: 'Mobile recharge' }), 0); } }],
  });
}

function BillBody({ n, s, amt, ctl }: { n: string; s: string; amt: number; ctl: { show?: () => void } }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { ctl.show = () => setOk(true); }, [ctl]);
  return (
    <>
      <label className="field"><span>{n === 'Electricity' || n === 'Water' ? 'Consumer number' : 'Account / ID'}</span><input id="bl-id" placeholder="e.g. 1102938475" autoFocus /></label>
      <div id="bl-out">{ok ? <div className="bill-card"><div className="row-between"><b>{s}</b><span className="pill">Verified biller</span></div><div className="ci-sub">Customer: {S.me.name} · Due in 6 days</div><div className="pay-amount">{money(amt)}</div></div> : null}</div>
    </>
  );
}
export function payBill(i: number) {
  const [e, n, s, amt] = BILLERS[i];
  const ctl: { show?: () => void } = {};
  modal({
    title: `${e} ${n} bill`, body: <BillBody n={n} s={s} amt={amt} ctl={ctl} />,
    actions: [{ label: 'Cancel' }, {
      label: 'Fetch bill', primary: true, onClick: (root) => {
        const id = val(root, '#bl-id').trim();
        if (!id) { toast('Enter your consumer number'); return false; }
        if (!root.querySelector('.bill-card')) { ctl.show?.(); const btn = root.querySelector('[data-mact="1"]'); if (btn) btn.textContent = 'Pay ' + money(amt); return false; }
        setTimeout(() => payFlow({ to: s, amount: amt, note: `${n} bill · ${id}` }), 0);
      },
    }],
  });
}

export function PayView() {
  const hist = S.payments.slice().sort((a, b) => b.t - a.t).slice(0, 8);
  const acts: [string, string, string, () => void][] = [['payscan', 'qr', 'Scan & pay', payScan], ['payuser', 'person', 'Pay @username', payUser], ['payrequest', 'callin', 'Request money', payRequest], ['paysplit', 'groups', 'Split a bill', paySplit], ['payrecharge', 'phone', 'Mobile recharge', payRecharge], ['paymyqr', 'qr', 'Receive (my QR)', payMyQR]];
  return (
    <>
      <div className="wallet-card"><div className="ci-sub">WHATSMORE Pay balance (demo)</div><div className="wallet-amt">{money(S.wallet)}</div><div className="ci-sub">UPI ID {S.me.username}@whatsmore</div></div>
      <div className="act-grid">{acts.map(([a, ic, l, fn]) => <button key={a} className="act" data-act={a} onClick={fn}><span className="act-ic"><Icon name={ic} size={22} /></span>{l}</button>)}</div>
      <Sec title="Pay bills"><div className="biller-grid">{BILLERS.map(([e, n, s], i) => <button key={n} className="biller" data-act="paybill" data-i={i} onClick={() => payBill(i)}><span className="big-emoji">{e}</span><b>{n}</b><span className="ci-sub">{s}</span></button>)}</div></Sec>
      <Sec title="Transaction history">
        {hist.length ? hist.map((p) => (
          <div className="set-row" key={p.id}><span className={`pay-ic ${p.dir}`}><Icon name={p.dir === 'in' ? 'callin' : 'callout'} size={18} /></span><div className="grow"><div className="ci-name">{p.dir === 'in' ? 'Received from' : 'Paid to'} {p.with}</div><div className="ci-sub">{p.note || ''} · {fmtStamp(p.t)}</div></div><b className={p.dir === 'in' ? 'green' : ''}>{p.dir === 'in' ? '+' : '−'}{money(p.amount)}</b></div>
        )) : <p className="muted">No payments yet</p>}
      </Sec>
      <Note>Demo only — no real money moves. A real launch integrates licensed payment partners and follows RBI, NPCI, KYC and AML rules.</Note>
    </>
  );
}
