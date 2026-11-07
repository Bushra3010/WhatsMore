'use client';
/* eslint-disable react-hooks/purity, react-hooks/immutability -- views read the clock and mutate the shared S/ui store, then commit() (see PORTING.md) */
// Business dashboard (js/modules.js modBusiness).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { S, commit } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { switchProfile } from '@/lib/profiles';
import { MIN, HOUR, DAY, money, listTime, escRe } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Kpi, Note } from '@/components/ui/Bits';
import { MS, val, fmtStamp } from './shared';

const ORDER_STEPS = ['New', 'Preparing', 'Ready', 'Delivered'];
const seedBiz = () => ({
  aiOn: true,
  orders: [
    { id: 'ORD-2301', who: 'Priya Sharma', items: '2 × Logo design package', total: 4998, step: 0, t: Date.now() - 30 * MIN },
    { id: 'ORD-2300', who: 'Kiran Tech', items: '1 × App UI kit', total: 2499, step: 1, t: Date.now() - 2 * HOUR },
    { id: 'ORD-2298', who: 'Meera Designs', items: '1 × Brand guidelines', total: 7999, step: 2, t: Date.now() - 5 * HOUR },
    { id: 'ORD-2295', who: 'Rahul Verma', items: '3 × Social media posts', total: 1497, step: 3, t: Date.now() - DAY },
  ],
  appts: [['10:30 AM', 'Ananya Rao', 'Design consultation · 30 min'], ['2:00 PM', 'Fatima Sheikh', 'Website review · 45 min'], ['5:15 PM', 'Arjun Mehta', 'Logo revision call · 20 min']],
  faqs: [['hours|open|timing|time', 'We are open Monday–Saturday, 10 AM – 7 PM.'], ['price|cost|rate|charge', 'Logo design starts at ₹2,499 and brand kits at ₹7,999.'], ['deliver|days|how long|time take', 'Most projects are delivered in 5–7 working days.'], ['appointment|book|meet|call', 'You can book a free 30-minute consultation — reply with a time that suits you.']] as [string, string][],
});
const biz = () => MS('biz', seedBiz);

function bizStep(o: any) { if (o.step < 3) { o.step++; commit(); toast(`${o.id} → ${ORDER_STEPS[o.step]} · customer notified on WHATSMORE`); } }
function bizInv(o: any) {
  modal({
    title: 'Invoice ' + o.id,
    body: <div className="invoice"><div className="inv-head"><Icon name="receipt" size={18} /> {S.me.name} Designs<span className="paid-stamp">PAID</span></div><div className="inv-row"><span>{o.items}</span><span>{money(o.total)}</span></div><div className="inv-row"><span>GST (18%, included)</span><span>{money(Math.round(o.total * 0.18 / 1.18))}</span></div><div className="inv-row total"><span>Total</span><span>{money(o.total)}</span></div><div className="ci-sub">Billed to {o.who} · {fmtStamp(o.t)}</div></div>,
    actions: [{ label: 'Send to customer', onClick: () => toast('Invoice sent to ' + o.who) }, { label: 'Done', primary: true }],
  });
}
function bizFaqAdd() {
  modal({
    title: 'Add AI answer',
    body: <><label className="field"><span>When customers ask about (keywords)</span><input id="fq-k" placeholder="e.g. refund, return" autoFocus /></label><label className="field"><span>AI answers</span><textarea id="fq-a" rows={3} /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const k = val(root, '#fq-k').trim().split(/\s*,\s*/).filter(Boolean).map(escRe).join('|'), a = val(root, '#fq-a').trim(); if (!k || !a) return false; biz().faqs.push([k, a]); commit(); } }],
  });
}

export function BusinessView() {
  const b = biz();
  const [q, setQ] = useState('');
  const [ans, setAns] = useState<string | null>(null);
  const rev = [6200, 8100, 5400, 9800, 7300, 11200, 8450], max = Math.max(...rev);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * DAY).toLocaleDateString([], { weekday: 'short' }));
  const test = () => { const s = q.toLowerCase(); const hit = b.faqs.find(([k]) => new RegExp(k).test(s)); setAns(hit ? hit[1] : "Thanks for your message! I'll connect you with the owner shortly."); };
  return (
    <>
      <div className="biz-head"><Avatar o={{ name: S.me.name + ' Designs', color: '#f4511e', emoji: '🎨' }} size={56} /><div className="grow"><div className="ci-name">{S.me.name} Designs <Icon name="verified" size={16} cls="accent" /></div><div className="ci-sub">Design studio · Hyderabad · Mon–Sat 10 AM – 7 PM · WHATSMORE Pay, UPI</div></div><button className="btn sm" data-act="setprofile" data-p="business" onClick={() => switchProfile('business')}>Use business profile</button></div>
      <div className="kpi-grid"><Kpi label="Today's revenue" value={money(8450)} delta="+18%" /><Kpi label="Orders" value="14" delta="+4" /><Kpi label="New customers" value="6" delta="+2" /><Kpi label="AI answered" value="11 / 13" delta="85%" /></div>
      <Sec title="Revenue · last 7 days"><div className="bars">{rev.map((v, i) => <div className="bar-col" key={i}><div className="bar-v" style={{ height: `${(v / max) * 100}%` }} title={money(v)} /><span>{days[i]}</span></div>)}</div></Sec>
      <Sec title="Orders">
        {b.orders.map((o: any) => (
          <div className="set-row" key={o.id}><div className="grow"><div className="ci-name">{o.id} · {o.who}</div><div className="ci-sub">{o.items} · {money(o.total)} · {listTime(o.t)}</div></div><span className={`pill step-${o.step}`}>{ORDER_STEPS[o.step]}</span>
            {o.step < 3 ? <button className="btn sm" data-act="bizstep" data-o={o.id} onClick={() => bizStep(o)}>→ {ORDER_STEPS[o.step + 1]}</button> : <button className="btn sm" data-act="bizinv" data-o={o.id} onClick={() => bizInv(o)}>Invoice</button>}</div>
        ))}
      </Sec>
      <Sec title="Appointments today">
        {b.appts.map(([t, w, d]: string[]) => <div className="set-row" key={t}><span className="time-chip">{t}</span><div className="grow"><div className="ci-name">{w}</div><div className="ci-sub">{d}</div></div><span className="pill">Confirmed</span></div>)}
      </Sec>
      <Sec title="AI customer assistant">
        <label className="set-row"><div><div className="ci-name">Auto-reply with AI</div><div className="ci-sub">Answers hours, prices, delivery and bookings 24×7</div></div><input type="checkbox" className="switch" id="biz-ai" checked={!!b.aiOn} onChange={(e) => { b.aiOn = e.target.checked; commit(); toast(e.target.checked ? 'AI assistant on' : 'AI assistant off'); }} /></label>
        {b.faqs.map(([k, a]: [string, string], i: number) => <div className="faq" key={i}><span className="pill">{k.split('|')[0]}</span><span className="grow small">{a}</span><button className="icon-btn sm" data-act="bizfaqdel" data-i={i} aria-label="Remove" onClick={() => { b.faqs.splice(i, 1); commit(); }}><Icon name="close" size={16} /></button></div>)}
        <button className="link-btn" data-act="bizfaqadd" onClick={bizFaqAdd}>+ Add answer</button>
        <div className="ai-test"><input id="biz-q" placeholder="Test it: “How much is a logo?”" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') test(); }} /><button className="btn sm primary" data-act="biztest" onClick={test}>Ask</button></div>
        <div id="biz-a">{ans != null ? <div className="bubble-demo"><Icon name="sparkle" size={14} /> {ans}</div> : null}</div>
      </Sec>
      <Note ic="store">Customer journey: Product → Chat → Enquiry → Order → Payment → Invoice, all inside WHATSMORE. Try it with Sunrise Bakery or any Marketplace seller.</Note>
    </>
  );
}
