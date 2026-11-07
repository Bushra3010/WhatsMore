// Messaging engine: send, delivery ticks, simulated replies, business bot, payments, polls, voice, AI
'use strict';
const REPLIES = {
  c_siva: [{ text: 'సరే అన్నా 👍', tr: 'Okay brother 👍' }, { text: 'నేను తర్వాత కాల్ చేస్తా', tr: "I'll call you later" }, { text: 'చాలా బాగుంది! 🔥', tr: 'Very nice! 🔥' }],
  c_priya: [{ text: 'ठीक है! 😊', tr: 'Okay! 😊' }, { text: 'मैं अभी बिज़ी हूँ, बाद में बात करते हैं', tr: "I'm busy right now, let's talk later" }, { text: 'बहुत बढ़िया! 🎉', tr: 'Awesome! 🎉' }],
  c_ramesh: ['Sure, noted.', "Thanks! I'll get back to you by evening.", 'Sounds good 👍'],
  c_ananya: ['Haha yes 😂', 'Omg same!!', "Let's catch up this weekend ☕"],
  c_arjun: ['Done ✅', 'On it 🙌', 'Bro 😂'],
  c_mom: ['Okay beta ❤️', 'Eat properly and sleep on time 😊', 'Call me when you are free'],
  default: ['👍', 'Got it!', 'Sounds good 😊', 'Hi! Thanks for connecting 👋'],
};
const DISAPPEAR = { '1m': ['1 minute (demo)', MIN], '24h': ['24 hours', DAY], '7d': ['7 days', 7 * DAY], '90d': ['90 days', 90 * DAY] };

function sendMsg(ch, partial, opts = {}) {
  const m = { id: uid(), from: 'me', t: Date.now(), status: 'sent', reactions: {}, ...partial };
  if (opts.useReply && ui.replyTo && ch.id === ui.active) m.replyTo = ui.replyTo;
  if (opts.useReply) ui.replyTo = null;
  if (ch.disappearing) m.exp = m.t + DISAPPEAR[ch.disappearing][1];
  ch.messages.push(m);
  save();
  if (ch.id === ui.active) { renderMessages({ force: true }); renderReplyBox(); renderSmart(); }
  refreshSidebar();
  progressTicks(ch, m);
  return m;
}
function progressTicks(ch, m) {
  if (ch.request === 'pending') return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  if (c?.blocked) return;
  setTimeout(() => { if (m.status === 'sent') { m.status = 'delivered'; refreshMsg(ch); } }, 700);
  if (S.settings.privacy.readReceipts && !ch.privacy?.hideReceipts && (ch.type === 'group' || c?.online || c?.business)) setTimeout(() => { m.status = 'read'; refreshMsg(ch); }, 1900);
}
function refreshMsg(ch) { save(); if (ch.id === ui.active) renderMessages({ keep: true }); refreshSidebar(); }

function sendText() {
  const ta = $('#input'), ch = chatById(ui.active);
  if (!ta || !ch) return;
  const text = ta.value.trim();
  if (!text) return;
  ta.value = ''; ui.draft[ch.id] = ''; autosize(ta); updateSendBtn();
  if (ui.editing) {
    const m = ch.messages.find((x) => x.id === ui.editing);
    ui.editing = null;
    if (m && m.text !== text) { m.text = text; m.edited = true; save(); renderMessages({ keep: true }); refreshSidebar(); }
    renderReplyBox(); renderSmart();
    return;
  }
  const m = sendMsg(ch, { type: 'text', text }, { useReply: true });
  scheduleReply(ch, m);
}

// ---------- simulated other side
function personReply(c, trig) {
  const t = (trig?.text || '').toLowerCase();
  if (/how are you|how r u|kaise ho|ela unnav/.test(t)) return c.lang === 'te' ? { text: 'నేను బాగున్నా! నువ్వు?', tr: "I'm good! You?" } : c.lang === 'hi' ? { text: 'मैं ठीक हूँ! तुम कैसे हो?', tr: "I'm fine! How are you?" } : "I'm good! You? 😊";
  if (trig?.type === 'payment' && trig.kind === 'send') return 'Received, thank you! 🙏';
  if (trig?.type === 'image' || trig?.type === 'video') return pick(['Wow 😍', 'Send more pics!', 'Beautiful 🔥']);
  if (trig?.type === 'voice') return pick(['Listening now 🎧', 'Got your voice note 👍']);
  if (trig?.type === 'doc') return pick(['Got the file, thanks!', 'Downloading now 📥']);
  if (trig?.type === 'sticker' || trig?.type === 'gif') return pick(['😂😂', 'Haha', '🤣']);
  if (trig?.type === 'event') return 'Count me in! 🙌';
  return pick(REPLIES[c.id] || REPLIES.default);
}
function scheduleReply(ch, trig) {
  if (['poll', 'payment', 'contact'].includes(trig.type) && !isBiz(ch)) {
    if (trig.type === 'poll') simulateVotes(ch, trig);
    if (trig.type === 'payment' && trig.kind === 'request') simulatePayRequest(ch, trig);
    if (!(trig.type === 'payment' && trig.kind === 'send')) return;
  }
  if (ch.type === 'direct') {
    const c = contact(ch.contactId);
    if (c.blocked || ch.request === 'pending') return;
    const reply = c.business ? bizReply(ch, trig) : personReply(c, trig);
    if (reply) simulateIncoming(ch, c.id, reply, 900 + Math.random() * 1200);
  } else if (!ch.readOnly && !ch.left && ch.members.length && Math.random() < 0.7) {
    const who = pick(ch.members);
    simulateIncoming(ch, who, personReply(contact(who), trig), 1500 + Math.random() * 2000);
  }
}
function simulateIncoming(ch, from, msgs, delay = 1000) {
  msgs = Array.isArray(msgs) ? msgs : [msgs];
  setTimeout(() => {
    ui.typing[ch.id] = firstName(from);
    renderChatSub(); refreshSidebar();
    const len = typeof msgs[0] === 'string' ? msgs[0].length : (msgs[0].text || '').length;
    setTimeout(() => {
      delete ui.typing[ch.id];
      msgs.forEach((p, i) => {
        const mm = { id: uid(), from, t: Date.now() + i, status: 'read', reactions: {}, type: 'text', ...(typeof p === 'string' ? { text: p } : p) };
        if (ch.disappearing) mm.exp = mm.t + DISAPPEAR[ch.disappearing][1];
        ch.messages.push(mm);
      });
      if (S.settings.privacy.readReceipts) ch.messages.forEach((x) => { if (x.from === 'me' && x.status !== 'read') x.status = 'read'; });
      if (ch.id !== ui.active) { ch.unread = (ch.unread || 0) + msgs.length; notify(ch, from, msgs[msgs.length - 1]); }
      save(); renderChatSub();
      if (ch.id === ui.active) { renderMessages(); renderSmart(); }
      refreshSidebar(); renderRail();
    }, 800 + Math.min(2200, len * 28));
  }, delay);
}
function notify(ch, from, p) {
  if (ch.muted) return;
  const text = typeof p === 'string' ? p : preview({ type: 'text', ...p });
  toast(`<b>${esc(chatTitle(ch))}</b>${ch.type === 'group' ? ' · ' + esc(firstName(from)) : ''}: ${esc(text).slice(0, 80)}`, () => openChat(ch.id), { html: true, ms: 4500 });
}
function simulateVotes(ch, m) {
  const voters = ch.type === 'group' ? sample(ch.members, 25) : [ch.contactId];
  voters.forEach((v, i) => {
    if (Math.random() < 0.25) return;
    setTimeout(() => {
      const opt = Math.floor(Math.random() * m.options.length);
      (m.votes[opt] = m.votes[opt] || []).push(v);
      refreshMsg(ch);
    }, 1500 + i * 1300 + Math.random() * 800);
  });
}
function simulatePayRequest(ch, m) {
  const payers = ch.type === 'group' ? sample(ch.members, 15) : [ch.contactId];
  payers.forEach((p, i) => setTimeout(() => {
    if (m.status !== 'pending') return;
    m.paidBy = [...(m.paidBy || []), p];
    S.wallet += m.amount;
    S.payments.push({ id: uid(), dir: 'in', amount: m.amount, with: senderName(p), note: m.note || 'Payment request', t: Date.now() });
    if (m.paidBy.length >= (m.split ? m.split.people : 1)) m.status = 'paid';
    refreshMsg(ch);
    toast(`${senderName(p)} paid you ${money(m.amount)}`);
  }, 2500 + i * 2200));
}

// ---------- business AI assistant
const PRODUCT_KW = [[/cupcake/, 'p4'], [/cake/, 'p1'], [/croissant/, 'p2'], [/sourdough|bread|loaf/, 'p3']];
function bizReply(ch, trig) {
  const c = contact(ch.contactId), products = S.catalog[c.id] || [];
  if (trig.type === 'product') {
    const p = productById(trig.productId);
    if (!p.stock) return { text: `Sorry, ${p.name} is sold out today 😔 It'll be back tomorrow morning.`, bot: true };
    const orderId = 'SB-' + (1000 + Math.floor(Math.random() * 9000));
    return [
      { text: `Great choice! ${p.emoji} *${p.name}* is available.\nOrder ${orderId} · Total ${money(p.price)}. Please complete the payment below 👇`, bot: true },
      { type: 'payment', kind: 'request', amount: p.price, note: `Order ${orderId} · ${p.name}`, orderId, items: [{ name: p.name, qty: 1, price: p.price }], status: 'pending', paidBy: [], bot: true },
    ];
  }
  if (trig.type === 'payment') return { text: 'Payment received, thank you! 🙏', bot: true };
  if (trig.type !== 'text') return { text: 'Thanks! 😊 How can we help you today?', bot: true };
  const t = trig.text.toLowerCase();
  const kw = PRODUCT_KW.find(([re]) => re.test(t));
  const prod = kw && productById(kw[1]);
  if (/open|close|hour|timing|time|when/.test(t)) return { text: "We're open Monday–Saturday, 9:00 AM – 9:00 PM 🕘\nTomorrow we open at 9:00 AM.", bot: true };
  if (/deliver/.test(t)) return { text: 'Yes! We deliver within 5 km 🚚 Free delivery on orders above ₹500.', bot: true };
  if (/where|address|location|direction/.test(t)) return { text: `📍 ${c.business.address}\nSee you soon!`, bot: true };
  if (/appointment|book|custom|birthday|party/.test(t)) return { text: 'We take custom cake orders with 24 hours notice 🎂 Would you like a tasting slot tomorrow at 11 AM?', bot: true };
  if (prod && !/price|cost|how much/.test(t)) return { text: prod.stock ? `Yes! ${prod.emoji} ${prod.name} is available today at ${money(prod.price)}. Tap + → Catalogue to order.` : `${prod.name} is sold out today, sorry! 😔`, bot: true };
  if (/price|cost|menu|catalog|how much|rate|list|available/.test(t)) return { text: "Here are today's prices:\n" + products.map((p) => `${p.emoji} ${p.name} — ${money(p.price)}${p.stock ? '' : ' (sold out)'}`).join('\n') + '\n\nTap + → Catalogue to order.', bot: true };
  if (/order|buy/.test(t)) return { text: 'Sure! Tap + → Catalogue and choose any item. You can pay right here in the chat 💳', bot: true };
  if (/thank/.test(t)) return { text: "You're welcome! Have a sweet day 🧁", bot: true };
  if (/^(hi|hey|hello|namaste)/.test(t)) return { text: 'Hello! 👋 Welcome to Sunrise Bakery. Ask me about hours, prices, delivery or orders.', bot: true };
  return { text: 'Thanks for your message! A team member will reply shortly. Meanwhile I can help with hours, prices, delivery and orders 🙂', bot: true };
}

// ---------- payments
function payRequest(ch, m) {
  if (S.wallet < m.amount) return toast('Insufficient demo balance');
  const to = m.from;
  modal({
    title: 'Confirm payment',
    body: `<div class="pay-confirm">${avatarHTML(contact(to), 56)}<div class="muted">Paying ${esc(senderName(to))}</div><div class="pay-amount big">${money(m.amount)}</div>${m.note ? `<div class="muted">${esc(m.note)}</div>` : ''}<div class="hint-box">${icon('info', 16)}<span>Demo payment — no real money moves. Balance after: ${money(S.wallet - m.amount)}</span></div></div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Pay ' + money(m.amount), primary: true, onClick: () => {
        m.paidBy = [...(m.paidBy || []), 'me'];
        if (!m.split || m.paidBy.length >= m.split.people) m.status = 'paid';
        S.wallet -= m.amount;
        S.payments.push({ id: uid(), dir: 'out', amount: m.amount, with: senderName(to), note: m.note || 'Payment', t: Date.now() });
        refreshMsg(ch);
        toast(`Paid ${money(m.amount)} to ${senderName(to)} ✅`);
        if (m.orderId) {
          simulateIncoming(ch, to, [
            { type: 'invoice', orderId: m.orderId, items: m.items, total: m.amount, bot: true },
            { text: 'Payment received ✅ Your order will be ready for pickup in 2 hours. Thank you! 🧁', bot: true },
          ], 900);
        }
      },
    }],
  });
}
function payModal(ch) {
  const group = ch.type === 'group';
  const n = group ? ch.members.length + 1 : 2;
  let mode = group ? 'split' : 'send';
  const tabs = group ? [['split', 'Split bill'], ['send', 'Send']] : [['send', 'Send'], ['request', 'Request']];
  modal({
    title: 'Payments',
    body: `<div class="seg">${tabs.map(([k, l]) => `<button class="${k === mode ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
      ${group ? `<label class="field" id="pm-to-wrap" hidden><span>Send to</span><select id="pm-to">${ch.members.slice(0, 500).map((id) => `<option value="${id}">${esc(senderName(id))}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span id="pm-amt-label">${group ? 'Total bill amount (₹)' : 'Amount (₹)'}</span><input id="pm-amt" type="number" min="1" step="1" inputmode="decimal" placeholder="0" autofocus></label>
      <label class="field"><span>Note</span><input id="pm-note" maxlength="60" placeholder="e.g. Dinner bill"></label>
      <div class="muted small" id="pm-info">${group ? `Split equally between ${n} people (including you)` : ''}</div>
      <div class="hint-box">${icon('info', 16)}<span>Demo wallet: ${money(S.wallet)}. Payments are simulated; production requires licensed payment partners.</span></div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Continue', primary: true, onClick: (root) => {
        const amt = Math.round(parseFloat($('#pm-amt', root).value) * 100) / 100;
        const note = $('#pm-note', root).value.trim();
        if (!(amt > 0)) { toast('Enter an amount'); return false; }
        if (mode === 'send') {
          if (amt > S.wallet) { toast('Insufficient demo balance'); return false; }
          const to = group ? $('#pm-to', root).value : ch.contactId;
          S.wallet -= amt;
          S.payments.push({ id: uid(), dir: 'out', amount: amt, with: senderName(to), note: note || 'Payment', t: Date.now() });
          const m = sendMsg(ch, { type: 'payment', kind: 'send', amount: amt, note: group ? `To ${senderName(to)}${note ? ' · ' + note : ''}` : note, status: 'paid' });
          scheduleReply(ch, m);
        } else if (mode === 'request') {
          const m = sendMsg(ch, { type: 'payment', kind: 'request', amount: amt, note, status: 'pending', paidBy: [] });
          scheduleReply(ch, m);
        } else {
          const share = Math.round((amt / n) * 100) / 100;
          const m = sendMsg(ch, { type: 'payment', kind: 'request', amount: share, note: note || 'Split bill', split: { total: amt, people: n }, status: 'pending', paidBy: ['me'] });
          scheduleReply(ch, m);
        }
      },
    }],
    onMount: (root) => {
      const upd = () => {
        $$('.seg button', root).forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
        const w = $('#pm-to-wrap', root); if (w) w.hidden = mode !== 'send';
        $('#pm-amt-label', root).textContent = mode === 'split' ? 'Total bill amount (₹)' : 'Amount (₹)';
        const amt = parseFloat($('#pm-amt', root).value) || 0;
        $('#pm-info', root).textContent = mode === 'split' ? `${money(Math.round((amt / n) * 100) / 100)} each · split between ${n} people (including you)` : mode === 'request' ? `${senderName(ch.contactId)} will get a request to pay you` : '';
      };
      root.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; upd(); } });
      $('#pm-amt', root).addEventListener('input', upd);
      upd();
    },
  });
}

// ---------- polls / events
function vote(ch, m, i) {
  const has = (m.votes[i] || []).includes('me');
  if (!m.multi) Object.keys(m.votes).forEach((k) => { m.votes[k] = (m.votes[k] || []).filter((v) => v !== 'me'); });
  if (!has) (m.votes[i] = m.votes[i] || []).push('me');
  else m.votes[i] = m.votes[i].filter((v) => v !== 'me');
  refreshMsg(ch);
}
function pollModal(ch) {
  modal({
    title: 'Create poll',
    body: `<label class="field"><span>Question</span><input id="pl-q" maxlength="120" placeholder="Ask a question" autofocus></label>
      <div class="field"><span>Options</span><div id="pl-opts">${[1, 2].map((i) => `<input class="pl-opt" maxlength="60" placeholder="Option ${i}">`).join('')}</div><button class="link-btn" id="pl-add">+ Add option</button></div>
      <label class="set-row plain"><span>Allow multiple answers</span><input type="checkbox" class="switch" id="pl-multi"></label>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Send', primary: true, onClick: (root) => {
        const qn = $('#pl-q', root).value.trim();
        const opts = $$('.pl-opt', root).map((i) => i.value.trim()).filter(Boolean);
        if (!qn || opts.length < 2) { toast('Add a question and at least 2 options'); return false; }
        const m = sendMsg(ch, { type: 'poll', question: qn, options: opts, votes: {}, multi: $('#pl-multi', root).checked });
        scheduleReply(ch, m);
      },
    }],
    onMount: (root) => $('#pl-add', root).addEventListener('click', () => {
      const n = $$('.pl-opt', root).length;
      if (n >= 8) return;
      $('#pl-opts', root).insertAdjacentHTML('beforeend', `<input class="pl-opt" maxlength="60" placeholder="Option ${n + 1}">`);
      $$('.pl-opt', root)[n].focus();
    }),
  });
}
function eventModal(ch) {
  const d = new Date(Date.now() + DAY); d.setHours(18, 0, 0, 0);
  const local = new Date(d - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  modal({
    title: 'Create event',
    body: `<label class="field"><span>Event name</span><input id="ev-t" maxlength="60" placeholder="e.g. Team dinner" autofocus></label>
      <label class="field"><span>Date & time</span><input id="ev-d" type="datetime-local" value="${local}"></label>
      <label class="field"><span>Location (optional)</span><input id="ev-p" maxlength="60" placeholder="Add a place"></label>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Send', primary: true, onClick: (root) => {
        const title = $('#ev-t', root).value.trim(), when = new Date($('#ev-d', root).value).getTime();
        if (!title || !when) { toast('Add a name and date'); return false; }
        const m = sendMsg(ch, { type: 'event', title, when, place: $('#ev-p', root).value.trim(), going: ['me'] });
        (ch.type === 'group' ? sample(ch.members, 25) : [ch.contactId]).forEach((p, i) => setTimeout(() => { if (Math.random() < 0.7) { m.going.push(p); refreshMsg(ch); } }, 2000 + i * 1500));
      },
    }],
  });
}

// ---------- voice notes
async function startRecording() {
  const rec = ui.rec = { start: Date.now(), chunks: [], mr: null, stream: null, timer: null, sim: false };
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec.mr = new MediaRecorder(rec.stream);
    rec.mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
    rec.mr.start();
  } catch (e) { rec.sim = true; }
  if (ui.rec !== rec) { rec.stream?.getTracks().forEach((t) => t.stop()); return; }
  rec.start = Date.now();
  renderComposer();
  rec.timer = setInterval(() => { const el = $('#rec-time'); if (el) el.textContent = fmtDur((Date.now() - rec.start) / 1000); }, 250);
}
function stopRecording(doSend) {
  const rec = ui.rec;
  if (!rec) return;
  clearInterval(rec.timer);
  ui.rec = null;
  const dur = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
  const ch = chatById(ui.active);
  const finish = (src) => {
    rec.stream?.getTracks().forEach((t) => t.stop());
    renderComposer();
    if (doSend && ch) { if (src && src.startsWith('blob:')) ui.blobs.add(src); const m = sendMsg(ch, { type: 'voice', dur, src }); scheduleReply(ch, m); }
  };
  if (rec.mr && rec.mr.state !== 'inactive') {
    rec.mr.onstop = () => {
      if (!doSend) return finish();
      const blob = new Blob(rec.chunks, { type: rec.mr.mimeType || 'audio/webm' });
      if (blob.size > 1.5e6) return finish(URL.createObjectURL(blob));
      const fr = new FileReader();
      fr.onload = () => finish(fr.result);
      fr.readAsDataURL(blob);
    };
    rec.mr.stop();
  } else finish();
}
function playVoice(mid) {
  const ch = chatById(ui.active), m = ch?.messages.find((x) => x.id === mid);
  if (!m) return;
  const p = ui.playing;
  if (p && p.id === mid) { p.paused = !p.paused; if (p.audio) (p.paused ? p.audio.pause() : p.audio.play()); updateVoiceUI(); return; }
  stopVoice();
  const st = ui.playing = { id: mid, pos: 0, dur: m.dur, paused: false };
  if (m.src && (!m.src.startsWith('blob:') || ui.blobs.has(m.src))) {
    st.audio = new Audio(m.src);
    st.audio.play().catch(() => { st.audio = null; });
    st.audio.onended = stopVoice;
  }
  st.tick = setInterval(() => {
    if (st.paused) return;
    if (st.audio) { st.pos = st.audio.currentTime; if (isFinite(st.audio.duration)) st.dur = st.audio.duration; }
    else { st.pos += 0.1; if (st.pos >= st.dur) return stopVoice(); }
    updateVoiceUI();
  }, 100);
  if (m.from !== 'me' && !m.played) { m.played = true; save(); const mic = $(`[data-mid="${mid}"] .vmic`); mic?.classList.add('played'); }
  updateVoiceUI();
}
function stopVoice() { const p = ui.playing; if (!p) return; clearInterval(p.tick); p.audio?.pause(); ui.playing = null; updateVoiceUI(); }
function updateVoiceUI() {
  $$('.voice').forEach((v) => {
    const on = ui.playing && v.dataset.mid === ui.playing.id;
    const frac = on ? Math.min(1, ui.playing.pos / (ui.playing.dur || 1)) : 0;
    v.querySelector('.vplay').innerHTML = icon(on && !ui.playing.paused ? 'pause' : 'play', 30);
    const bars = v.querySelectorAll('.vwave i');
    bars.forEach((b, i) => b.classList.toggle('on', on && i / bars.length < frac));
    const d = v.querySelector('.vdur');
    d.textContent = fmtDur(on ? ui.playing.pos : +d.dataset.dur);
  });
}

// ---------- AI tools (heuristic demo — swap for a real model in production)
const AI = {
  fix(s) {
    const map = { u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', im: "I'm", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", isnt: "isn't", i: 'I', teh: 'the', recieve: 'receive', tommorow: 'tomorrow', tomorow: 'tomorrow', definately: 'definitely', wanna: 'want to', gonna: 'going to', btw: 'by the way', bcoz: 'because', coz: 'because' };
    let t = s.trim().replace(/\b[\w']+\b/g, (w) => map[w.toLowerCase()] ?? w);
    t = t.replace(/\s+([,.!?])/g, '$1').replace(/([,.!?])(?=[A-Za-z])/g, '$1 ').replace(/\s{2,}/g, ' ');
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    if (!/[.!?…)]$/.test(t) && !/\p{Extended_Pictographic}$/u.test(t)) t += '.';
    return t;
  },
  formal(s) {
    let t = AI.fix(s).replace(/\p{Extended_Pictographic}️?/gu, '').replace(/!+/g, '.').trim();
    t = t.replace(/^(hey|hi+|yo|hello)\b[,!.]*\s*/i, 'Hello, ').replace(/\bthanks\b/gi, 'thank you').replace(/\b(ok|okay|k)\b/gi, 'certainly').replace(/\b(yeah|yep|ya)\b/gi, 'yes').replace(/\bnope\b/gi, 'no');
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    return t.replace(/\s+\./g, '.');
  },
  casual(s) {
    let t = s.trim().replace(/^hello\b/i, 'Hey').replace(/\bthank you\b/gi, 'thanks').replace(/\bcertainly\b/gi, 'sure').replace(/\.$/, '');
    if (!/\p{Extended_Pictographic}/u.test(t)) t += ' 😊';
    return t;
  },
  shorter(s) {
    let t = s.replace(/\b(just|really|actually|basically|very|kind of|sort of|I think that|in order to)\s+/gi, '').replace(/\s{2,}/g, ' ').trim();
    const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
    if (sentences.length > 1 && t.length > 80) t = sentences[0].trim();
    return t;
  },
  emoji(s) {
    const map = [[/\b(thanks|thank you)\b/i, '🙏'], [/\b(love|miss)\b/i, '❤️'], [/\b(party|celebrat)/i, '🎉'], [/\b(food|lunch|dinner|eat)\b/i, '🍛'], [/\b(meet|meeting|call)\b/i, '📅'], [/\b(great|awesome|super)\b/i, '🔥'], [/\b(sorry)\b/i, '😔'], [/\b(late|running)\b/i, '🏃']];
    const hit = map.find(([re]) => re.test(s));
    return s.trim() + ' ' + (hit ? hit[1] : '😊');
  },
};
const AI_DRAFTS = ["Hi! Running about 10 minutes late — sorry, see you soon 🙏", 'Thank you so much for your help today, really appreciate it! 😊', "Quick reminder: our meeting is tomorrow at 11 AM. Let me know if anything changes.", 'Happy birthday! 🎉 Wishing you an amazing year ahead!'];
function aiWriteMenu(anchor) {
  const ta = $('#input');
  if (!ta) return;
  const text = ta.value.trim();
  const apply = (fn, label) => { const out = fn(text); ta.value = out; ta.dispatchEvent(new Event('input', { bubbles: true })); focusInput(); toast('✨ ' + label); };
  if (!text) {
    showMenu(anchor, AI_DRAFTS.map((d) => ({ label: d.length > 46 ? d.slice(0, 44) + '…' : d, icon: 'sparkle', onClick: () => { ta.value = d; ta.dispatchEvent(new Event('input', { bubbles: true })); focusInput(); } })), { above: true, header: '<div class="menu-title">✨ AI draft a message</div>' });
    return;
  }
  showMenu(anchor, [
    { label: 'Fix grammar & spelling', icon: 'check', onClick: () => apply(AI.fix, 'Grammar fixed') },
    { label: 'Make it formal', icon: 'edit', onClick: () => apply(AI.formal, 'Rewritten formally') },
    { label: 'Make it casual', icon: 'emoji', onClick: () => apply(AI.casual, 'Rewritten casually') },
    { label: 'Make it shorter', icon: 'sparkle', onClick: () => apply(AI.shorter, 'Shortened') },
    { label: 'Add an emoji', icon: 'emoji', onClick: () => apply(AI.emoji, 'Emoji added') },
  ], { above: true, header: '<div class="menu-title">✨ AI writing assistant</div>' });
}

function summarize(ch) {
  const msgs = ch.messages.filter((m) => m.type !== 'system' && m.type !== 'deleted');
  const txt = (m) => (m.type === 'text' ? m.tr || m.text : m.type === 'doc' ? 'Shared ' + m.name : m.caption || preview(m));
  const lines = msgs.map((m) => ({ m, s: txt(m) }));
  const grab = (re) => lines.filter((l) => re.test(l.s)).slice(-4);
  return {
    count: msgs.length,
    people: [...new Set(msgs.map((m) => senderName(m.from)))],
    key: lines.filter((l) => l.m.type === 'text' && l.s.length > 28).slice(-4),
    announcements: grab(/📢|important|announce|attention|will be off|notice|reminder/i),
    decisions: grab(/decided|decision|final|confirmed|booked|agreed|✅|we take|let's go with/i),
    tasks: grab(/please|pls|don't forget|dont forget|remember|need to|review|pay your|bring|forget/i),
    dates: grab(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2} o'?clock)\b/i),
    polls: msgs.filter((m) => m.type === 'poll').map((m) => { const best = m.options.map((o, i) => [o, (m.votes[i] || []).length]).sort((a, b) => b[1] - a[1])[0]; return `“${m.question}” — leading: ${best[0]} (${best[1]} vote${best[1] === 1 ? '' : 's'})`; }),
    pays: msgs.filter((m) => m.type === 'payment').map((m) => `${senderName(m.from)} ${m.kind === 'request' ? 'requested' : 'sent'} ${money(m.amount)}${m.note ? ' — ' + m.note : ''} (${m.status})`),
    files: msgs.filter((m) => m.type === 'doc').map((m) => m.name),
    links: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? l.m.text.match(/https?:\/\/[^\s<]+/g) || [] : [])))].slice(-6),
    mentions: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? (l.m.text.match(/@[a-z0-9._]{3,}/gi) || []).map((x) => x.toLowerCase()) : [])))],
    actions: grab(/please|pls|need to|can you|could you|will you|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow)|review|pay your|send|bring|share/i).map((l) => ({ ...l, who: firstName(l.m.from) })),
  };
}
function aiSummaryModal(ch) {
  const s = summarize(ch);
  const li = (arr) => arr.map((l) => `<li><b>${esc(firstName(l.m.from))}:</b> ${esc(l.s)}</li>`).join('');
  const sec = (ic, title, html) => (html ? `<div class="sum-sec"><div class="sum-title">${ic} ${title}</div><ul>${html}</ul></div>` : '');
  modal({
    title: '✨ AI summary',
    wide: true,
    body: `<p class="muted">${esc(chatTitle(ch))} · ${s.count} messages · ${esc(s.people.join(', '))}</p>
      ${sec('💬', 'Key discussions', li(s.key))}
      ${sec('📢', 'Important announcements', li(s.announcements))}
      ${sec('✅', 'Decisions', li(s.decisions))}
      ${sec('📝', 'Pending tasks', li(s.tasks))}
      ${sec('📅', 'Dates & meetings', li(s.dates))}
      ${sec('📊', 'Polls', s.polls.map((p) => `<li>${esc(p)}</li>`).join(''))}
      ${sec('💳', 'Payments', s.pays.map((p) => `<li>${esc(p)}</li>`).join(''))}
      ${sec('📎', 'Shared files', s.files.map((p) => `<li>${esc(p)}</li>`).join(''))}
      ${sec('🔗', 'Important links', s.links.map((p) => `<li><a href="${esc(p)}" target="_blank" rel="noopener noreferrer">${esc(p)}</a></li>`).join(''))}
      ${sec('👤', 'Mentioned people', s.mentions.map((p) => `<li>${esc(p)}</li>`).join(''))}
      ${sec('🎯', 'Action items', s.actions.map((l) => `<li><b>${esc(l.who)}</b> raised: ${esc(l.s)}</li>`).join(''))}
      <div class="hint-box">${icon('sparkle', 16)}<span>Demo summary generated on your device with simple rules. A production build would use an on-device or privacy-preserving AI model so encrypted chats stay private.</span></div>`,
    actions: [{ label: 'Done', primary: true }],
  });
}
