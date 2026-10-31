// Conversation pane: header, bars, message list, composer, emoji panel
'use strict';
const REACTS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJIS = {
  Smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🤯 😳 🥺 😱 🤔 🤗 🤫 😴 🙄 😬 🤝'.split(' '),
  Gestures: '👍 👎 👌 ✌️ 🤞 🙏 👏 🙌 💪 👋 🤙 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 🔥 ✨ ⭐ 🎉 🎊'.split(' '),
  Things: '☕ 🍛 🍕 🍔 🍰 🎂 🥐 🍞 🚗 ✈️ 🏖️ 🏝️ 🏠 📱 💻 📷 🎵 ⚽ 🏏 🎮 📚 💼 💸 🛍️ 🎁 📅 ⏰ ✅ ❌'.split(' '),
};
const STICKERS = ['😺', '🐶', '🦄', '🐼', '🌈', '🎉', '💐', '🍕', '🚀', '👻', '🤖', '💯', '🥳', '😎', '🙏', '❤️‍🔥'];
const GIFS = [
  { e: '😂', label: 'LOL', anim: 'bounce', bg: 'linear-gradient(135deg,#f6d365,#fda085)' },
  { e: '🎉', label: 'Party time', anim: 'spin', bg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { e: '🙏', label: 'Thank you', anim: 'pulse', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)' },
  { e: '😮', label: 'Wow', anim: 'shake', bg: 'linear-gradient(135deg,#fccb90,#d57eeb)' },
  { e: '👋', label: 'Hello!', anim: 'wave', bg: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)' },
  { e: '🔥', label: 'On fire', anim: 'pulse', bg: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { e: '💃', label: 'Dance', anim: 'bounce', bg: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
  { e: '😴', label: 'Sleepy', anim: 'float', bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
];

function emptyMain() {
  return `<div class="empty-main"><div class="em-logo">${logoSVG(96)}</div><h2>WHATSMORE for Web</h2>
    <p>More Than Chat. Message, call, share stories, pay and shop — all in one place.<br>Pick a chat on the left to start.</p>
    <div class="em-feats">${['💬 Private chat', '📞 Calls', '👥 Groups', '📸 Stories', '👤 @username', '🔐 Encryption', '🤖 AI', '☁️ Cloud', '💳 Payments', '💼 Business'].map((f) => `<span>${f}</span>`).join('')}</div>
    <div class="em-foot">${icon('lock', 14)} Your personal messages are end-to-end encrypted</div></div>`;
}

function renderMain() {
  const ch = chatById(ui.active);
  app.classList.toggle('chat-open', !!ch || !!ui.view);
  if (!ch) { if (ui.view) renderView(); else main.innerHTML = emptyMain(); return; }
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  main.innerHTML = `
    <header class="chat-head">
      <button class="icon-btn back-btn" data-act="closechat" aria-label="Back">${icon('back')}</button>
      <div class="chat-head-info" data-act="info" role="button" tabindex="0">${chatAvatar(ch, 40)}<div class="chat-head-text"><div class="chat-head-name">${esc(chatTitle(ch))}${verifiedHTML(c)}${ch.disappearing ? `<span class="dis-ic">${icon('timer', 15)}</span>` : ''}</div><div class="chat-head-sub" id="chat-sub"></div></div></div>
      <div class="head-actions">
        <button class="icon-btn" data-act="call-video" title="Video call" aria-label="Video call">${icon('video')}</button>
        <button class="icon-btn" data-act="call-voice" title="Voice call" aria-label="Voice call">${icon('call')}</button>
        <button class="icon-btn hide-sm" data-act="chatsearch" title="Search" aria-label="Search">${icon('search')}</button>
        <button class="icon-btn" data-act="headmenu" title="Menu" aria-label="Menu">${icon('more')}</button>
      </div>
    </header>
    <div id="chat-bars"></div>
    <div class="messages-wrap"><div class="messages" id="msgs"></div><button class="scroll-down" data-act="scrollbottom" aria-label="Scroll to bottom">${icon('chevdown')}</button></div>
    <div id="composer-area"></div>`;
  const msgs = $('#msgs');
  ui.stick = true;
  msgs.addEventListener('scroll', () => {
    const gap = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight;
    ui.stick = gap < 40;
    main.classList.toggle('scrolled-up', gap > 300);
  });
  // Keep the newest message in view when bars/composer/fonts change the layout
  ui.msgsRO = new ResizeObserver(() => { if (ui.stick) msgs.scrollTop = msgs.scrollHeight; });
  renderChatSub(); renderBars(); renderMessages({ initial: true }); renderComposer();
  msgs.scrollTop = msgs.scrollHeight;
}

function chatSubText(ch) {
  if (ui.typing[ch.id]) return `<span class="typing-txt">${ch.type === 'group' ? esc(ui.typing[ch.id]) + ' is ' : ''}typing…</span>`;
  if (ch.type === 'group') return ch.members.length > 6 ? `${(ch.members.length + 1).toLocaleString()} members · ${esc(namesSummary(ch.members, 3))}, You` : esc([...ch.members.map(firstName), 'You'].join(', '));
  const c = contact(ch.contactId);
  if (c.business) return c.business.category + ' · Business account';
  if (ch.request === 'pending') return 'Chat request sent · waiting for @' + esc(c.username);
  if (c.blocked) return 'Blocked';
  if (c.online) return 'online';
  if (c.lastSeen && S.settings.privacy.lastSeen !== 'nobody') return 'last seen ' + (dayDiff(c.lastSeen) === 0 ? 'today' : dayLabel(c.lastSeen).toLowerCase()) + ' at ' + fmtTime(c.lastSeen);
  return '@' + esc(c.username);
}
function renderChatSub() { const el = $('#chat-sub'), ch = chatById(ui.active); if (el && ch) el.innerHTML = chatSubText(ch); }

function renderBars() {
  const el = $('#chat-bars'), ch = chatById(ui.active);
  if (!el || !ch) return;
  let html = '';
  if (ui.chatSearch !== null) html += `<div class="bar searchbar">${icon('search', 18)}<input id="cs-input" placeholder="Search in this chat" value="${esc(ui.chatSearch)}" autocomplete="off"><span class="cs-count" id="cs-count"></span><button class="icon-btn sm" data-act="cs-prev" aria-label="Previous match">${icon('chevup', 20)}</button><button class="icon-btn sm" data-act="cs-next" aria-label="Next match">${icon('chevdown', 20)}</button><button class="icon-btn sm" data-act="cs-close" aria-label="Close search">${icon('close', 20)}</button></div>`;
  const pinned = ch.messages.filter((m) => m.pinned && m.type !== 'deleted');
  if (pinned.length) { const p = pinned[pinned.length - 1]; html += `<div class="bar pinbar" data-act="jump" data-mid="${p.id}"><span class="accent">${icon('pin', 18)}</span><div class="pb-text"><div class="pb-title">Pinned message${pinned.length > 1 ? ` (${pinned.length})` : ''}</div><div class="pb-prev">${esc(preview(p))}</div></div></div>`; }
  if (ch.messages.some((m) => m.tr)) {
    const lang = LANGS[contact(ch.contactId)?.lang] || 'other languages';
    html += `<div class="bar trbar"><span class="accent">${icon('translate', 18)}</span><span class="grow">${ch.translate ? 'Showing English translations' : 'Some messages are in ' + lang}</span><button class="link-btn" data-act="translate-toggle">${ch.translate ? 'Hide' : 'Translate to English'}</button></div>`;
  }
  if (ch.request === 'pending') html += `<div class="bar">${icon('person', 18)}<span>Chat request sent. They'll see your messages after accepting.</span></div>`;
  const sched = S.scheduled.filter((s) => s.chatId === ch.id);
  if (sched.length) html += `<div class="bar schbar" data-act="sched-view"><span class="accent">${icon('timer', 18)}</span><span class="grow">${sched.length} scheduled message${sched.length > 1 ? 's' : ''} · next ${dayLabel(Math.min(...sched.map((s) => s.at))).toLowerCase()} at ${fmtTime(Math.min(...sched.map((s) => s.at)))}</span><span class="link-btn">View</span></div>`;
  html += extraBarsHTML(ch);
  el.innerHTML = html;
}

// ---------- messages
function renderMessages(opts = {}) {
  const el = $('#msgs'), ch = chatById(ui.active);
  if (!el || !ch) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  const prevTop = el.scrollTop;
  const q = ui.chatSearch && ui.chatSearch.trim();
  let html = '', lastDay = null, prevFrom = null, prevT = 0;
  ch.messages.forEach((m) => {
    const dk = dayKey(m.t);
    if (dk !== lastDay) { html += `<div class="day-sep"><span>${dayLabel(m.t)}</span></div>`; lastDay = dk; prevFrom = null; }
    if (m.type === 'system') {
      const enc = /end-to-end encrypted/.test(m.text);
      html += `<div class="sys-msg ${enc ? 'enc' : ''}" ${enc ? 'data-act="verify"' : ''}><span>${enc ? icon('lock', 13) + ' ' : ''}${esc(m.text)}${enc ? ' Tap to learn more.' : ''}</span></div>`;
      prevFrom = null;
      return;
    }
    const first = m.from !== prevFrom || m.t - prevT > 10 * MIN;
    html += msgHTML(ch, m, first, q);
    prevFrom = m.from; prevT = m.t;
  });
  el.innerHTML = `<div class="msgs-inner">${html}</div>`;
  if (ui.msgsRO) { ui.msgsRO.disconnect(); ui.msgsRO.observe(el); ui.msgsRO.observe(el.firstElementChild); }
  if (opts.keep) el.scrollTop = prevTop;
  else if (opts.force || atBottom || opts.initial) { ui.stick = true; el.scrollTop = el.scrollHeight; }
  else el.scrollTop = prevTop;
  if (ui.playing) updateVoiceUI();
}

function quoteHTML(ch, q) {
  const color = q.from === 'me' ? 'var(--accent)' : contact(q.from)?.color || '#06cf9c';
  let thumb = '';
  if (q.type === 'image') thumb = q.src ? `<img class="q-thumb" src="${q.src}" alt="">` : `<div class="q-thumb" style="background:${q.art.bg}">${q.art.emoji}</div>`;
  return `<div class="quote" data-act="quote" data-mid="${q.id}" style="--qc:${color}"><div class="q-main"><div class="q-name">${esc(senderName(q.from))}</div><div class="q-text">${esc(preview(q))}</div></div>${thumb}</div>`;
}

function msgHTML(ch, m, first, q) {
  const out = m.from === 'me';
  const jumbo = m.type === 'sticker' || (m.type === 'text' && isJumbo(m.text) && !m.replyTo);
  const bare = jumbo || m.type === 'gif';
  let inner = '';
  if (ch.type === 'group' && !out && first && !bare) inner += `<div class="sender" style="color:${contact(m.from)?.color || 'var(--accent)'}">${esc(senderName(m.from))}<span class="sender-un">@${esc(contact(m.from)?.username || '')}</span></div>`;
  if (m.forwarded) inner += `<div class="fwd">${icon('forward', 14)} Forwarded</div>`;
  if (m.bot) inner += `<div class="bot-tag">${icon('sparkle', 12)} AI assistant</div>`;
  if (m.scheduled) inner += `<div class="fwd">${icon('timer', 13)} Scheduled</div>`;
  if (m.replyTo) { const qm = ch.messages.find((x) => x.id === m.replyTo); if (qm) inner += quoteHTML(ch, qm); }
  if (m.statusQuote) inner += `<div class="quote status-q" style="--qc:var(--accent)"><div class="q-main"><div class="q-name">${esc(m.statusQuote.who)} · Status</div><div class="q-text">${esc(m.statusQuote.text)}</div></div><div class="q-thumb" style="background:${m.statusQuote.bg}"></div></div>`;
  inner += contentHTML(ch, m, q, jumbo);
  const meta = `<span class="meta">${m.exp ? icon('timer', 12) : ''}${m.starred ? icon('star', 12) : ''}${m.pinned ? icon('pin', 12) : ''}${m.edited ? '<span>Edited</span>' : ''}<span>${fmtTime(m.t)}</span>${out && !['deleted', 'call'].includes(m.type) ? ticks(m.status) : ''}</span>`;
  const reacts = Object.entries(m.reactions || {}).filter(([, v]) => v.length);
  const reactHTML = reacts.length ? `<button class="reactions ${reacts.some(([, v]) => v.includes('me')) ? 'mine' : ''}" data-act="reactinfo" data-mid="${m.id}">${reacts.map(([e]) => e).join('')}${reacts.reduce((s, [, v]) => s + v.length, 0) > 1 ? `<span>${reacts.reduce((s, [, v]) => s + v.length, 0)}</span>` : ''}</button>` : '';
  const cls = ['bubble', 't-' + m.type, first && !bare ? 'tail' : '', bare ? 'bare' : '', m.type === 'image' && !m.caption ? 'nocap' : '', m.edited ? 'edited' : ''].join(' ');
  return `<div class="msg-row ${out ? 'out' : 'in'} ${first ? 'first' : ''}" data-mid="${m.id}"><div class="${cls}">${inner}${meta}<button class="msg-menu" data-act="msgmenu" data-mid="${m.id}" aria-label="Message options">${icon('chevdown', 20)}</button></div>${reactHTML}</div>`;
}

const spacer = '<span class="meta-spacer"></span>';
function contentHTML(ch, m, q, jumbo) {
  const out = m.from === 'me';
  switch (m.type) {
    case 'text':
      if (jumbo) return `<div class="jumbo">${esc(m.text)}</div>`;
      return `${out ? '' : scamWarningHTML(m)}<div class="text">${fmtText(m.text, q)}${m.tr && (ch.translate || S.settings.autoTranslate) ? `<span class="tr"><span class="tr-label">${icon('translate', 12)} Translated from ${LANGS[contact(m.from)?.lang] || 'another language'}</span>${fmtText(m.tr, q)}</span>` : ''}${liveTrHTML(ch, m)}${spacer}</div>`;
    case 'deleted': return `<div class="text deleted">${icon('block', 15)} ${out ? 'You deleted this message' : 'This message was deleted'}${spacer}</div>`;
    case 'sticker': return `<div class="jumbo sticker">${esc(m.text)}</div>`;
    case 'gif': return `<div class="gif" style="background:${m.gif.bg}"><span class="anim-${m.gif.anim}">${m.gif.e}</span><b>${esc(m.gif.label)}</b><span class="gif-tag">GIF</span></div>`;
    case 'image': return `<div class="media" data-act="viewmedia" data-mid="${m.id}">${m.src ? `<img src="${m.src}" alt="${esc(m.caption || 'Photo')}">` : `<div class="art" style="background:${m.art.bg}"><span>${m.art.emoji}</span></div>`}</div>${m.caption ? `<div class="text cap">${fmtText(m.caption, q)}${spacer}</div>` : ''}`;
    case 'video': return `<div class="media">${m.src && ui.blobs.has(m.src) ? `<video src="${m.src}" controls playsinline preload="metadata"></video>` : `<div class="art vid"><span>${icon('play', 48)}</span><small>Video available only in the session it was sent</small></div>`}</div>${m.caption ? `<div class="text cap">${fmtText(m.caption, q)}${spacer}</div>` : ''}`;
    case 'doc': return `<div class="doc" data-act="opendoc" data-mid="${m.id}">${docIconHTML(m.ext)}<div class="doc-info"><div class="doc-name">${highlight(m.name, q)}</div><div class="doc-sub">${m.pages ? m.pages + ' page' + (m.pages > 1 ? 's' : '') + ' · ' : ''}${esc((m.ext || 'file').toUpperCase())} · ${fmtSize(m.size || 0)}</div></div></div>${docBadgesHTML(m)}${m.caption ? `<div class="text cap">${fmtText(m.caption, q)}${spacer}</div>` : ''}`;
    case 'signreq': return signReqHTML(ch, m);
    case 'voice': return voiceHTML(m) + (m.transcript ? `<div class="text transcript"><span class="tr-label">${icon('sparkle', 12)} AI transcript</span>${esc(m.transcript)}${spacer}</div>` : '');
    case 'payment': return payHTML(ch, m);
    case 'poll': return pollHTML(m);
    case 'event': return `<div class="event-card"><div class="ev-ic">${icon('event', 22)}</div><div class="grow"><div class="ev-title">${esc(m.title)}</div><div class="ci-sub">${new Date(m.when).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${m.place ? ' · ' + esc(m.place) : ''}</div><div class="ci-sub">${(m.going || []).length} going</div></div></div><div class="card-actions"><button class="link-btn" data-act="going" data-mid="${m.id}">${(m.going || []).includes('me') ? '✓ Going' : 'Going?'}</button><button class="link-btn" data-act="remind" data-mid="${m.id}">${m.remind ? '⏰ Reminder set' : 'Remind me'}</button></div>`;
    case 'product': { const p = productById(m.productId); return p ? `<div class="product-card" data-act="catalog"><div class="prod-art" style="background:${p.bg}">${p.emoji}</div><div class="prod-info"><div class="ev-title">${esc(p.name)}</div><div class="ci-sub">${money(p.price)}</div></div></div>${m.text ? `<div class="text">${esc(m.text)}${spacer}</div>` : spacer}` : ''; }
    case 'invoice': return `<div class="invoice"><div class="inv-head">${icon('receipt', 18)} Invoice · ${esc(m.orderId)}<span class="paid-stamp">PAID</span></div>${m.items.map((i) => `<div class="inv-row"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}<div class="inv-row total"><span>Total</span><span>${money(m.total)}</span></div><div class="ci-sub">${esc(senderName(m.from))} · ${new Date(m.t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></div><div class="card-actions"><button class="link-btn" data-act="invoice-dl" data-mid="${m.id}">Download invoice</button></div>`;
    case 'contact': { const u = contact(m.userId) || S.directory.find((x) => x.id === m.userId); return u ? `<div class="contact-card">${avatarHTML(u, 44)}<div><div class="ev-title">${esc(u.name)}</div><div class="ci-sub">@${esc(u.username)}</div></div></div><div class="card-actions"><button class="link-btn" data-act="startdm" data-user="${u.id}">Message</button></div>` : ''; }
    case 'call': return `<div class="call-msg"><span class="call-msg-ic ${m.missed ? 'missed' : ''}">${icon(m.video ? 'video' : 'call', 20)}</span><div><div>${m.video ? 'Video call' : 'Voice call'}</div><div class="ci-sub">${m.missed ? 'Missed' : fmtDur(m.dur)}</div></div>${spacer}</div>`;
  }
  return '';
}

function voiceHTML(m) {
  const bars = Array.from({ length: 30 }, (_, i) => 5 + (hash(m.id + ':' + i) % 19));
  const who = m.from === 'me' ? S.me : contact(m.from);
  return `<div class="voice" data-act="playvoice" data-mid="${m.id}">
    <div class="vav">${avatarHTML(who, 46)}<span class="vmic ${m.played || m.from === 'me' ? 'played' : ''}">${icon('mic', 16)}</span></div>
    <button class="vplay" aria-label="Play voice message">${icon('play', 30)}</button>
    <div class="vbody"><div class="vwave">${bars.map((h) => `<i style="height:${h}px"></i>`).join('')}</div><span class="vdur" data-dur="${m.dur}">${fmtDur(m.dur)}</span></div>
  </div>`;
}

function payHTML(ch, m) {
  const out = m.from === 'me', req = m.kind === 'request';
  const paidBy = m.paidBy || [];
  let status;
  if (m.status === 'declined') status = 'Declined';
  else if (req && m.split && ch.type === 'group') status = `${paidBy.length}/${m.split.people} paid${m.status === 'paid' ? ' · Completed' : ''}`;
  else if (m.status === 'paid') status = req ? 'Paid' : out ? 'Sent' : 'Received';
  else status = req ? (out ? 'Waiting for payment' : 'Requested from you') : 'Processing';
  const canPay = req && !out && m.status === 'pending' && !paidBy.includes('me');
  return `<div class="pay-card ${m.status}"><div class="pay-head">${icon('rupee', 16)}<span>${req ? 'Payment request' : 'Payment'}${m.split ? ' · Split bill' : ''}</span></div>
    <div class="pay-amount">${money(m.amount)}</div>
    ${m.split ? `<div class="ci-sub">${out ? 'Each' : 'Your'} share of ${money(m.split.total)} · ${m.split.people} people</div>` : ''}
    ${m.note ? `<div class="pay-note">${esc(m.note)}</div>` : ''}
    <div class="pay-status">${m.status === 'paid' ? icon('check', 14) : ''}${status}</div>
    ${canPay ? `<div class="pay-actions">${ch.type === 'direct' && !m.orderId ? `<button class="btn sm" data-act="pay-decline" data-mid="${m.id}">Decline</button>` : ''}<button class="btn sm primary" data-act="pay" data-mid="${m.id}">Pay ${money(m.amount)}</button></div>` : ''}
  </div>${spacer}`;
}

function pollHTML(m) {
  const voters = new Set(Object.values(m.votes).flat()).size;
  return `<div class="poll"><div class="poll-q">${esc(m.question)}</div><div class="poll-hint">${icon('poll', 14)} ${m.multi ? 'Select one or more' : 'Select one'}</div>
    ${m.options.map((o, i) => { const v = m.votes[i] || []; const mine = v.includes('me'); return `<button class="poll-opt" data-act="vote" data-mid="${m.id}" data-opt="${i}"><span class="poll-check ${mine ? 'on' : ''}">${mine ? icon('check', 14) : ''}</span><div class="poll-main"><div class="poll-row"><span>${esc(o)}</span><span class="poll-n">${v.length}</span></div><div class="poll-track"><div class="poll-fill" style="width:${voters ? (v.length / voters) * 100 : 0}%"></div></div></div></button>`; }).join('')}
    <div class="poll-foot">${voters} vote${voters === 1 ? '' : 's'}</div></div>`;
}

// ---------- composer
function renderComposer() {
  const el = $('#composer-area'), ch = chatById(ui.active);
  if (!el || !ch) return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  if (c?.blocked) { el.innerHTML = `<div class="composer-note" data-act="unblock">You blocked this contact. <b class="accent">Tap to unblock.</b></div>`; return; }
  if (ch.left) { el.innerHTML = `<div class="composer-note">You can't send messages to this group because you're no longer a member.</div>`; return; }
  if (ch.readOnly && !isAdmin(ch)) { el.innerHTML = `<div class="composer-note">${icon('megaphone', 18)} Only admins can send messages</div>`; return; }
  if (ui.rec) {
    el.innerHTML = `<footer class="composer rec"><button class="icon-btn" data-act="rec-cancel" title="Discard" aria-label="Discard recording">${icon('delete')}</button><span class="rec-dot"></span><span id="rec-time" class="rec-time">${fmtDur((Date.now() - ui.rec.start) / 1000)}</span><span class="rec-label">${ui.rec.sim ? 'Recording (simulated — microphone unavailable)' : 'Recording…'}</span><span class="grow"></span><button class="icon-btn send-btn send" data-act="rec-send" aria-label="Send voice message">${icon('send')}</button></footer>`;
    return;
  }
  el.innerHTML = `<div id="reply-box"></div><div id="smart" class="smart"></div><div id="emoji-panel" class="emoji-panel" ${ui.emojiOpen ? '' : 'hidden'}></div>
    <footer class="composer">
      <button class="icon-btn ${ui.emojiOpen ? 'on' : ''}" data-act="emoji" title="Emoji, GIFs & stickers" aria-label="Emoji">${icon(ui.emojiOpen ? 'close' : 'emoji')}</button>
      <button class="icon-btn" data-act="attach" title="Attach" aria-label="Attach">${icon('add')}</button>
      <div class="input-wrap"><textarea id="input" rows="1" placeholder="Type a message" aria-label="Message"></textarea><button class="icon-btn sm ai-btn" data-act="aiwrite" title="AI writing assistant" aria-label="AI writing assistant">${icon('sparkle', 20)}</button></div>
      <button class="icon-btn send-btn" id="send-btn" data-act="sendormic" aria-label="Record voice message">${icon('mic')}</button>
    </footer>`;
  const ta = $('#input');
  ta.value = ui.draft[ch.id] || '';
  autosize(ta); updateSendBtn();
  if (ui.emojiOpen) renderEmojiPanel();
  renderReplyBox(); renderSmart();
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; }
function updateSendBtn() {
  const b = $('#send-btn'), ta = $('#input');
  if (!b || !ta) return;
  const has = ta.value.trim().length > 0;
  b.classList.toggle('send', has);
  b.innerHTML = icon(has ? 'send' : 'mic');
  b.setAttribute('aria-label', has ? 'Send' : 'Record voice message');
}
function focusInput() { const ta = $('#input'); if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; } }

function renderReplyBox() {
  const el = $('#reply-box'), ch = chatById(ui.active);
  if (!el || !ch) return;
  const id = ui.editing || ui.replyTo, m = id && ch.messages.find((x) => x.id === id);
  if (!m) { el.innerHTML = ''; return; }
  const color = m.from === 'me' ? 'var(--accent)' : contact(m.from)?.color || '#06cf9c';
  el.innerHTML = `<div class="reply-box"><div class="quote" style="--qc:${ui.editing ? 'var(--accent)' : color}"><div class="q-main"><div class="q-name">${ui.editing ? 'Editing message' : 'Replying to ' + esc(senderName(m.from))}</div><div class="q-text">${esc(preview(m))}</div></div></div><button class="icon-btn sm" data-act="cancelreply" aria-label="Cancel">${icon('close', 20)}</button></div>`;
}

function smartReplies(m) {
  const t = (m.tr || m.text || m.caption || '').toLowerCase();
  if (m.type === 'payment' && m.kind === 'request') return ['Paying now 💸', 'Thanks for sorting this!', 'Will pay by tonight'];
  if (m.type === 'image') return ['Wow 😍', 'Beautiful!', 'Where is this?'];
  if (m.type === 'voice') return ['Got it 👍', 'Will listen soon', 'Can you text instead?'];
  if (m.type === 'doc') return ['Received, thanks!', "I'll review it today", '👍'];
  if (m.type === 'poll') return ['Voted ✅', 'Any option works for me'];
  if (m.type === 'invoice') return ['Thank you! 🙏', 'What time can I pick it up?'];
  if (/meeting|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d\s?(am|pm)|o'clock|review/.test(t)) return ['See you then 👍', 'Can we push it by 30 min?', "I'll be there"];
  if (/thank/.test(t)) return ["You're welcome! 😊", 'Anytime 🙌', '❤️'];
  if (/^(hi|hey|hello|hii|welcome)/.test(t)) return ['Hey! 👋', 'Hi, how are you?', 'What are your opening hours?'];
  if (/eat|food|lunch|dinner/.test(t)) return ['Yes, done 😄', 'Not yet', 'On my way 🍛'];
  if (/call me/.test(t)) return ['Calling you now 📞', 'Will call in 10 min'];
  if (/\?/.test(t)) return ['Yes', 'No', 'Let me check and get back'];
  return ['👍', 'Sounds good!', 'Haha 😂'];
}
function renderSmart() {
  const el = $('#smart'), ch = chatById(ui.active);
  if (!el || !ch) return;
  const ta = $('#input');
  const last = [...ch.messages].reverse().find((m) => m.type !== 'system');
  if (!last || last.from === 'me' || last.type === 'deleted' || (last.type === 'text' && scamCheck(last.text).length) || ui.editing || (ta && ta.value.trim()) || Date.now() - last.t > 3 * DAY) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="smart-label">${icon('sparkle', 14)}</span>` + smartReplies(last).map((s) => `<button data-act="smart" data-text="${esc(s)}">${esc(s)}</button>`).join('');
}

function renderEmojiPanel() {
  const el = $('#emoji-panel');
  if (!el) return;
  const tab = ui.emojiTab;
  let body;
  if (tab === 'emoji') body = Object.entries(EMOJIS).map(([k, list]) => `<div class="ep-label">${k}</div><div class="ep-grid">${list.map((e) => `<button data-act="emo" data-e="${e}">${e}</button>`).join('')}</div>`).join('');
  else if (tab === 'gif') body = `<div class="gif-grid">${GIFS.map((g, i) => `<button class="gif" style="background:${g.bg}" data-act="sendgif" data-i="${i}"><span class="anim-${g.anim}">${g.e}</span><b>${esc(g.label)}</b></button>`).join('')}</div>`;
  else body = `<div class="ep-grid stickers">${STICKERS.map((e) => `<button data-act="sticker" data-e="${e}">${e}</button>`).join('')}</div>`;
  el.innerHTML = `<div class="ep-tabs">${[['emoji', 'Emoji'], ['gif', 'GIFs'], ['sticker', 'Stickers']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="emojitab" data-t="${k}">${l}</button>`).join('')}</div><div class="ep-body">${body}</div>`;
}
function insertAtCursor(ta, text) {
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
}

function jumpTo(mid) {
  const row = $(`#msgs [data-mid="${mid}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
}
function updateSearchCount(jump) {
  const rows = $$('#msgs .msg-row').filter((r) => r.querySelector('mark'));
  const cnt = $('#cs-count');
  if (!ui.chatSearch || !ui.chatSearch.trim()) { if (cnt) cnt.textContent = ''; return; }
  if (ui.searchIdx >= rows.length) ui.searchIdx = rows.length - 1;
  if (ui.searchIdx < 0) ui.searchIdx = 0;
  if (cnt) cnt.textContent = rows.length ? `${rows.length - ui.searchIdx} of ${rows.length}` : 'No results';
  const target = rows[rows.length - 1 - ui.searchIdx];
  if (jump && target) jumpTo(target.dataset.mid);
}
