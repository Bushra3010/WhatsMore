'use client';
/* eslint-disable react-hooks/purity, react-hooks/immutability -- views read the clock and mutate the shared S/ui store, then commit() (see PORTING.md) */
// Marketplace: sellers are business accounts with an AI assistant (js/modules.js), digital products and
// professional services (js/cloudplus.js) and the seller dashboard (js/superapp.js §18).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { BAKERY } from '@/lib/seed';
import { S, ui, commit, refresh } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { startDM } from '@/lib/actions';
import { uid, money, contact, directChatFor, DAY } from '@/lib/util';
import type { Chat, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Kpi, Note } from '@/components/ui/Bits';
import { MS, payFlow, gochat, val } from './shared';

interface Product { id: string; name: string; price: number; emoji: string; bg: string; desc: string; sizes?: string; stock: boolean; rating?: number }
interface Seller { name: string; username: string; emoji: string; color: string; cat: string; about: string; category: string; hours: string; address: string; products: Product[] }
export const SELLERS: Record<string, Seller> = {
  c_blue: { name: 'Blue Threads Fashion', username: 'bluethreads', emoji: '👕', color: '#1565c0', cat: 'shopping', about: 'Shirts, kurtas & more', category: 'Clothing store', hours: 'Daily · 10:00 AM – 9:30 PM', address: 'Shop 4, Inorbit Mall, Hyderabad',
    products: [{ id: 'bt1', name: 'Blue Oxford Shirt', price: 1299, emoji: '👕', bg: 'linear-gradient(135deg,#4facfe,#00f2fe)', desc: '100% cotton · sizes M, L, XL', sizes: 'M, L and XL', stock: true, rating: 4.6 }, { id: 'bt2', name: 'Cotton Kurta', price: 899, emoji: '🥻', bg: 'linear-gradient(135deg,#f6d365,#fda085)', desc: 'Handloom cotton · all sizes', sizes: 'S to XXL', stock: true, rating: 4.4 }, { id: 'bt3', name: 'Denim Jacket', price: 2499, emoji: '🧥', bg: 'linear-gradient(135deg,#667eea,#764ba2)', desc: 'Classic fit', sizes: 'M and L', stock: true, rating: 4.7 }] },
  c_spice: { name: 'Spice Route Kitchen', username: 'spiceroute', emoji: '🍛', color: '#e65100', cat: 'food', about: 'Hyderabadi kitchen', category: 'Restaurant', hours: 'Daily · 11:00 AM – 11:00 PM', address: 'Road No. 36, Jubilee Hills, Hyderabad',
    products: [{ id: 'sr1', name: 'Hyderabadi Chicken Biryani', price: 349, emoji: '🍛', bg: 'linear-gradient(135deg,#f093fb,#f5576c)', desc: 'Serves 1 · 35 min delivery', stock: true, rating: 4.8 }, { id: 'sr2', name: 'Paneer Butter Masala', price: 279, emoji: '🧈', bg: 'linear-gradient(135deg,#fccb90,#d57eeb)', desc: 'With 2 butter naan', stock: true, rating: 4.5 }, { id: 'sr3', name: 'Masala Dosa', price: 129, emoji: '🥞', bg: 'linear-gradient(135deg,#f6d365,#fda085)', desc: 'With chutney & sambar', stock: true, rating: 4.6 }] },
  c_gotrip: { name: 'GoTrip Travels', username: 'gotrip', emoji: '✈️', color: '#0277bd', cat: 'travel', about: 'Holidays & bus tickets', category: 'Travel agency', hours: 'Mon–Sat · 9:00 AM – 8:00 PM', address: 'Ameerpet, Hyderabad',
    products: [{ id: 'gt1', name: 'Goa Weekend Package', price: 8999, emoji: '🏖️', bg: 'linear-gradient(135deg,#4facfe,#f6d365)', desc: '2N/3D · hotel + breakfast', stock: true, rating: 4.5 }, { id: 'gt2', name: 'Hyderabad → Bengaluru Sleeper Bus', price: 1199, emoji: '🚌', bg: 'linear-gradient(135deg,#43e97b,#38f9d7)', desc: 'Tonight 9:30 PM', stock: true, rating: 4.2 }] },
  c_cine: { name: 'CineMax Tickets', username: 'cinemax', emoji: '🎬', color: '#ad1457', cat: 'tickets', about: 'Movies & events', category: 'Tickets', hours: 'Daily · 9:00 AM – 1:00 AM', address: 'Banjara Hills, Hyderabad',
    products: [{ id: 'cm1', name: 'Movie Ticket · Recliner', price: 350, emoji: '🎟️', bg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', desc: 'Tonight 7:15 PM show', stock: true, rating: 4.3 }, { id: 'cm2', name: 'Live Concert Pass', price: 1499, emoji: '🎤', bg: 'linear-gradient(135deg,#f093fb,#f5576c)', desc: 'Saturday · Gachibowli Stadium', stock: true, rating: 4.9 }] },
  c_fix: { name: 'QuickFix Home Services', username: 'quickfix', emoji: '🔧', color: '#2e7d32', cat: 'home', about: 'Verified technicians', category: 'Home services', hours: 'Daily · 8:00 AM – 8:00 PM', address: 'Serving all of Hyderabad',
    products: [{ id: 'qf1', name: 'AC Service', price: 599, emoji: '❄️', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)', desc: 'Jet wash · 60 min', stock: true, rating: 4.6 }, { id: 'qf2', name: 'Plumber Visit', price: 299, emoji: '🚰', bg: 'linear-gradient(135deg,#89f7fe,#66a6ff)', desc: 'Within 2 hours', stock: true, rating: 4.4 }, { id: 'qf3', name: 'Full Home Deep Cleaning', price: 2499, emoji: '🧹', bg: 'linear-gradient(135deg,#fddb92,#d1fdff)', desc: '2BHK · 4 hours', stock: true, rating: 4.7 }] },
  c_salon: { name: 'Glow Salon', username: 'glowsalon', emoji: '💇', color: '#c2185b', cat: 'services', about: 'Hair · skin · bridal', category: 'Salon', hours: 'Tue–Sun · 10:00 AM – 8:00 PM', address: 'Kondapur, Hyderabad',
    products: [{ id: 'gs1', name: 'Haircut & Styling', price: 399, emoji: '💇', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', desc: '45 min appointment', stock: true, rating: 4.5 }, { id: 'gs2', name: 'Facial', price: 999, emoji: '🧖', bg: 'linear-gradient(135deg,#ffecd2,#fcb69f)', desc: '60 min appointment', stock: true, rating: 4.6 }] },
  // cloudplus.js §5: digital products and professional services
  c_digi: { name: 'SkillUp Digital', username: 'skillup', emoji: '💾', color: '#3949ab', cat: 'digital', about: 'Courses, e-books & templates', category: 'Digital products', hours: 'Instant delivery · 24×7', address: 'Online',
    products: [{ id: 'dg1', name: 'Python in Telugu — video course', price: 499, emoji: '🎓', bg: 'linear-gradient(135deg,#667eea,#764ba2)', desc: '40 lessons · lifetime access', stock: true, rating: 4.8 }, { id: 'dg2', name: 'Resume template pack', price: 149, emoji: '📄', bg: 'linear-gradient(135deg,#89f7fe,#66a6ff)', desc: '12 editable templates', stock: true, rating: 4.5 }, { id: 'dg3', name: 'UPSC notes e-book', price: 299, emoji: '📚', bg: 'linear-gradient(135deg,#fddb92,#d1fdff)', desc: 'PDF · 320 pages', stock: true, rating: 4.6 }] },
  c_pro: { name: 'TaxEasy Advisors', username: 'taxeasy', emoji: '👔', color: '#455a64', cat: 'pro', about: 'CA, legal & business filings', category: 'Professional services', hours: 'Mon–Sat · 9:30 AM – 6:30 PM', address: 'Somajiguda, Hyderabad',
    products: [{ id: 'pr1', name: 'Income tax return filing', price: 999, emoji: '🧾', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)', desc: 'By a chartered accountant', stock: true, rating: 4.7 }, { id: 'pr2', name: 'GST registration', price: 1999, emoji: '🏢', bg: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', desc: '3–5 working days', stock: true, rating: 4.5 }, { id: 'pr3', name: '30-min legal consultation', price: 799, emoji: '⚖️', bg: 'linear-gradient(135deg,#d4fc79,#96e6a1)', desc: 'Video call with a lawyer', stock: true, rating: 4.6 }] },
};
const MARKET_CATS: [string, string][] = [['all', 'All'], ['shopping', '🛍️ Shopping'], ['food', '🍛 Food'], ['travel', '✈️ Travel'], ['tickets', '🎟️ Tickets'], ['home', '🔧 Home services'], ['services', '💇 Services'], ['local', '🏪 Local shops'], ['digital', '💾 Digital'], ['pro', '👔 Professional']];

function ensureSeller(id: string) {
  const sdef = SELLERS[id];
  // Sunrise Bakery (Local shops) is defined with the seed; its chat starts when you first open the shop
  if (id === BAKERY.id && !contact(id)) S.contacts.push({ ...BAKERY, isContact: false } as any);
  if (!sdef) return contact(id);
  if (!S.catalog[id]) S.catalog[id] = sdef.products.map((p) => ({ ...p }));
  let c = contact(id);
  if (!c) { c = { id, name: sdef.name, username: sdef.username, about: sdef.about, color: sdef.color, emoji: sdef.emoji, isContact: false, online: true, business: { category: sdef.category, address: sdef.address, hours: sdef.hours, website: sdef.username + '.example', payments: 'WHATSMORE Pay · UPI', verified: true } }; S.contacts.push(c); }
  return c;
}
export function sellerChat(id: string): Chat {
  const c = ensureSeller(id)!;
  let ch = directChatFor(id);
  if (!ch) {
    ch = { id: 'ch_' + uid(), type: 'direct', contactId: id, unread: 0, messages: [
      { id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' },
      { id: uid(), from: id, type: 'text', text: `Welcome to ${c.name} ${c.emoji} I'm the AI assistant — ask about products, prices, availability, timings or orders.`, t: Date.now() + 1, status: 'read', reactions: {}, bot: true },
    ] };
    S.chats.push(ch);
  }
  commit();
  return ch;
}
// Business AI for marketplace sellers: availability → price → "book one L size" → order + payment request
export function sellerReply(ch: Chat, c: any, trig: Message): any {
  if (trig.type !== 'text') return null;
  const prods: any[] = S.catalog[c.id] || [], t = (trig.text || '').toLowerCase();
  let p = prods.find((x) => x.name.toLowerCase().split(/[\s&·]+/).some((w: string) => w.length > 3 && t.includes(w)));
  if (p) ch.aiProd = p.id; else p = prods.find((x) => x.id === ch.aiProd);
  const size = (t.match(/\b(xs|s|m|l|xl|xxl)\b(?=\s*size|\s*$|\s)/i) || [])[1];
  if (/\b(book|order|buy|want|reserve)\b/.test(t) && p) {
    const oid = 'WM-' + (1000 + Math.floor(Math.random() * 9000));
    const nm = p.name + (size ? ` (${size.toUpperCase()})` : '');
    return [{ text: `Your order request has been created 🧾\n${p.emoji} *${nm}* · ${money(p.price)}\nOrder ${oid} — please complete the payment below 👇`, bot: true }, { type: 'payment', kind: 'request', amount: p.price, note: `Order ${oid} · ${nm}`, orderId: oid, items: [{ name: nm, qty: 1, price: p.price }], status: 'pending', paidBy: [], bot: true }];
  }
  if (/price|cost|how much|rate|kitna|ఎంత/.test(t) && p) return { text: `${p.emoji} ${p.name}: ${money(p.price)}.`, bot: true };
  if (/available|in stock|have|unda|hai kya|\?$/.test(t) && p && !/time|open/.test(t)) return { text: p.stock ? `Yes ✅ ${p.name} is available.${p.sizes ? ` Sizes ${p.sizes} are currently available.` : ''}` : `Sorry, ${p.name} is sold out right now.`, bot: true };
  if (/open|close|hour|timing|time|when/.test(t)) return { text: `🕘 ${c.business.hours}`, bot: true };
  if (/where|address|location/.test(t)) return { text: `📍 ${c.business.address}`, bot: true };
  if (/appointment|slot|book/.test(t)) return { text: 'Tomorrow 11:00 AM and 4:30 PM are free. Reply with a time to book 📅', bot: true };
  if (/^(hi|hey|hello|namaste)/.test(t)) return { text: `Hello! 👋 Welcome to ${c.name}. Ask me about products, prices or availability.`, bot: true };
  if (/price|menu|catalog|list|products|what do you/.test(t)) return { text: 'Here is what we have today:\n' + prods.map((x) => `${x.emoji} ${x.name} — ${money(x.price)}`).join('\n'), bot: true };
  if (p) return { text: `${p.emoji} ${p.name} — ${p.desc}. ${money(p.price)}. Say “book one” to order.`, bot: true };
  return { text: "Thanks! I'll pass this to the team. Meanwhile ask me about products, prices, availability or timings 🙂", bot: true };
}
/** bizBots entry (registered in index.tsx). */
export function sellerBot(ch: Chat, trig: Message) {
  const c = contact(ch.contactId);
  if (c && SELLERS[c.id]) { const r = sellerReply(ch, c, trig); if (r) return r; }
  return undefined;
}

function allListings() {
  const out: { p: any; seller: string; sname: string; cat: string }[] = [];
  Object.entries(SELLERS).forEach(([id, s]) => s.products.forEach((p) => out.push({ p, seller: id, sname: s.name, cat: s.cat })));
  (S.catalog.c_bakery || []).forEach((p: any) => out.push({ p, seller: 'c_bakery', sname: 'Sunrise Bakery', cat: 'local' }));
  return out;
}
const mkState = () => MS('market', () => ({ cat: 'all', orders: [] as any[] } as any));

function mkChat(seller: string) { const ch = sellerChat(seller); gochat(ch.id); }
function mkBuy(pid: string) {
  const x = allListings().find((l) => l.p.id === pid);
  if (!x) return;
  payFlow({ to: x.sname, amount: x.p.price, note: x.p.name, onDone: () => {
    const st = mkState();
    st.orders.push({ id: 'OD' + Math.floor(1e5 + Math.random() * 9e5), name: x.p.name, emoji: x.p.emoji, bg: x.p.bg, price: x.p.price, sname: x.sname, t: Date.now() });
    commit();
    toast('🧾 Order placed · invoice sent to your chat with ' + x.sname);
    const ch = sellerChat(x.seller);
    if (ch) { ch.messages.push({ id: uid(), from: ch.contactId!, type: 'invoice', orderId: 'OD' + Math.floor(Math.random() * 1e5), items: [{ name: x.p.name, qty: 1, price: x.p.price }], total: x.p.price, t: Date.now(), status: 'read', reactions: {}, bot: true }); ch.unread = (ch.unread || 0) + 1; commit(); }
  } });
}

const TRACK = ['Ordered', 'Packed', 'On the way', 'Delivered'];
function OrderRow({ o }: { o: any }) {
  const step = Math.min(3, Math.floor((Date.now() - o.t) / 20000));
  return (
    <div className="order-row"><div className="prod-art" style={{ background: o.bg }}>{o.emoji}</div><div className="grow"><div className="ci-name small2">{o.name}</div><div className="ci-sub">{o.sname} · {money(o.price)} · {o.id}</div>
      <div className="track">{TRACK.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}>{s}</span>)}</div>
      {step === 3 ? (o.rating ? <div className="ci-sub">Your review: {'⭐'.repeat(o.rating)}</div> : (
        <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} data-act="mkrate" data-o={o.id} data-r={n} aria-label={`${n} stars`} onClick={() => { o.rating = n; commit(); toast('Thanks for your review!'); }}>☆</button>)} <span className="ci-sub">Rate your order</span></div>
      )) : null}</div></div>
  );
}

function Shop() {
  const st = mkState();
  const q = (ui.mq || '').toLowerCase();
  const list = allListings().filter((x) => (st.cat === 'all' || x.cat === st.cat || (st.cat === 'food' && x.seller === 'c_bakery')) && (!q || (x.p.name + ' ' + x.sname).toLowerCase().includes(q)));
  return (
    <>
      <div className="search"><Icon name="search" size={18} /><input id="mk-q" placeholder="Search products, food, tickets, services…" value={ui.mq || ''} autoComplete="off" onChange={(e) => { ui.mq = e.target.value; refresh(); }} /></div>
      <div className="chips wrap mt">{MARKET_CATS.map(([k, l]) => <button key={k} className={`chip ${st.cat === k ? 'on' : ''}`} data-act="mkcat" data-c={k} onClick={() => { st.cat = k; commit(); }}>{l}</button>)}</div>
      {st.orders.length ? <Sec title="My orders">{st.orders.slice().reverse().map((o: any) => <OrderRow key={o.id} o={o} />)}</Sec> : null}
      <div className="prod-grid">
        {list.length ? list.map(({ p, seller, sname }) => (
          <div className="prod" key={p.id}><div className="prod-art big" style={{ background: p.bg }}>{p.emoji}</div><div className="ci-name small2">{p.name}</div><div className="ci-sub">{sname} <Icon name="verified" size={12} cls="accent" />{p.rating ? ` · ⭐ ${p.rating}` : ''}</div><div className="row-between"><b>{money(p.price)}</b>{p.stock ? null : <span className="pill">Sold out</span>}</div>
            <div className="prod-acts"><button className="btn sm" data-act="mkchat" data-s={seller} onClick={() => mkChat(seller)}><Icon name="chat" size={14} /> Chat</button>{p.stock ? <button className="btn sm primary" data-act="mkbuy" data-s={seller} data-p={p.id} onClick={() => mkBuy(p.id)}>Buy</button> : null}</div></div>
        )) : <p className="muted">Nothing found</p>}
      </div>
      <Note ic="cart">Search → Discover → Chat with seller → Order → Pay → Delivery → Review. Every seller is a verified business account with an AI assistant.</Note>
    </>
  );
}

// ---------- seller dashboard (superapp.js §18)
const seedSeller = () => ({
  products: [
    { id: 'sp1', name: 'Blue cotton shirt', emoji: '👕', price: 1299, stock: 14 }, { id: 'sp2', name: 'Denim jeans', emoji: '👖', price: 1899, stock: 3 },
    { id: 'sp3', name: 'Silk saree', emoji: '🥻', price: 4599, stock: 6 }, { id: 'sp4', name: 'Leather wallet', emoji: '👛', price: 699, stock: 0 },
  ],
  orders: [
    { id: 'SO-2041', who: 'Priya Sharma', item: 'Blue cotton shirt · L', amt: 1299, status: 'New' }, { id: 'SO-2040', who: 'Ananya Rao', item: 'Silk saree', amt: 4599, status: 'Packed' },
    { id: 'SO-2038', who: 'Ramesh Kumar', item: 'Denim jeans · 32', amt: 1899, status: 'Shipped' }, { id: 'SO-2035', who: 'Meera Iyer', item: 'Leather wallet', amt: 699, status: 'Delivered' },
  ],
  promos: [{ id: 'pr1', code: 'DIWALI20', off: 20, until: Date.now() + 9 * DAY, on: true, used: 37 }],
});
const NEXT: Record<string, string> = { New: 'Packed', Packed: 'Shipped', Shipped: 'Delivered' };
const seller = () => MS('seller', seedSeller);

function slAdd() {
  modal({
    title: 'Add product',
    body: <><label className="field"><span>Name</span><input id="sa-n" maxLength={40} autoFocus /></label><label className="field"><span>Price (₹)</span><input id="sa-p" type="number" min={1} /></label><label className="field"><span>Stock</span><input id="sa-s" type="number" min={0} defaultValue={10} /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const n = val(root, '#sa-n').trim(), p = +val(root, '#sa-p'); if (!n || !(p > 0)) { toast('Add a name and price'); return false; } seller().products.push({ id: uid(), name: n, emoji: '📦', price: p, stock: Math.max(0, +val(root, '#sa-s') || 0) }); commit(); toast('Product added to your catalogue'); } }],
  });
}
function slPromo() {
  modal({
    title: 'New promotion',
    body: <><label className="field"><span>Coupon code</span><input id="pm-c" maxLength={16} placeholder="e.g. WEEKEND10" autoCapitalize="characters" autoFocus /></label><label className="field"><span>Discount (%)</span><input id="pm-o" type="number" min={1} max={90} defaultValue={10} /></label><label className="field"><span>Valid for (days)</span><input id="pm-d" type="number" min={1} defaultValue={7} /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: (root) => { const c = val(root, '#pm-c').trim().toUpperCase().replace(/\s+/g, ''), o = +val(root, '#pm-o'); if (!c || !(o > 0 && o <= 90)) { toast('Add a code and a discount between 1 and 90%'); return false; } seller().promos.push({ id: uid(), code: c, off: o, until: Date.now() + (+val(root, '#pm-d') || 7) * DAY, on: true, used: 0 }); commit(); toast(`Promotion ${c} is live`); } }],
  });
}

function SellerDashboard() {
  const s = seller();
  const rev = [8.2, 11.4, 9.1, 14.8, 12.2, 17.6, 15.3], max = Math.max(...rev), days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const custs = [...new Set(s.orders.map((o) => o.who))];
  const stepOf = (st: string) => { const i = ['New', 'Packed', 'Shipped'].indexOf(st); return i >= 0 ? i : 2; };
  return (
    <>
      <div className="kpi-grid"><Kpi label="Revenue (7d)" value={money(88600)} delta="+14%" /><Kpi label="Orders" value={String(s.orders.length + 42)} delta="+6" /><Kpi label="Customers" value={String(custs.length + 118)} delta="+9" /><Kpi label="Conversion" value="4.8%" delta="+0.6" /></div>
      <Sec title="Sales · last 7 days (₹ thousand)">
        <div className="bars">{rev.map((v, i) => <div className="bar-col" key={i}><div className="bar-v" style={{ height: `${(v / max) * 100}%` }} title={`₹${v}K`} /><span>{days[i]}</span></div>)}</div>
        <div className="ci-sub">Top product: 👕 Blue cotton shirt · 38% of sales · most enquiries come from chat (61%)</div>
      </Sec>
      <Sec title="Inventory" extra={<button className="btn sm" data-act="sladd" onClick={slAdd}><Icon name="add" size={14} /> Product</button>}>
        {s.products.map((p) => (
          <div className="set-row" key={p.id}><span className="big-emoji">{p.emoji}</span><div className="grow"><div className="ci-name">{p.name}</div><div className="ci-sub">{money(p.price)} · {p.stock ? `${p.stock} in stock` : 'Out of stock'} {p.stock > 0 && p.stock <= 3 ? <span className="pill third">Low stock</span> : null}</div></div>
            <button className="icon-btn sm" data-act="slstock" data-p={p.id} data-d="-1" aria-label="Decrease stock" onClick={() => { p.stock = Math.max(0, p.stock - 1); commit(); }}>−</button><b className="stock-n">{p.stock}</b><button className="icon-btn sm" data-act="slstock" data-p={p.id} data-d="1" aria-label="Increase stock" onClick={() => { p.stock += 1; commit(); }}>+</button></div>
        ))}
      </Sec>
      <Sec title="Orders">
        {s.orders.map((o) => (
          <div className="set-row" key={o.id}><div className="grow"><div className="ci-name">{o.item}</div><div className="ci-sub">{o.id} · {o.who} · {money(o.amt)}</div></div><span className={`pill step-${stepOf(o.status)}`}>{o.status}</span>
            {NEXT[o.status] ? <button className="btn sm primary" data-act="slorder" data-o={o.id} onClick={() => { o.status = NEXT[o.status]; commit(); toast(`${o.id} marked ${o.status.toLowerCase()} · ${o.who} notified in chat`); }}>Mark {NEXT[o.status].toLowerCase()}</button> : null}</div>
        ))}
      </Sec>
      <Sec title="Customers">
        {custs.map((n) => { const c = S.contacts.find((x) => x.name === n); const mine = s.orders.filter((o) => o.who === n); return (
          <div className="set-row" key={n}><Avatar o={c || { name: n, color: '#888' }} size={34} /><div className="grow"><div className="ci-name">{n}</div><div className="ci-sub">{mine.length} order(s) · {money(mine.reduce((a, o) => a + o.amt, 0))}</div></div>{c ? <button className="btn sm" data-act="startdm" data-user={c.id} onClick={() => startDM(c.id)}><Icon name="chat" size={14} /> Chat</button> : null}</div>
        ); })}
      </Sec>
      <Sec title="Promotions" extra={<button className="btn sm" data-act="slpromo" onClick={slPromo}><Icon name="add" size={14} /> Promotion</button>}>
        {s.promos.map((p) => (
          <div className="set-row" key={p.id}><span className={`pill ${p.on ? 'ok' : ''}`}>{p.code}</span><div className="grow"><div className="ci-name">{p.off}% off</div><div className="ci-sub">Until {new Date(p.until).toLocaleDateString([], { day: 'numeric', month: 'short' })} · used {p.used} times</div></div>
            <input type="checkbox" className="switch" data-promo={p.id} checked={p.on} aria-label="Promotion active" onChange={(e) => { p.on = e.target.checked; commit(); toast(`${p.code} ${p.on ? 'activated' : 'paused'}`); }} /></div>
        ))}
      </Sec>
      <Sec title="Payments">
        <div className="set-row"><div className="grow"><div className="ci-name">Settled to bank</div><div className="ci-sub">₹74,210 this week · next payout tomorrow 10 AM</div></div></div>
        <div className="set-row"><div className="grow"><div className="ci-name">Pending</div><div className="ci-sub">₹14,390 · in transit with delivery partners</div></div></div>
      </Sec>
      <Note ic="store">Marketplace commission is charged only on completed orders. Customer chats, orders and payments stay linked to your verified business profile.</Note>
    </>
  );
}

export function MarketView() {
  const st = mkState();
  // MOD_AFTER.market: refresh order tracking while recent orders are moving
  useEffect(() => {
    const t = setInterval(() => { if (S.mod.market?.orders?.some((o: any) => Date.now() - o.t < 70000)) refresh(); }, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="seg wide">
        <button className={st.mode === 'sell' ? '' : 'on'} data-act="mkmode" data-m="shop" onClick={() => { st.mode = 'shop'; commit(); }}><Icon name="cart" size={16} /> Shop</button>
        <button className={st.mode === 'sell' ? 'on' : ''} data-act="mkmode" data-m="sell" onClick={() => { st.mode = 'sell'; commit(); }}><Icon name="store" size={16} /> Seller dashboard</button>
      </div>
      {st.mode === 'sell' ? <SellerDashboard /> : <Shop />}
    </>
  );
}
