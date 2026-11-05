// Super-app layer: Home dashboard, WHATSMORE AI, Services hub and its modules, profiles, chat import
'use strict';
const MS = (k, init) => (S.mod[k] ??= init());
const MODULES = [
  { id: 'pay', name: 'WHATSMORE Pay', ic: 'rupee', color: '#00a884', pillar: 'Pay', sub: 'Scan & pay, send, recharge, bills' },
  { id: 'business', name: 'Business', ic: 'store', color: '#f4511e', pillar: 'Business', sub: 'Dashboard, orders, AI assistant' },
  { id: 'market', name: 'Marketplace', ic: 'cart', color: '#e91e63', pillar: 'Business', sub: 'Shop, food, travel, tickets' },
  { id: 'citizen', name: 'Citizen Services', ic: 'bank', color: '#3949ab', pillar: 'Services', sub: 'Certificates, bills, grievances' },
  { id: 'sos', name: 'Emergency SOS', ic: 'warning', color: '#e53935', pillar: 'Services', sub: 'One tap alert to family' },
  { id: 'family', name: 'Family Hub', ic: 'heart', color: '#d81b60', pillar: 'Services', sub: 'Calendar, reminders, documents' },
  { id: 'learn', name: 'WHATSMORE Learn', ic: 'school', color: '#1e88e5', pillar: 'Community', sub: 'AI tutor, quizzes, study groups' },
  { id: 'news', name: 'News & Channels', ic: 'news', color: '#6d4c41', pillar: 'Community', sub: 'Verified news and channels' },
  { id: 'area', name: 'My Area', ic: 'place', color: '#43a047', pillar: 'Community', sub: 'Jobs, events, shops near you' },
  { id: 'creator', name: 'Creator Studio', ic: 'trend', color: '#8e24aa', pillar: 'Community', sub: 'Followers, revenue, go live' },
  { id: 'voice', name: 'Voice Rooms', ic: 'mic', color: '#00897b', pillar: 'Community', sub: 'Live audio and podcasts' },
  { id: 'wellbeing', name: 'Digital Wellbeing', ic: 'timer', color: '#5e35b1', pillar: 'Life', sub: 'Screen time, focus, quiet hours' },
  { id: 'admin', name: 'Command Center', ic: 'dashboard', color: '#37474f', pillar: 'Admin', sub: 'Admin panel preview' },
];
const PROFILES = { personal: ['Personal', '👤'], business: ['Business', '💼'], creator: ['Creator', '🎙️'], family: ['Family', '🏡'] };
const modTile = (m) => `<button class="mod-tile" data-act="svc" data-mod="${m.id}"><span class="mod-ic" style="background:${m.color}">${icon(m.ic, 22)}</span><span class="mt-name">${esc(m.name)}</span><span class="mt-sub">${esc(m.sub)}</span></button>`;

// ---------- navigation
function onTabOpen(tab) {
  if (tab === 'ai') openView('ai');
}
function openView(v) {
  if (ui.active) { stopVoice(); ui.active = null; ui.drawer = null; renderDrawer(); }
  ui.view = v;
  clearInterval(ui.viewTimer);
  renderMain(); refreshSidebar();
  if (v === 'ai') setTimeout(() => { const box = $('#ai-msgs'); if (box) box.scrollTop = box.scrollHeight; if (innerWidth > 760) $('#ai-input')?.focus(); }, 30);
}
function rerenderView() {
  const sc = $('.view-scroll')?.scrollTop;
  renderMain();
  if (sc != null && $('.view-scroll')) $('.view-scroll').scrollTop = sc;
}
const viewHead = (title, sub, ic, color) => `<header class="chat-head view-head"><button class="icon-btn back-btn" data-act="closeview" aria-label="Back">${icon('back')}</button>
  <span class="mod-ic" style="background:${color}">${icon(ic, 22)}</span><div class="chat-head-text grow"><div class="chat-head-name">${esc(title)}</div><div class="chat-head-sub">${esc(sub)}</div></div>
  <button class="icon-btn desk-close" data-act="closeview" aria-label="Close">${icon('close')}</button></header>`;
function renderView() {
  clearInterval(ui.viewTimer);
  if (ui.view === 'ai') { main.innerHTML = aiViewHTML(); return; }
  const mod = MODULES.find((x) => 'mod:' + x.id === ui.view);
  if (!mod) { ui.view = null; main.innerHTML = emptyMain(); return; }
  main.innerHTML = viewHead(mod.name, mod.sub, mod.ic, mod.color) + `<div class="view-scroll"><div class="view-inner">${MOD_RENDER[mod.id]()}</div></div>`;
  MOD_AFTER[mod.id]?.();
}
const sec = (title, body, extra = '') => `<section class="vsec"><div class="vsec-head"><h3>${title}</h3>${extra}</div>${body}</section>`;
const kpi = (label, value, delta, id) => `<div class="kpi"><span>${label}</span><b ${id ? `id="${id}"` : ''}>${value}</b>${delta ? `<small class="${delta.startsWith('-') ? 'down' : 'up'}">${delta}</small>` : ''}</div>`;
const note = (text, ic = 'info') => `<div class="hint-box flat">${icon(ic, 16)}<span>${text}</span></div>`;

Object.assign(XA, {
  svc(el) { ui.tab = ui.tab === 'settings' || ui.tab === 'home' ? ui.tab : 'services'; renderRail(); openView('mod:' + el.dataset.mod); },
  closeview() { clearInterval(ui.viewTimer); ui.view = null; renderMain(); },
  gotab(el) { ui.tab = el.dataset.tab; ui.page = el.dataset.page || null; renderRail(); renderSidebar(); onTabOpen(ui.tab); },
  gochat(el) { ui.tab = 'chats'; ui.page = null; renderRail(); renderSidebar(); openChat(el.dataset.chat); },
  homesum(el) { const ch = chatById(el.dataset.chat); if (ch) aiSummaryModal(ch); },
  profilemenu(el) { showMenu(el, Object.entries(PROFILES).map(([k, [l, e]]) => ({ label: `${e}  ${l}${S.settings.profile === k ? '  ✓' : ''}`, onClick: () => switchProfile(k) })), { header: '<div class="menu-title">Switch profile</div>' }); },
  setprofile(el) { switchProfile(el.dataset.p); },
  importchats() { importChatModal(); },
  clearaimem() { confirmModal('Clear AI memory?', 'WHATSMORE AI will forget your preferences and past AI conversations.', 'Clear', () => { S.mod.ai = null; save(); toast('AI memory cleared'); }); },
});
function switchProfile(k) {
  S.settings.profile = k; save();
  renderSidebar();
  toast(`${PROFILES[k][1]} Switched to ${PROFILES[k][0]} profile — its own notifications, privacy and status`);
}

// ---------- HOME (personal digital dashboard)
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function tabHome() {
  const unreadChats = S.chats.filter((c) => c.unread > 0 && !c.archived && !c.locked);
  const unread = unreadChats.reduce((s, c) => s + c.unread, 0);
  const sigWait = S.chats.flatMap((c) => c.messages.filter((m) => m.type === 'signreq' && m.from !== 'me' && m.status === 'pending').map((m) => ({ c, m })))[0];
  const scam = S.chats.find((c) => c.messages.some((m) => m.type === 'text' && m.from !== 'me' && !m.safe && !m.reported && scamCheck(m.text).length) && !contact(c.contactId)?.blocked);
  const inPay = S.payments.filter((p) => p.dir === 'in').sort((a, b) => b.t - a.t)[0];
  const busy = S.chats.filter((c) => c.type === 'group' && !c.locked).sort((a, b) => b.messages.length - a.messages.length)[0];
  const fam = (MS('family', seedFamily).events || []).filter((e) => e.at > Date.now()).sort((a, b) => a.at - b.at)[0];
  const linked = S.devices.filter((d) => !d.primary).length;
  const prof = PROFILES[S.settings.profile] || PROFILES.personal;
  const card = (act, attrs, ic, color, title, sub) => `<button class="home-card" data-act="${act}" ${attrs}><span class="hc-ic" style="background:${color}">${icon(ic, 20)}</span><span class="grow"><b>${title}</b><span class="ci-sub">${sub}</span></span>${icon('chevright', 18, 'muted')}</button>`;
  const qa = [['newchat', '', 'newchat', 'New chat'], ['scanqr', '', 'qr', 'Scan QR'], ['gotab', 'data-tab="ai"', 'sparkle', 'AI'], ['svc', 'data-mod="pay"', 'rupee', 'Pay'], ['gotab', 'data-tab="calls"', 'call', 'Calls'], ['gotab', 'data-tab="status"', 'status', 'Status'], ['gotab', 'data-tab="communities"', 'groups', 'Groups'], ['gotab', 'data-tab="files"', 'cloud', 'Cloud']];
  return `<header class="side-head"><h1 class="brand">WHATSMORE</h1><div class="head-actions"><button class="pill clickable" data-act="profilemenu">${prof[1]} ${prof[0]} ▾</button><button class="icon-btn" data-act="gotab" data-tab="settings" aria-label="Settings">${icon('settings')}</button></div></header>
  <div class="side-scroll home">
    <div class="hello"><div><div class="hello-t">${greeting()}, ${esc(S.me.name.split(' ')[0])} 👋</div><div class="ci-sub">More Than Chat · @${esc(S.me.username)}</div></div>${avatarHTML(S.me, 44)}</div>
    <div class="qa-grid">${qa.map(([a, at, ic, l]) => `<button class="qa" data-act="${a}" ${at}><span class="qa-ic">${icon(ic, 22)}</span><span>${l}</span></button>`).join('')}</div>
    <button class="sos-strip" data-act="svc" data-mod="sos">${icon('warning', 18)} <b>SOS</b> · Emergency mode<span class="grow"></span>${icon('chevright', 18)}</button>
    <div class="list-label">For you</div>
    <div class="home-cards">
      ${card('gotab', 'data-tab="chats"', 'chat', '#1565d8', unread ? `${unread} unread message${unread > 1 ? 's' : ''}` : 'You are all caught up', unread ? `In ${unreadChats.length} chat${unreadChats.length > 1 ? 's' : ''} · ${esc(unreadChats.slice(0, 3).map(chatTitle).join(', '))}` : 'No unread chats')}
      ${sigWait ? card('gochat', `data-chat="${sigWait.c.id}"`, 'draw', '#5e35b1', 'Signature needed', `${esc(senderName(sigWait.m.from))} is waiting for you to sign ${esc(sigWait.m.doc.name)}`) : ''}
      ${scam ? card('gochat', `data-chat="${scam.id}"`, 'warning', '#e53935', 'Possible scam detected', `Anti-scam AI flagged messages from ${esc(chatTitle(scam))}`) : ''}
      ${busy ? card('homesum', `data-chat="${busy.id}"`, 'sparkle', '#7c4dff', 'AI summary ready', `${esc(busy.name)} · ${busy.messages.length} messages summarised for you`) : ''}
      ${card('svc', 'data-mod="pay"', 'rupee', '#00897b', `Wallet ${money(S.wallet)}`, inPay ? `Last received ${money(inPay.amount)} from ${esc(inPay.with)}` : 'Send, scan, recharge and pay bills')}
      ${card('svc', 'data-mod="business"', 'store', '#f4511e', '2 business enquiries', 'AI assistant answered 11 customer questions today')}
      ${fam ? card('svc', 'data-mod="family"', 'event', '#d81b60', esc(fam.title), `Family · ${dayLabel(fam.at)} at ${fmtTime(fam.at)}`) : ''}
      ${card('gotab', 'data-tab="settings" data-page="set-devices"', 'devices', '#3949ab', `${linked} linked device${linked === 1 ? '' : 's'}`, 'Use WHATSMORE on desktop, tablet and web')}
    </div>
    <div class="list-label row-between"><span>Explore WHATSMORE</span><button class="link-btn" data-act="gotab" data-tab="services">See all</button></div>
    <div class="mod-grid compact">${MODULES.slice(0, 9).map(modTile).join('')}</div>
    <div class="hint-box">${icon('lock', 16)}<span>Chat · AI · Pay · Business · Services · Community — one secure app. Personal messages stay end-to-end encrypted.</span></div>
  </div>`;
}

// ---------- SERVICES hub
function tabServices() {
  const pillars = [...new Set(MODULES.map((m) => m.pillar))];
  return `<header class="side-head"><h2>Services</h2><div class="head-actions"><button class="icon-btn" data-act="importchats" title="Import chats" aria-label="Import chats">${icon('importin')}</button></div></header>
  <div class="side-scroll">
    <div class="pillars">${['💬 Chat', '🤖 AI', '💳 Pay', '💼 Business', '🏛️ Services', '🌍 Community'].map((p) => `<span>${p}</span>`).join('')}</div>
    ${pillars.map((p) => `<div class="list-label">${p}</div><div class="mod-grid">${MODULES.filter((m) => m.pillar === p).map(modTile).join('')}</div>`).join('')}
    <div class="list-label">Tools</div>
    <div class="list-row action" data-act="importchats"><span class="action-ic">${icon('importin', 22)}</span><div><div class="ci-name">Import chats</div><div class="ci-sub">Move chat history from apps that let you export it</div></div></div>
    <div class="list-row action" data-act="gotab" data-tab="files"><span class="action-ic">${icon('cloud', 22)}</span><div><div class="ci-name">WHATSMORE Cloud</div><div class="ci-sub">Smart folders, any file type, natural-language search</div></div></div>
  </div>`;
}

// ---------- WHATSMORE AI
const AI_TOOLS = [
  ['sparkle', 'Ask anything', 'What can you do?'],
  ['translate', 'Translate', 'Translate "I will come tomorrow" to Telugu'],
  ['groups', 'Summarize a group', 'What happened in Weekend Trip today?'],
  ['doc', 'Summarize a document', 'Summarize the WHATSMORE PRD'],
  ['edit', 'Write for me', 'Write a professional message to my customer about a delayed order'],
  ['school', 'Learn', 'Explain photosynthesis in simple Telugu'],
  ['poll', 'Create a quiz', 'Create a quiz on the Indian Constitution'],
  ['status', 'AI status creator', 'Create a status: New shop opened today'],
  ['rupee', 'Analyze my spending', 'Analyze my payments'],
  ['warning', 'Is this a scam?', 'Is this a scam: You have won a lottery, share OTP to claim'],
];
function tabAI() {
  return `<header class="side-head"><h2>WHATSMORE AI</h2><div class="head-actions"><button class="pill clickable" data-act="page" data-page="set-ai">Memory ${S.settings.aiMemory ? 'on' : 'off'}</button></div></header>
  <div class="side-scroll">
    <div class="ai-hero">${icon('sparkle', 30)}<div><b>Your personal AI assistant</b><div class="ci-sub">Translate · Summarize · Write · Learn · Analyze · Create</div></div></div>
    ${AI_TOOLS.map(([ic, t, q]) => `<div class="list-row action" data-act="aiask" data-q="${esc(q)}"><span class="action-ic">${icon(ic, 20)}</span><div class="grow"><div class="ci-name">${t}</div><div class="ci-sub">${esc(q)}</div></div></div>`).join('')}
    <div class="hint-box">${icon('shield', 16)}<span>WHATSMORE AI runs through a model-agnostic AI gateway, so providers can change without rebuilding the app. You decide what AI may read in Settings → AI &amp; memory. Demo answers are rule-based.</span></div>
  </div>`;
}
const AI_CHIPS = ['Translate “How are you?” to Hindi', 'What happened in Project WHATSMORE?', 'Explain photosynthesis in simple Telugu', 'Create a quiz on photosynthesis', 'Write a birthday wish'];
const aiWelcome = () => `Hi ${esc(S.me.name.split(' ')[0])}! 👋 I'm <b>WHATSMORE AI</b>. I can translate between 18 languages, summarize chats and documents, draft messages, teach and quiz you, create status posts and check messages for scams. What would you like to do?`;
function aiViewHTML() {
  const msgs = MS('ai', () => [{ from: 'ai', html: aiWelcome(), t: Date.now() }]);
  return `<header class="chat-head view-head"><button class="icon-btn back-btn" data-act="closeview" aria-label="Back">${icon('back')}</button>
    <span class="mod-ic ai">${icon('sparkle', 22)}</span><div class="chat-head-text grow"><div class="chat-head-name">WHATSMORE AI</div><div class="chat-head-sub">${ui.aiTyping ? '<span class="typing-txt">thinking…</span>' : 'Personal assistant · private by design'}</div></div>
    <button class="icon-btn" data-act="aiclear" title="New conversation" aria-label="New conversation">${icon('add')}</button></header>
  <div class="messages-wrap"><div class="messages" id="ai-msgs"><div class="msgs-inner">${msgs.map(aiBubble).join('')}${ui.aiTyping ? '<div class="msg-row in first"><div class="bubble tail"><div class="text"><span class="dots"><i></i><i></i><i></i></span></div></div></div>' : ''}</div></div></div>
  <div class="smart ai-chips">${AI_CHIPS.map((c) => `<button data-act="aiask" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <footer class="composer"><button class="icon-btn" data-act="aimic" title="Speak" aria-label="Speak">${icon('mic')}</button><div class="input-wrap"><textarea id="ai-input" rows="1" placeholder="Ask WHATSMORE AI anything…" aria-label="Ask AI">${esc(ui.aiDraft || '')}</textarea></div><button class="icon-btn send-btn send" data-act="aisend" aria-label="Send">${icon('send')}</button></footer>`;
}
function aiBubble(m) {
  const out = m.from === 'me';
  const body = m.quiz ? quizHTML(m.quiz) : m.html;
  return `<div class="msg-row ${out ? 'out' : 'in'} first"><div class="bubble tail ai-b">${out ? '' : `<div class="bot-tag">${icon('sparkle', 12)} WHATSMORE AI</div>`}<div class="text">${body}<span class="meta-spacer"></span></div><span class="meta"><span>${fmtTime(m.t)}</span></span></div></div>`;
}
function aiAsk(q) {
  q = q.trim();
  if (!q) return;
  const msgs = MS('ai', () => [{ from: 'ai', html: aiWelcome(), t: Date.now() }]);
  msgs.push({ from: 'me', html: esc(q), t: Date.now() });
  ui.aiTyping = true; ui.aiDraft = '';
  if (ui.view !== 'ai') { ui.tab = 'ai'; renderRail(); renderSidebar(); openView('ai'); } else renderView();
  scrollAI();
  setTimeout(() => {
    ui.aiTyping = false;
    const r = aiAnswer(q);
    msgs.push({ from: 'ai', t: Date.now(), ...(typeof r === 'string' ? { html: r } : r) });
    if (msgs.length > 60) msgs.splice(1, msgs.length - 60);
    save();
    if (ui.view === 'ai') { renderView(); scrollAI(); }
  }, 700 + Math.random() * 600);
}
function scrollAI() { const b = $('#ai-msgs'); if (b) b.scrollTop = b.scrollHeight; }
const ul = (arr) => `<ul>${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`;
function aiAnswer(q) {
  const s = q.toLowerCase();
  // translation
  if (/translat|अनुवाद|అనువాద/.test(s)) {
    const quoted = (q.match(/[“"']([^”"']+)[”"']/) || [])[1] || q.replace(/^.*?translate\s*/i, '').replace(/\s+(to|into|in)\s+\w+\s*$/i, '');
    const toName = (s.match(/\b(?:to|into|in)\s+(\w+)\s*$/) || [])[1];
    const lang = LANG_LIST.find(([k, l]) => toName && l.toLowerCase() === toName.toLowerCase());
    const targets = lang ? [lang] : LANG_LIST.filter(([k]) => ['te', 'hi', 'ta', 'kn', 'ml', 'en'].includes(k));
    const rows = targets.map(([k, l]) => { const r = translateText(quoted, k); return r ? `<b>${l}:</b> ${esc(r.text)}` : null; }).filter(Boolean);
    if (rows.length) return `🌍 Translation of “${esc(quoted)}”` + ul(rows) + '<span class="ci-sub">Each person can read the chat in their own language — the original is always kept.</span>';
    return `I can translate any message in production. In this demo try phrases like “How are you?”, “I will come tomorrow”, “Thank you”, “Good morning”, “Where are you?” — into ${LANG_LIST.length} languages including Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Arabic and Japanese.`;
  }
  // scam check
  if (/scam|fraud|safe\?|phishing/.test(s)) {
    const text = q.split(/:\s*/).slice(1).join(': ') || q;
    const r = scamCheck(text);
    return r.length ? `⚠️ <b>Potentially suspicious.</b> I noticed:${ul(r.map(esc))}Don't click links, share OTPs or send money until you verify the sender through an official channel.` : '✅ I didn\'t find common scam signals in that text. Still, never share OTPs or PINs with anyone.';
  }
  // summaries of chats
  if (/summar|what happened|catch me up|decisions|pending tasks/.test(s) && !/pdf|document|prd|doc\b/.test(s)) {
    const ch = S.chats.filter((c) => !c.locked).map((c) => [c, chatTitle(c).toLowerCase().replace(/\p{Extended_Pictographic}/gu, '').trim()]).find(([, t]) => t && s.includes(t.split(' ')[0]))?.[0]
      || S.chats.filter((c) => c.type === 'group' && !c.locked).sort((a, b) => lastTime(b) - lastTime(a))[0];
    const sm = summarize(ch);
    const li = (arr) => arr.map((l) => `<b>${esc(firstName(l.m.from))}:</b> ${esc(l.s)}`);
    const parts = [
      sm.decisions.length && ['✅ Decisions', li(sm.decisions)], sm.tasks.length && ['📝 Pending tasks', li(sm.tasks)], sm.dates.length && ['📅 Dates & meetings', li(sm.dates)],
      sm.announcements.length && ['📢 Announcements', li(sm.announcements)], sm.polls.length && ['📊 Polls', sm.polls.map(esc)], sm.pays.length && ['💳 Payments', sm.pays.map(esc)], sm.files.length && ['📎 Files', sm.files.map(esc)],
    ].filter(Boolean);
    return `✨ <b>${esc(chatTitle(ch))}</b> · ${sm.count} messages from ${esc(sm.people.slice(0, 5).join(', '))}` + parts.map(([t, l]) => `<div class="sum-title">${t}</div>${ul(l)}`).join('') + `<button class="link-btn" data-act="gochat" data-chat="${ch.id}">Open chat →</button>`;
  }
  // documents
  if (/pdf|document|prd|doc\b|chapter/.test(s) && /summar|explain|key points/.test(s)) {
    const d = document.createElement('div');
    d.innerHTML = demoDocHTML({ name: 'WHATSMORE_PRD_v2.pdf', ext: 'pdf' });
    const sm = summarizeDoc(d);
    return `📄 <b>WHATSMORE_PRD_v2.pdf</b> (18 pages) — summary` + `<p>${esc(sm.summary)}</p><div class="sum-title">📌 Key points</div>${ul(sm.points.map(esc))}<div class="sum-title">📅 Deadlines</div>${ul(sm.dates.map(esc))}<span class="ci-sub">Tip: open any document in a chat → <b>Edit &amp; AI-correct</b> to proofread it.</span>`;
  }
  // learning
  if (/explain|teach|simple|easy/.test(s)) {
    const lang = /telugu|తెలుగు/.test(s) ? 'te' : /hindi|हिंदी/.test(s) ? 'hi' : 'en';
    const topic = /constitution/.test(s) ? 'constitution' : 'photosynthesis';
    return `📚 <b>${TOPICS[topic].title}</b> — ${LANG_LIST.find((l) => l[0] === lang)[1]}<p>${esc(TOPICS[topic].explain[lang])}</p><button class="link-btn" data-act="aiask" data-q="Create a quiz on ${topic}">Test me with a quiz →</button>`;
  }
  if (/quiz|mcq|questions|test me/.test(s)) {
    const topic = /constitution/.test(s) ? 'constitution' : 'photosynthesis';
    const id = 'q' + uid();
    MS('quiz', () => ({}))[id] = { topic, answers: {} };
    return { quiz: id };
  }
  // status / poster creator
  if (/status|poster|advert|ad for|shop opened|announce/.test(s)) {
    const idea = (q.split(/:\s*/)[1] || 'New shop opened today').trim();
    return `🎨 <b>AI status creator</b><div class="ai-poster"><div class="ap-big">🎉 ${esc(idea)}!</div><div>Visit us today · Special opening offers</div></div>
      ${ul([`<b>English:</b> 🎉 ${esc(idea)}! Come visit us — special opening offers all week.`, '<b>Telugu:</b> 🎉 మా కొత్త షాప్ ఈరోజు ప్రారంభమైంది! ఈ వారం ప్రత్యేక ఆఫర్లు — తప్పకుండా రండి.', '<b>Hindi:</b> 🎉 हमारी नई दुकान आज खुल गई है! पूरे हफ्ते खास ऑफ़र — ज़रूर आइए।'])}
      <button class="btn sm primary" data-act="aipoststatus" data-text="${esc('🎉 ' + idea + '! Come visit us — special opening offers all week.')}">Post as my status</button>`;
  }
  // spending
  if (/spend|expense|payment|money|budget/.test(s)) {
    const out = S.payments.filter((p) => p.dir === 'out'), inn = S.payments.filter((p) => p.dir === 'in');
    const total = out.reduce((a, p) => a + p.amount, 0), got = inn.reduce((a, p) => a + p.amount, 0);
    const top = Object.entries(out.reduce((o, p) => { o[p.with] = (o[p.with] || 0) + p.amount; return o; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `💳 <b>Your payments</b>${ul([`Spent ${money(total)} in ${out.length} payment${out.length === 1 ? '' : 's'}`, `Received ${money(got)} in ${inn.length} payment${inn.length === 1 ? '' : 's'}`, `Balance ${money(S.wallet)}`, ...top.map(([w, a]) => `Top: ${esc(w)} — ${money(a)}`)])}`;
  }
  // writing
  if (/write|draft|email|message to|wish|letter|reply/.test(s)) {
    let t;
    if (/birthday/.test(s)) t = 'Happy birthday! 🎉 Wishing you a wonderful year full of health, happiness and success. Have a great day!';
    else if (/customer|order|delay/.test(s)) t = 'Dear Customer,\n\nThank you for your order. Due to high demand, your delivery is delayed by one day and will reach you tomorrow by 6 PM. We sincerely apologise for the inconvenience and have added a 10% discount to your next order.\n\nWarm regards,\nTeam ' + S.me.name;
    else if (/leave/.test(s)) t = 'Dear Sir/Madam,\n\nI request leave on Friday due to a family function. I will complete my pending work before leaving and stay reachable on WHATSMORE.\n\nThank you,\n' + S.me.name;
    else t = 'Hi! Hope you are doing well. I wanted to follow up on our last conversation — let me know a good time to talk this week. Thanks! 😊';
    return `✍️ <b>Draft</b><div class="ai-draft">${esc(t).replace(/\n/g, '<br>')}</div><button class="link-btn" data-act="aicopy" data-text="${esc(t)}">Copy</button> <button class="link-btn" data-act="aisendto" data-text="${esc(t)}">Send to a chat →</button>`;
  }
  if (/remind/.test(s)) {
    const fam = MS('family', seedFamily);
    const ev = { id: uid(), title: q.replace(/.*remind me (to )?/i, '').replace(/^./, (c) => c.toUpperCase()) || 'Reminder', at: Date.now() + DAY };
    fam.events.push(ev); save();
    return `⏰ Reminder set for tomorrow at ${fmtTime(ev.at)}: <b>${esc(ev.title)}</b>. You'll find it in Family Hub.`;
  }
  return `Here's what I can do:${ul(['🌍 <b>Translate</b> — “Translate Thank you to Tamil”', '🧠 <b>Summarize</b> — “What happened in Weekend Trip?”', '📄 <b>Documents</b> — “Summarize the PRD”', '✍️ <b>Write</b> — “Write a message to my customer”', '📚 <b>Learn</b> — “Explain photosynthesis in simple Telugu”', '🎨 <b>Create</b> — “Create a status: New shop opened today”', '🛡️ <b>Safety</b> — “Is this a scam: …”'])}<span class="ci-sub">Demo AI is rule-based. Production connects to a privacy-preserving model through the WHATSMORE AI gateway.</span>`;
}
const TOPICS = {
  photosynthesis: {
    title: 'Photosynthesis',
    explain: {
      en: 'Photosynthesis is how plants make their own food. Using sunlight, water and carbon dioxide, the green pigment chlorophyll in leaves makes glucose (food) and releases oxygen — the air we breathe. 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.',
      te: 'కిరణజన్య సంయోగక్రియ అంటే మొక్కలు సూర్యరశ్మి, నీరు, కార్బన్ డయాక్సైడ్ ఉపయోగించి తమ ఆహారం (గ్లూకోజ్) తయారు చేసుకోవడం. ఈ పని ఆకుల్లో ఉండే పచ్చని పదార్థం క్లోరోఫిల్ సహాయంతో జరుగుతుంది. ఈ ప్రక్రియలో మొక్కలు ఆక్సిజన్‌ను విడుదల చేస్తాయి — మనం పీల్చే గాలి అదే!',
      hi: 'प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे सूरज की रोशनी, पानी और कार्बन डाइऑक्साइड से अपना भोजन (ग्लूकोज़) बनाते हैं। यह काम पत्तियों में मौजूद हरे पदार्थ क्लोरोफिल की मदद से होता है। इसमें पौधे ऑक्सीजन छोड़ते हैं — वही हवा जिसमें हम सांस लेते हैं!',
    },
    qs: [['Which pigment captures sunlight?', ['Chlorophyll', 'Haemoglobin', 'Melanin', 'Keratin'], 0], ['Which gas do plants take in?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1], ['What food does the plant make?', ['Protein', 'Fat', 'Glucose', 'Vitamin C'], 2], ['Where does it mainly happen?', ['Roots', 'Stem', 'Leaves', 'Flowers'], 2], ['Which gas is released?', ['Oxygen', 'Carbon dioxide', 'Methane', 'Ammonia'], 0]],
  },
  constitution: {
    title: 'The Constitution of India',
    explain: {
      en: 'The Constitution of India came into effect on 26 January 1950. Dr B. R. Ambedkar chaired its Drafting Committee. Part III gives Fundamental Rights, Part IV the Directive Principles, and Article 32 lets citizens go to the Supreme Court to protect their rights.',
      te: 'భారత రాజ్యాంగం 26 జనవరి 1950 నుండి అమల్లోకి వచ్చింది. డా. బి. ఆర్. అంబేద్కర్ ముసాయిదా కమిటీకి అధ్యక్షత వహించారు. మూడవ భాగంలో ప్రాథమిక హక్కులు, నాలుగవ భాగంలో ఆదేశిక సూత్రాలు ఉన్నాయి.',
      hi: 'भारत का संविधान 26 जनवरी 1950 को लागू हुआ। डॉ. बी. आर. आंबेडकर मसौदा समिति के अध्यक्ष थे। भाग III में मौलिक अधिकार और भाग IV में नीति निदेशक तत्व हैं।',
    },
    qs: [['When did the Constitution of India come into effect?', ['15 Aug 1947', '26 Jan 1950', '26 Nov 1949', '2 Oct 1950'], 1], ['Who chaired the Drafting Committee?', ['Jawaharlal Nehru', 'B. R. Ambedkar', 'Rajendra Prasad', 'Sardar Patel'], 1], ['Fundamental Rights are in which Part?', ['Part III', 'Part IV', 'Part I', 'Part V'], 0], ['Right to Constitutional Remedies is Article…', ['14', '19', '21', '32'], 3], ['Directive Principles are in which Part?', ['Part II', 'Part III', 'Part IV', 'Part VI'], 2]],
  },
};
function quizHTML(id) {
  const st = MS('quiz', () => ({}))[id];
  if (!st) return '';
  const qs = TOPICS[st.topic].qs, done = Object.keys(st.answers).length;
  const score = Object.entries(st.answers).filter(([i, a]) => qs[i][2] === a).length;
  return `📝 <b>Quiz · ${TOPICS[st.topic].title}</b> <span class="ci-sub">${done}/${qs.length} answered</span>` + qs.map(([q, opts, ans], i) => {
    const a = st.answers[i];
    return `<div class="quiz-q"><div><b>${i + 1}.</b> ${esc(q)}</div><div class="quiz-opts">${opts.map((o, j) => `<button class="qopt ${a != null ? (j === ans ? 'right' : j === a ? 'wrong' : '') : ''}" data-act="quizpick" data-quiz="${id}" data-i="${i}" data-o="${j}" ${a != null ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div></div>`;
  }).join('') + (done === qs.length ? `<div class="quiz-score">🏆 Score: ${score}/${qs.length} ${score === qs.length ? '— perfect!' : score >= 3 ? '— well done!' : '— review and try again'}</div>` : '');
}
Object.assign(XA, {
  aiask(el) { aiAsk(el.dataset.q); },
  aisend() { const i = $('#ai-input'); if (i) aiAsk(i.value); },
  aiclear() { S.mod.ai = null; save(); renderView(); },
  aicopy(el) { copyText(el.dataset.text); },
  aisendto(el) { const t = el.dataset.text; chatPicker('Send draft to…', (chats) => { chats.forEach((c) => sendMsg(c, { type: 'text', text: t })); toast('Draft sent'); }); },
  aipoststatus(el) { S.myStatus.items.push({ type: 'text', text: el.dataset.text, bg: '#7c4dff', t: Date.now(), privacy: 'everyone' }); save(); renderRail(); toast('Posted to your status · visible to Everyone'); },
  quizpick(el) {
    const st = MS('quiz', () => ({}))[el.dataset.quiz];
    if (!st || st.answers[el.dataset.i] != null) return;
    st.answers[el.dataset.i] = +el.dataset.o; save();
    if (ui.view === 'ai') { const sc = $('#ai-msgs').scrollTop; renderView(); $('#ai-msgs').scrollTop = sc; } else rerenderView();
  },
  aimic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('Voice input is not supported in this browser — try Chrome');
    const r = new SR();
    r.lang = 'en-IN'; r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0][0].transcript; aiAsk(t); };
    r.onerror = () => toast('Could not hear you — check microphone permission');
    r.start();
    toast('🎙️ Listening… speak now');
  },
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'ai-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); aiAsk(e.target.value); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'ai-input') { ui.aiDraft = e.target.value; autosize(e.target); } });

// ---------- PAY
function payFlow({ to, amount, note, onDone }) {
  if (!(amount > 0)) return toast('Enter an amount');
  if (amount > S.wallet) return toast('Insufficient demo balance');
  modal({
    title: 'Confirm payment',
    body: `<div class="pay-confirm"><div class="muted">Paying ${esc(to)}</div><div class="pay-amount big">${money(amount)}</div>${note ? `<div class="muted">${esc(note)}</div>` : ''}
      <label class="field"><span>Enter UPI PIN (any 4–6 digits)</span><input id="upi-pin" class="pin-input" type="password" inputmode="numeric" maxlength="6" autocomplete="off" autofocus></label>
      <p class="muted small">${icon('shield', 14)} Payments use separate, hardened authorisation — never your chat login.</p></div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Pay ' + money(amount), primary: true, onClick: (root) => {
        if (!/^\d{4,6}$/.test($('#upi-pin', root).value)) { toast('Enter your 4–6 digit UPI PIN'); return false; }
        S.wallet -= amount;
        S.payments.push({ id: uid(), dir: 'out', amount, with: to, note: note || 'Payment', t: Date.now() });
        save();
        setTimeout(() => {
          modal({ title: 'Payment successful', body: `<div class="pay-done"><div class="tick-anim">${icon('check', 46)}</div><div class="pay-amount big">${money(amount)}</div><div class="muted">Paid to ${esc(to)}</div><div class="ci-sub">UPI ref ${Math.floor(1e11 + Math.random() * 8e11)} · ${fmtStamp(Date.now())}</div></div>`, actions: [{ label: 'Done', primary: true }] });
          onDone && onDone();
          if (ui.view === 'mod:pay') rerenderView();
        }, 0);
      },
    }],
    onMount: (root) => $('#upi-pin', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-mact="1"]', root).click(); }),
  });
}
const BILLERS = [['⚡', 'Electricity', 'State Electricity Board', 1240], ['💧', 'Water', 'Municipal Water Board', 380], ['📺', 'DTH', 'DTH Recharge', 449], ['🌐', 'Broadband', 'Fibre Internet', 799], ['🔥', 'Gas cylinder', 'LPG booking', 905], ['🚗', 'FASTag', 'FASTag recharge', 500]];
function modPay() {
  const hist = S.payments.slice().sort((a, b) => b.t - a.t).slice(0, 8);
  return `<div class="wallet-card"><div class="ci-sub">WHATSMORE Pay balance (demo)</div><div class="wallet-amt">${money(S.wallet)}</div><div class="ci-sub">UPI ID ${esc(S.me.username)}@whatsmore</div></div>
  <div class="act-grid">${[['payscan', 'qr', 'Scan & pay'], ['payuser', 'person', 'Pay @username'], ['payrequest', 'callin', 'Request money'], ['paysplit', 'groups', 'Split a bill'], ['payrecharge', 'phone', 'Mobile recharge'], ['paymyqr', 'qr', 'Receive (my QR)']].map(([a, ic, l]) => `<button class="act" data-act="${a}"><span class="act-ic">${icon(ic, 22)}</span>${l}</button>`).join('')}</div>
  ${sec('Pay bills', `<div class="biller-grid">${BILLERS.map(([e, n, s], i) => `<button class="biller" data-act="paybill" data-i="${i}"><span class="big-emoji">${e}</span><b>${n}</b><span class="ci-sub">${s}</span></button>`).join('')}</div>`)}
  ${sec('Transaction history', hist.length ? hist.map((p) => `<div class="set-row"><span class="pay-ic ${p.dir}">${icon(p.dir === 'in' ? 'callin' : 'callout', 18)}</span><div class="grow"><div class="ci-name">${p.dir === 'in' ? 'Received from' : 'Paid to'} ${esc(p.with)}</div><div class="ci-sub">${esc(p.note || '')} · ${fmtStamp(p.t)}</div></div><b class="${p.dir === 'in' ? 'green' : ''}">${p.dir === 'in' ? '+' : '−'}${money(p.amount)}</b></div>`).join('') : '<p class="muted">No payments yet</p>')}
  ${note('Demo only — no real money moves. A real launch integrates licensed payment partners and follows RBI, NPCI, KYC and AML rules.')}`;
}
Object.assign(XA, {
  payscan() {
    modal({
      title: 'Scan & pay', body: `<div class="scan-box demo"><div class="scan-frame"></div><div class="scan-msg">Point your camera at any UPI / WHATSMORE QR</div></div><p class="muted small">Demo: choose a merchant QR to simulate scanning.</p><div class="chips wrap">${['Sunrise Bakery', 'Glow Salon', 'Metro Kirana Store', 'Auto-rickshaw driver'].map((m) => `<button class="chip" data-merchant="${esc(m)}">${esc(m)}</button>`).join('')}</div>`,
      actions: [{ label: 'Close' }],
      onMount: (root, close) => root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-merchant]');
        if (!b) return;
        close();
        amountModal(`Pay ${b.dataset.merchant}`, (amt, nt) => payFlow({ to: b.dataset.merchant, amount: amt, note: nt || 'QR payment' }));
      }),
    });
  },
  payuser() {
    modal({
      title: 'Pay @username', body: `<label class="field"><span>Username</span><div class="un-input"><b>@</b><input id="pu-un" placeholder="priya.s" autocapitalize="off" autofocus></div><small class="un-status" id="pu-who"></small></label><label class="field"><span>Amount (₹)</span><input id="pu-amt" type="number" min="1" inputmode="decimal"></label><label class="field"><span>Note</span><input id="pu-note" maxlength="60"></label>`,
      actions: [{ label: 'Cancel' }, { label: 'Continue', primary: true, onClick: (root) => { const u = [...S.contacts, ...S.directory].find((x) => x.username === $('#pu-un', root).value.trim().toLowerCase().replace(/^@/, '')); if (!u) { toast('No WHATSMORE user with that username'); return false; } setTimeout(() => payFlow({ to: u.name + ' (@' + u.username + ')', amount: +$('#pu-amt', root).value, note: $('#pu-note', root).value.trim() }), 0); } }],
      onMount: (root) => $('#pu-un', root).addEventListener('input', (e) => { const u = [...S.contacts, ...S.directory].find((x) => x.username === e.target.value.trim().toLowerCase().replace(/^@/, '')); $('#pu-who', root).className = 'un-status ' + (u ? 'ok' : ''); $('#pu-who', root).textContent = u ? '✓ ' + u.name + ' · phone number stays private' : ''; }),
    });
  },
  payrequest() { chatPicker('Request money from…', (chats) => { setTimeout(() => { openChat(chats[0].id); payModal(chats[0]); }, 0); }, { single: true, label: 'Next' }); },
  paysplit() { const groups = S.chats.filter((c) => c.type === 'group' && !c.left && c.members.length); const g = groups.find((c) => c.id === 'ch_trip') || groups[0]; if (g) { openChat(g.id); payModal(g); } },
  paymyqr() { modal({ title: 'Receive money', body: `<div class="qr-card">${avatarHTML(S.me, 56)}<div class="pc-name">${esc(S.me.name)}</div><div class="accent">${esc(S.me.username)}@whatsmore</div><div id="pq" class="qr-box"></div><p class="muted small">Anyone can scan to pay you — your phone number stays private.</p></div>`, actions: [{ label: 'Done', primary: true }], onMount: (root) => drawQR($('#pq', root), `upi://pay?pa=${S.me.username}@whatsmore&pn=${encodeURIComponent(S.me.name)}`) }); },
  payrecharge() {
    const plans = [[199, '1.5 GB/day · 28 days'], [299, '2 GB/day · 28 days'], [719, '2 GB/day · 84 days'], [2999, '2.5 GB/day · 365 days']];
    modal({
      title: 'Mobile recharge', body: `<label class="field"><span>Mobile number</span><input id="rc-n" inputmode="tel" maxlength="10" placeholder="98xxxxxx10" autofocus></label><label class="field"><span>Operator</span><select id="rc-op"><option>Jio</option><option>Airtel</option><option>Vi</option><option>BSNL</option></select></label><div class="list-label pad0">Popular plans</div>${plans.map(([p, d], i) => `<label class="radio-row"><input type="radio" name="rcp" value="${p}" ${i === 1 ? 'checked' : ''}> <b>₹${p}</b> <span class="muted small">${d}</span></label>`).join('')}`,
      actions: [{ label: 'Cancel' }, { label: 'Recharge', primary: true, onClick: (root) => { const n = $('#rc-n', root).value; if (!/^\d{10}$/.test(n)) { toast('Enter a 10-digit mobile number'); return false; } const amt = +$('input[name=rcp]:checked', root).value; setTimeout(() => payFlow({ to: `${$('#rc-op', root).value} recharge · ${n}`, amount: amt, note: 'Mobile recharge' }), 0); } }],
    });
  },
  paybill(el) {
    const [e, n, s, amt] = BILLERS[+el.dataset.i];
    modal({
      title: `${e} ${n} bill`, body: `<label class="field"><span>${n === 'Electricity' || n === 'Water' ? 'Consumer number' : 'Account / ID'}</span><input id="bl-id" placeholder="e.g. 1102938475" autofocus></label><div id="bl-out"></div>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Fetch bill', primary: true, onClick: (root) => {
          if (!$('#bl-id', root).value.trim()) { toast('Enter your consumer number'); return false; }
          const out = $('#bl-out', root);
          if (!out.dataset.ok) { out.dataset.ok = 1; out.innerHTML = `<div class="bill-card"><div class="row-between"><b>${esc(s)}</b><span class="pill">Verified biller</span></div><div class="ci-sub">Customer: ${esc(S.me.name)} · Due in 6 days</div><div class="pay-amount">${money(amt)}</div></div>`; $('[data-mact="1"]', root).textContent = 'Pay ' + money(amt); return false; }
          setTimeout(() => payFlow({ to: s, amount: amt, note: `${n} bill · ${$('#bl-id', root).value.trim()}` }), 0);
        },
      }],
    });
  },
});
function amountModal(title, cb) {
  modal({ title, body: `<label class="field"><span>Amount (₹)</span><input id="am-v" type="number" min="1" inputmode="decimal" autofocus></label><label class="field"><span>Note</span><input id="am-n" maxlength="60"></label>`, actions: [{ label: 'Cancel' }, { label: 'Continue', primary: true, onClick: (root) => { const a = +$('#am-v', root).value; if (!(a > 0)) { toast('Enter an amount'); return false; } setTimeout(() => cb(a, $('#am-n', root).value.trim()), 0); } }] });
}

// ---------- BUSINESS (your own business dashboard)
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
  faqs: [['hours|open|timing|time', 'We are open Monday–Saturday, 10 AM – 7 PM.'], ['price|cost|rate|charge', 'Logo design starts at ₹2,499 and brand kits at ₹7,999.'], ['deliver|days|how long|time take', 'Most projects are delivered in 5–7 working days.'], ['appointment|book|meet|call', 'You can book a free 30-minute consultation — reply with a time that suits you.']],
});
function modBusiness() {
  const b = MS('biz', seedBiz);
  const rev = [6200, 8100, 5400, 9800, 7300, 11200, 8450], max = Math.max(...rev);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * DAY).toLocaleDateString([], { weekday: 'short' }));
  return `<div class="biz-head">${avatarHTML({ name: S.me.name + ' Designs', color: '#f4511e', emoji: '🎨' }, 56)}<div class="grow"><div class="ci-name">${esc(S.me.name)} Designs ${icon('verified', 16, 'accent')}</div><div class="ci-sub">Design studio · Hyderabad · Mon–Sat 10 AM – 7 PM · WHATSMORE Pay, UPI</div></div><button class="btn sm" data-act="setprofile" data-p="business">Use business profile</button></div>
  <div class="kpi-grid">${kpi("Today's revenue", money(8450), '+18%')}${kpi('Orders', '14', '+4')}${kpi('New customers', '6', '+2')}${kpi('AI answered', '11 / 13', '85%')}</div>
  ${sec('Revenue · last 7 days', `<div class="bars">${rev.map((v, i) => `<div class="bar-col"><div class="bar-v" style="height:${(v / max) * 100}%" title="${money(v)}"></div><span>${days[i]}</span></div>`).join('')}</div>`)}
  ${sec('Orders', b.orders.map((o) => `<div class="set-row"><div class="grow"><div class="ci-name">${esc(o.id)} · ${esc(o.who)}</div><div class="ci-sub">${esc(o.items)} · ${money(o.total)} · ${listTime(o.t)}</div></div><span class="pill step-${o.step}">${ORDER_STEPS[o.step]}</span>${o.step < 3 ? `<button class="btn sm" data-act="bizstep" data-o="${o.id}">→ ${ORDER_STEPS[o.step + 1]}</button>` : `<button class="btn sm" data-act="bizinv" data-o="${o.id}">Invoice</button>`}</div>`).join(''))}
  ${sec('Appointments today', b.appts.map(([t, w, d]) => `<div class="set-row"><span class="time-chip">${t}</span><div class="grow"><div class="ci-name">${esc(w)}</div><div class="ci-sub">${esc(d)}</div></div><span class="pill">Confirmed</span></div>`).join(''))}
  ${sec('AI customer assistant', `<label class="set-row"><div><div class="ci-name">Auto-reply with AI</div><div class="ci-sub">Answers hours, prices, delivery and bookings 24×7</div></div><input type="checkbox" class="switch" id="biz-ai" ${b.aiOn ? 'checked' : ''}></label>
    ${b.faqs.map(([k, a], i) => `<div class="faq"><span class="pill">${esc(k.split('|')[0])}</span><span class="grow small">${esc(a)}</span><button class="icon-btn sm" data-act="bizfaqdel" data-i="${i}" aria-label="Remove">${icon('close', 16)}</button></div>`).join('')}
    <button class="link-btn" data-act="bizfaqadd">+ Add answer</button>
    <div class="ai-test"><input id="biz-q" placeholder="Test it: “How much is a logo?”"><button class="btn sm primary" data-act="biztest">Ask</button></div><div id="biz-a"></div>`)}
  ${note('Customer journey: Product → Chat → Enquiry → Order → Payment → Invoice, all inside WHATSMORE. Try it with Sunrise Bakery or any Marketplace seller.', 'store')}`;
}
Object.assign(XA, {
  bizstep(el) { const o = MS('biz', seedBiz).orders.find((x) => x.id === el.dataset.o); if (o && o.step < 3) { o.step++; save(); rerenderView(); toast(`${o.id} → ${ORDER_STEPS[o.step]} · customer notified on WHATSMORE`); } },
  bizinv(el) { const o = MS('biz', seedBiz).orders.find((x) => x.id === el.dataset.o); modal({ title: 'Invoice ' + o.id, body: `<div class="invoice"><div class="inv-head">${icon('receipt', 18)} ${esc(S.me.name)} Designs<span class="paid-stamp">PAID</span></div><div class="inv-row"><span>${esc(o.items)}</span><span>${money(o.total)}</span></div><div class="inv-row"><span>GST (18%, included)</span><span>${money(Math.round(o.total * 0.18 / 1.18))}</span></div><div class="inv-row total"><span>Total</span><span>${money(o.total)}</span></div><div class="ci-sub">Billed to ${esc(o.who)} · ${fmtStamp(o.t)}</div></div>`, actions: [{ label: 'Send to customer', onClick: () => toast('Invoice sent to ' + o.who) }, { label: 'Done', primary: true }] }); },
  biztest() { const q = $('#biz-q')?.value.toLowerCase() || ''; const b = MS('biz', seedBiz); const hit = b.faqs.find(([k]) => new RegExp(k).test(q)); $('#biz-a').innerHTML = `<div class="bubble-demo">${icon('sparkle', 14)} ${esc(hit ? hit[1] : "Thanks for your message! I'll connect you with the owner shortly.")}</div>`; },
  bizfaqdel(el) { MS('biz', seedBiz).faqs.splice(+el.dataset.i, 1); save(); rerenderView(); },
  bizfaqadd() { modal({ title: 'Add AI answer', body: '<label class="field"><span>When customers ask about (keywords)</span><input id="fq-k" placeholder="e.g. refund, return" autofocus></label><label class="field"><span>AI answers</span><textarea id="fq-a" rows="3"></textarea></label>', actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const k = $('#fq-k', root).value.trim().split(/\s*,\s*/).filter(Boolean).map(escRe).join('|'), a = $('#fq-a', root).value.trim(); if (!k || !a) return false; MS('biz', seedBiz).faqs.push([k, a]); save(); rerenderView(); } }] }); },
});
document.addEventListener('change', (e) => { if (e.target.id === 'biz-ai') { MS('biz', seedBiz).aiOn = e.target.checked; save(); toast(e.target.checked ? 'AI assistant on' : 'AI assistant off'); } });

// ---------- MARKETPLACE (sellers are business accounts you can chat with)
const SELLERS = {
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
};
const MARKET_CATS = [['all', 'All'], ['shopping', '🛍️ Shopping'], ['food', '🍛 Food'], ['travel', '✈️ Travel'], ['tickets', '🎟️ Tickets'], ['home', '🔧 Home services'], ['services', '💇 Services'], ['local', '🏪 Local shops']];
function ensureSeller(id) {
  const sdef = SELLERS[id];
  if (!sdef) return contact(id);
  if (!S.catalog[id]) S.catalog[id] = sdef.products.map((p) => ({ ...p }));
  let c = contact(id);
  if (!c) { c = { id, name: sdef.name, username: sdef.username, about: sdef.about, color: sdef.color, emoji: sdef.emoji, isContact: false, online: true, business: { category: sdef.category, address: sdef.address, hours: sdef.hours, website: sdef.username + '.example', payments: 'WHATSMORE Pay · UPI', verified: true } }; S.contacts.push(c); }
  return c;
}
function sellerChat(id) {
  const c = ensureSeller(id);
  let ch = directChatFor(id);
  if (!ch) {
    ch = { id: 'ch_' + uid(), type: 'direct', contactId: id, unread: 0, messages: [
      { id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' },
      { id: uid(), from: id, type: 'text', text: `Welcome to ${c.name} ${c.emoji} I'm the AI assistant — ask about products, prices, availability, timings or orders.`, t: Date.now() + 1, status: 'read', reactions: {}, bot: true },
    ] };
    S.chats.push(ch);
  }
  save();
  return ch;
}
// Business AI for marketplace sellers: availability → price → "book one L size" → order + payment request
function sellerReply(ch, c, trig) {
  if (trig.type !== 'text') return null;
  const prods = S.catalog[c.id] || [], t = trig.text.toLowerCase();
  let p = prods.find((x) => x.name.toLowerCase().split(/[\s&·]+/).some((w) => w.length > 3 && t.includes(w)));
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
const _bizReply = bizReply;
bizReply = function (ch, trig) { const c = contact(ch.contactId); if (SELLERS[c.id]) { const r = sellerReply(ch, c, trig); if (r) return r; } return _bizReply(ch, trig); };
function allListings() {
  const out = [];
  Object.entries(SELLERS).forEach(([id, s]) => s.products.forEach((p) => out.push({ p, seller: id, sname: s.name, cat: s.cat })));
  (S.catalog.c_bakery || []).forEach((p) => out.push({ p, seller: 'c_bakery', sname: 'Sunrise Bakery', cat: 'local' }));
  return out;
}
function modMarket() {
  const st = MS('market', () => ({ cat: 'all', orders: [] }));
  const q = (ui.mq || '').toLowerCase();
  const list = allListings().filter((x) => (st.cat === 'all' || x.cat === st.cat || (st.cat === 'food' && x.seller === 'c_bakery')) && (!q || (x.p.name + ' ' + x.sname).toLowerCase().includes(q)));
  return `<div class="search">${icon('search', 18)}<input id="mk-q" placeholder="Search products, food, tickets, services…" value="${esc(ui.mq || '')}" autocomplete="off"></div>
  <div class="chips wrap mt">${MARKET_CATS.map(([k, l]) => `<button class="chip ${st.cat === k ? 'on' : ''}" data-act="mkcat" data-c="${k}">${l}</button>`).join('')}</div>
  ${st.orders.length ? sec('My orders', st.orders.slice().reverse().map(orderRowHTML).join('')) : ''}
  <div class="prod-grid">${list.map(({ p, seller, sname }) => `<div class="prod"><div class="prod-art big" style="background:${p.bg}">${p.emoji}</div><div class="ci-name small2">${esc(p.name)}</div><div class="ci-sub">${esc(sname)} ${icon('verified', 12, 'accent')}${p.rating ? ` · ⭐ ${p.rating}` : ''}</div><div class="row-between"><b>${money(p.price)}</b>${p.stock ? '' : '<span class="pill">Sold out</span>'}</div>
    <div class="prod-acts"><button class="btn sm" data-act="mkchat" data-s="${seller}">${icon('chat', 14)} Chat</button>${p.stock ? `<button class="btn sm primary" data-act="mkbuy" data-s="${seller}" data-p="${p.id}">Buy</button>` : ''}</div></div>`).join('') || '<p class="muted">Nothing found</p>'}</div>
  ${note('Search → Discover → Chat with seller → Order → Pay → Delivery → Review. Every seller is a verified business account with an AI assistant.', 'cart')}`;
}
const TRACK = ['Ordered', 'Packed', 'On the way', 'Delivered'];
function orderRowHTML(o) {
  const step = Math.min(3, Math.floor((Date.now() - o.t) / 20000));
  return `<div class="order-row"><div class="prod-art" style="background:${o.bg}">${o.emoji}</div><div class="grow"><div class="ci-name small2">${esc(o.name)}</div><div class="ci-sub">${esc(o.sname)} · ${money(o.price)} · ${o.id}</div>
    <div class="track">${TRACK.map((s, i) => `<span class="${i <= step ? 'on' : ''}">${s}</span>`).join('')}</div>
    ${step === 3 ? (o.rating ? `<div class="ci-sub">Your review: ${'⭐'.repeat(o.rating)}</div>` : `<div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-act="mkrate" data-o="${o.id}" data-r="${n}" aria-label="${n} stars">☆</button>`).join('')} <span class="ci-sub">Rate your order</span></div>`) : ''}</div></div>`;
}
Object.assign(XA, {
  mkcat(el) { MS('market', () => ({ cat: 'all', orders: [] })).cat = el.dataset.c; save(); rerenderView(); },
  mkchat(el) { const ch = sellerChat(el.dataset.s); ui.tab = 'chats'; renderRail(); renderSidebar(); openChat(ch.id); },
  mkbuy(el) {
    const x = allListings().find((l) => l.p.id === el.dataset.p);
    payFlow({ to: x.sname, amount: x.p.price, note: x.p.name, onDone: () => {
      const st = MS('market', () => ({ cat: 'all', orders: [] }));
      st.orders.push({ id: 'OD' + Math.floor(1e5 + Math.random() * 9e5), name: x.p.name, emoji: x.p.emoji, bg: x.p.bg, price: x.p.price, sname: x.sname, t: Date.now() });
      save(); rerenderView();
      toast('🧾 Order placed · invoice sent to your chat with ' + x.sname);
      const ch = x.seller === 'c_bakery' ? chatById('ch_bakery') : sellerChat(x.seller);
      if (ch) { ch.messages.push({ id: uid(), from: ch.contactId, type: 'invoice', orderId: 'OD' + Math.floor(Math.random() * 1e5), items: [{ name: x.p.name, qty: 1, price: x.p.price }], total: x.p.price, t: Date.now(), status: 'read', reactions: {}, bot: true }); ch.unread = (ch.unread || 0) + 1; save(); refreshSidebar(); renderRail(); }
    } });
  },
  mkrate(el) { const o = MS('market', () => ({ cat: 'all', orders: [] })).orders.find((x) => x.id === el.dataset.o); if (o) { o.rating = +el.dataset.r; save(); rerenderView(); toast('Thanks for your review!'); } },
});
document.addEventListener('input', (e) => { if (e.target.id === 'mk-q') { ui.mq = e.target.value; const pos = e.target.selectionStart; rerenderView(); const i = $('#mk-q'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });

// ---------- CITIZEN SERVICES
const CITIZEN = [
  ['cert', '🧾', 'Certificates', 'Birth, income, caste, residence', 1], ['elec', '⚡', 'Electricity', 'Pay bill · new connection · complaints', 1], ['water', '💧', 'Water', 'Bill · tanker · leakage complaint', 1],
  ['transport', '🚍', 'Transport', 'Driving licence · vehicle tax · bus pass', 1], ['municipal', '🏛️', 'Municipal', 'Property tax · trade licence', 1], ['grievance', '📢', 'Public grievance', 'Report potholes, garbage, streetlights', 1],
  ['health', '🏥', 'Health', 'Hospital appointments (partner)', 0], ['edu', '🎓', 'Education', 'Scholarships · exam results', 1],
];
function modCitizen() {
  const st = MS('citizen', () => ({ apps: [] }));
  return `<div class="official-banner">${icon('bank', 20)}<div><b>Official services only from verified sources</b><div class="ci-sub">Government services connect through official APIs and authorised integrations. Each tile shows whether it is an official government service or a third-party partner.</div></div></div>
  <div class="biller-grid">${CITIZEN.map(([k, e, n, s, off]) => `<button class="biller" data-act="ctz" data-k="${k}"><span class="big-emoji">${e}</span><b>${n}</b><span class="ci-sub">${s}</span><span class="pill ${off ? 'gov' : 'third'}">${off ? '✓ Official' : 'Third-party'}</span></button>`).join('')}</div>
  ${st.apps.length ? sec('My applications & complaints', st.apps.slice().reverse().map((a) => { const step = Math.min(a.steps.length - 1, Math.floor((Date.now() - a.t) / 15000)); return `<div class="app-row"><div class="row-between"><b>${esc(a.title)}</b><span class="pill">${esc(a.steps[step])}</span></div><div class="ci-sub">${esc(a.id)} · ${fmtStamp(a.t)}</div><div class="track">${a.steps.map((s, i) => `<span class="${i <= step ? 'on' : ''}">${esc(s)}</span>`).join('')}</div></div>`; }).join('')) : ''}
  ${sec('Government notifications', [['🗳️', 'Voter list revision', 'Check and update your details by 30 Nov', 'Election Office'], ['💉', 'Free health camp', 'Sunday 9 AM–1 PM at Community Hall, Ward 12', 'Health Department'], ['🚧', 'Road works', 'Traffic diversion on Main Road till Friday', 'Municipal Corporation']].map(([e, t, d, by]) => `<div class="set-row"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${t}</div><div class="ci-sub">${d}</div></div><span class="pill gov">${icon('verified', 12)} ${by}</span></div>`).join(''))}
  ${sec('Emergency numbers', `<div class="chips wrap">${[['112', 'Emergency'], ['100', 'Police'], ['101', 'Fire'], ['108', 'Ambulance'], ['1098', 'Child helpline'], ['1930', 'Cyber crime']].map(([n, l]) => `<a class="chip" href="tel:${n}">${l} · <b>${n}</b></a>`).join('')}</div>`)}`;
}
XA.ctz = (el) => {
  const k = el.dataset.k, def = CITIZEN.find((c) => c[0] === k);
  const st = MS('citizen', () => ({ apps: [] }));
  const file = (title, steps, prefix) => { const a = { id: prefix + '-' + Math.floor(1e5 + Math.random() * 9e5), title, steps, t: Date.now() }; st.apps.push(a); save(); rerenderView(); toast(`Submitted · reference ${a.id}`); };
  if (k === 'elec' || k === 'water') return XA.paybill({ dataset: { i: k === 'elec' ? 0 : 1 } });
  if (k === 'grievance') {
    return modal({ title: '📢 Public grievance', body: `<label class="field"><span>Category</span><select id="gv-c"><option>Pothole / road damage</option><option>Garbage not collected</option><option>Streetlight not working</option><option>Water leakage</option><option>Other</option></select></label><label class="field"><span>Describe the problem</span><textarea id="gv-d" rows="3" placeholder="Where and what?"></textarea></label><label class="radio-row"><input type="checkbox" checked> Attach my current location (with permission)</label>`,
      actions: [{ label: 'Cancel' }, { label: 'Submit', primary: true, onClick: (root) => file('Grievance: ' + $('#gv-c', root).value, ['Registered', 'Assigned to officer', 'In progress', 'Resolved'], 'GRV') }] });
  }
  if (k === 'cert' || k === 'transport' || k === 'municipal' || k === 'edu') {
    const opts = { cert: ['Income certificate', 'Birth certificate', 'Caste certificate', 'Residence certificate'], transport: ['Driving licence renewal', 'Vehicle tax payment', 'Student bus pass'], municipal: ['Property tax receipt', 'Trade licence'], edu: ['Post-matric scholarship', 'Exam results'] }[k];
    return modal({ title: `${def[1]} ${def[2]}`, body: `<p class="muted small">${icon('verified', 14)} Official government service · your WHATSMORE ID is used only with your consent.</p><label class="field"><span>Service</span><select id="ct-s">${opts.map((o) => `<option>${o}</option>`).join('')}</select></label><label class="field"><span>Applicant name</span><input id="ct-n" value="${esc(S.me.name)}"></label><label class="field"><span>Upload supporting document</span><input type="file" id="ct-f"></label>`,
      actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: (root) => file($('#ct-s', root).value, ['Submitted', 'Documents verified', 'Approved', 'Issued · digitally signed'], 'APP') }] });
  }
  modal({ title: def[2], body: `<p class="muted">${esc(def[3])}</p>${note('This is a third-party partner service, not an official government service. WHATSMORE labels the difference clearly.')}`, actions: [{ label: 'Book appointment', primary: true, onClick: () => file('Hospital appointment', ['Requested', 'Confirmed', 'Visited'], 'HSP') }] });
};

// ---------- EMERGENCY SOS
function modSOS() {
  const em = S.settings.emergency, active = ui.sosActive;
  return `<div class="sos-wrap">${active ? `<div class="sos-live"><div class="sos-pulse">SOS</div><b>SOS is active</b><div class="ci-sub">Live location shared with ${em.contacts.length} contact${em.contacts.length === 1 ? '' : 's'} · ${fmtTime(active.at)}</div><button class="btn primary" data-act="sossafe">I'm safe — stop sharing</button></div>`
    : `<button class="sos-btn" data-act="sosgo"><span>SOS</span><small>Tap to start</small></button><p class="muted small center-t">A 5-second countdown prevents accidental alerts. You can cancel any time.</p>`}</div>
  ${sec('When SOS starts', ul(['📍 Shares your current location (with permission)', `💬 Sends your emergency message to ${em.contacts.map(firstName).join(', ') || 'no one yet'}`, '📞 Shows a one-tap call button for 112', '🎙️ Optional audio recording, only if you allow it']))}
  ${sec('Emergency contacts', S.contacts.filter((c) => c.isContact && !c.business).map((c) => `<label class="set-row">${avatarHTML(c, 36)}<div class="grow"><div class="ci-name">${esc(c.name)}</div><div class="ci-sub">@${esc(c.username)}</div></div><input type="checkbox" class="switch" data-sosc="${c.id}" ${em.contacts.includes(c.id) ? 'checked' : ''}></label>`).join(''))}
  ${sec('Emergency message', `<textarea id="sos-msg" class="ta" rows="3" maxlength="300">${esc(em.message)}</textarea>`)}
  <div class="chips wrap">${[['112', 'Emergency'], ['100', 'Police'], ['108', 'Ambulance'], ['1091', 'Women helpline']].map(([n, l]) => `<a class="chip" href="tel:${n}">📞 ${l} · <b>${n}</b></a>`).join('')}</div>
  ${note('Location and recording always need your permission and follow privacy law. Nothing is shared until SOS is confirmed.', 'shield')}`;
}
function getLocation() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res([p.coords.latitude.toFixed(5), p.coords.longitude.toFixed(5)]), () => res(null), { timeout: 5000 });
  });
}
Object.assign(XA, {
  sosgo() {
    if (!S.settings.emergency.contacts.length) return toast('Choose at least one emergency contact first');
    let n = 5;
    const m = modal({ title: 'Starting SOS', body: `<div class="sos-count"><div id="sos-n">${n}</div><p class="muted">Alerting your emergency contacts…</p></div>`, actions: [{ label: 'Cancel SOS', danger: true }], onClose: () => clearInterval(t) });
    const t = setInterval(async () => {
      n--;
      const el = $('#sos-n', m.root);
      if (el) el.textContent = n;
      if (n > 0) return;
      clearInterval(t); m.root.remove();
      const loc = (await getLocation()) || ['17.44010', '78.34890'];
      const link = `https://maps.google.com/?q=${loc[0]},${loc[1]}`;
      ui.sosActive = { at: Date.now() };
      S.settings.emergency.contacts.forEach((cid) => {
        let ch = directChatFor(cid);
        if (!ch) return;
        sendMsg(ch, { type: 'text', text: `🆘 SOS — ${S.settings.emergency.message}\n📍 Live location: ${link}` });
        simulateIncoming(ch, cid, '😟 Calling you now! Stay where you are, I’m coming.', 2500);
      });
      if (ui.view === 'mod:sos') rerenderView();
      toast('🆘 SOS sent with your location to your emergency contacts', null, { ms: 5000 });
    }, 1000);
  },
  sossafe() {
    ui.sosActive = null;
    S.settings.emergency.contacts.forEach((cid) => { const ch = directChatFor(cid); if (ch) sendMsg(ch, { type: 'text', text: "✅ I'm safe now. Location sharing stopped. Thank you!" }); });
    rerenderView(); toast('Location sharing stopped');
  },
});
document.addEventListener('change', (e) => {
  const id = e.target.dataset?.sosc;
  if (!id) return;
  const em = S.settings.emergency;
  em.contacts = e.target.checked ? [...new Set([...em.contacts, id])] : em.contacts.filter((x) => x !== id);
  save();
});
document.addEventListener('input', (e) => { if (e.target.id === 'sos-msg') { S.settings.emergency.message = e.target.value; save(); } });

// ---------- FAMILY HUB
function seedFamily() {
  const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return +d; };
  return {
    events: [{ id: 'f1', title: 'School meeting — parent-teacher', at: at(1, 10) }, { id: 'f2', title: "Mom's birthday 🎂", at: at(4, 19) }, { id: 'f3', title: 'Electricity bill due', at: at(6, 9) }, { id: 'f4', title: 'Doctor appointment — Dr Rao', at: at(9, 17, 30) }, { id: 'f5', title: 'Family trip to Tirupati 🚗', at: at(16, 6) }],
    todos: [['Buy groceries for Sunday lunch', false], ['Renew car insurance', false], ['Pay school fees', true]],
    docs: [['🪪', 'Aadhaar cards', 'Mom, Siva, Ananya, You'], ['💳', 'PAN cards', '4 documents'], ['🏥', 'Health insurance policy', 'Valid till Mar 2027'], ['🎓', 'School report cards', '2026 · Term 1']],
    sharing: { c_mom: false, c_siva: true, c_ananya: false },
  };
}
function modFamily() {
  const f = MS('family', seedFamily);
  const members = ['c_mom', 'c_siva', 'c_ananya'].map(contact).filter(Boolean);
  const evs = f.events.filter((e) => e.at > Date.now() - DAY).sort((a, b) => a.at - b.at);
  return `<div class="fam-members">${[S.me, ...members].map((m) => `<div class="fm">${avatarHTML(m, 52)}<span>${esc(m === S.me ? 'You' : m.name.split(' ')[0])}</span></div>`).join('')}<button class="fm add" data-act="gochat" data-chat="ch_family"><span class="fm-plus">${icon('chat', 22)}</span><span>Family chat</span></button></div>
  ${sec('Shared calendar', evs.map((e) => `<div class="set-row"><div class="date-chip"><b>${new Date(e.at).getDate()}</b><span>${new Date(e.at).toLocaleDateString([], { month: 'short' })}</span></div><div class="grow"><div class="ci-name">${esc(e.title)}</div><div class="ci-sub">${dayLabel(e.at)} · ${fmtTime(e.at)} · everyone notified</div></div></div>`).join(''), '<button class="link-btn" data-act="famadd">+ Add event</button>')}
  ${sec('Reminders', f.todos.map(([t, d], i) => `<label class="set-row"><input type="checkbox" data-famtodo="${i}" ${d ? 'checked' : ''}><span class="grow ${d ? 'done' : ''}">${esc(t)}</span></label>`).join(''), '<button class="link-btn" data-act="famtodo">+ Add</button>')}
  ${sec('Important documents', f.docs.map(([e, t, s]) => `<div class="set-row" data-act="famdoc"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${t}</div><div class="ci-sub">${s}</div></div>${icon('lock', 18, 'muted')}</div>`).join(''))}
  ${sec('Location sharing (optional)', members.map((m) => `<label class="set-row">${avatarHTML(m, 36)}<div class="grow"><div class="ci-name">${esc(m.name)}</div><div class="ci-sub">${f.sharing[m.id] ? 'Sharing live location with family' : 'Not sharing'}</div></div><input type="checkbox" class="switch" data-famshare="${m.id}" ${f.sharing[m.id] ? 'checked' : ''}></label>`).join('') + note('Location sharing is off by default and each person controls their own.', 'place'))}
  <button class="btn primary block" data-act="famannounce">${icon('megaphone', 18)} Send family announcement</button>`;
}
Object.assign(XA, {
  famadd() { modal({ title: 'Add to family calendar', body: '<label class="field"><span>Title</span><input id="fe-t" placeholder="e.g. School meeting" autofocus></label><label class="field"><span>When</span><input id="fe-w" type="datetime-local"></label>', actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const t = $('#fe-t', root).value.trim(), w = new Date($('#fe-w', root).value).getTime(); if (!t || !w) { toast('Add a title and time'); return false; } MS('family', seedFamily).events.push({ id: uid(), title: t, at: w }); save(); rerenderView(); toast('Added · family members will be reminded'); } }] }); },
  famtodo() { modal({ title: 'New reminder', body: '<label class="field"><span>Reminder</span><input id="ft" autofocus></label>', actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const t = $('#ft', root).value.trim(); if (t) { MS('family', seedFamily).todos.push([t, false]); save(); rerenderView(); } } }] }); },
  famdoc() { withPin(() => toast('🔓 Document vault unlocked (demo)')); },
  famannounce() { const ch = chatById('ch_family'); if (!ch) return; modal({ title: 'Family announcement', body: '<label class="field"><span>Message</span><textarea id="fa" rows="3" autofocus>📢 School meeting tomorrow at 10 AM — who can go?</textarea></label>', actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const m = sendMsg(ch, { type: 'text', text: $('#fa', root).value.trim() }); scheduleReply(ch, m); toast('Sent to Family ❤️'); } }] }); },
});
document.addEventListener('change', (e) => {
  const f = S?.mod?.family;
  if (!f) return;
  if (e.target.dataset.famtodo != null) { f.todos[+e.target.dataset.famtodo][1] = e.target.checked; save(); rerenderView(); }
  if (e.target.dataset.famshare) { f.sharing[e.target.dataset.famshare] = e.target.checked; save(); rerenderView(); }
});

// ---------- LEARN
function modLearn() {
  const st = MS('learn', () => ({ topic: 'photosynthesis', lang: 'en', quiz: null }));
  const T = TOPICS[st.topic];
  return `${sec('AI tutor', `<div class="chips wrap">${Object.entries(TOPICS).map(([k, t]) => `<button class="chip ${st.topic === k ? 'on' : ''}" data-act="lntopic" data-t="${k}">${t.title}</button>`).join('')}<button class="chip" data-act="lnupload">${icon('upload', 14)} Upload a chapter (PDF)</button></div>
    <div class="tutor"><div class="row-between"><b>${T.title}</b><div class="seg sm">${[['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी']].map(([k, l]) => `<button class="${st.lang === k ? 'on' : ''}" data-act="lnlang" data-l="${k}">${l}</button>`).join('')}</div></div><p>${esc(T.explain[st.lang])}</p>
    <div class="btn-row left"><button class="btn sm" data-act="lnsay">🔊 Listen</button><button class="btn sm primary" data-act="lnquiz">📝 Generate quiz</button></div>${st.quiz ? `<div class="quiz-box">${quizHTML(st.quiz)}</div>` : ''}</div>`)}
  ${sec('Study groups', [['📐', 'Class 10 Maths — Hyderabad', '1,240 students · 3 teachers'], ['⚖️', 'CLAT 2027 Prep', '8,900 members · daily quiz'], ['💻', 'Learn Python in Telugu', '3,410 members · live class Sat 6 PM']].map(([e, n, s]) => `<div class="set-row"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${n}</div><div class="ci-sub">${s}</div></div><button class="btn sm" data-act="lnjoin">Join</button></div>`).join(''))}
  ${sec('For teachers', ul(['📢 Class groups and announcements', '📚 Assignments with due dates and auto-reminders', '🎥 Live classes with screen sharing', '🧠 AI-generated quizzes from any PDF']))}`;
}
Object.assign(XA, {
  lntopic(el) { const st = MS('learn', () => ({})); st.topic = el.dataset.t; st.quiz = null; save(); rerenderView(); },
  lnlang(el) { MS('learn', () => ({})).lang = el.dataset.l; save(); rerenderView(); },
  lnsay() { const st = MS('learn', () => ({})); readAloud(TOPICS[st.topic].explain[st.lang]); },
  lnquiz() { const st = MS('learn', () => ({})); const id = 'q' + uid(); MS('quiz', () => ({}))[id] = { topic: st.topic, answers: {} }; st.quiz = id; save(); rerenderView(); },
  async lnupload() { const f = await pickFile('file-any'); if (f[0]) { toast(`📄 ${f[0].name} uploaded — AI is reading it… (demo uses a sample chapter)`); } },
  lnjoin(el) { el.textContent = 'Joined ✓'; el.disabled = true; toast('Joined study group'); },
});

// ---------- NEWS & CHANNELS
const BADGES = { gov: ['Government', '#1565c0'], official: ['Official', '#2e7d32'], news: ['News organisation', '#6d4c41'], verified: ['Verified', '#1a73e8'], biz: ['Business verified', '#f4511e'] };
const CHANNELS = [
  { id: 'n1', name: 'India Today Updates', badge: 'news', cat: 'National', followers: '2.4M', posts: ['Parliament winter session to begin on 24 November', 'Monsoon withdraws from the country; IMD forecasts a cold winter'] },
  { id: 'n2', name: 'Telangana Govt Updates', badge: 'gov', cat: 'State', followers: '880K', posts: ['New online portal for income certificates is live', 'Free health camps across all districts this Sunday'] },
  { id: 'n3', name: 'Hyderabad Traffic Police', badge: 'official', cat: 'District', followers: '410K', posts: ['Diversions near Hitech City for metro work till Friday', 'Wear a helmet — e-challans now sent on WHATSMORE'] },
  { id: 'n4', name: 'Cricket Live', badge: 'verified', cat: 'Sports', followers: '5.1M', posts: ['India win the series 3–1! 🏏', 'Squad announced for the next tour'] },
  { id: 'n5', name: 'TechGuru Kiran', badge: 'verified', cat: 'Technology', followers: '96K', posts: ['5 privacy settings you should turn on today 🔐', 'Review: the best budget phones of 2026'] },
  { id: 'n6', name: 'Sunrise Bakery', badge: 'biz', cat: 'Business', followers: '12K', posts: ['🎂 20% off all cakes this weekend', 'New: matcha croissants 🥐'] },
  { id: 'n7', name: 'Kisan Mitra', badge: 'verified', cat: 'Agriculture', followers: '640K', posts: ['Paddy procurement price updated for this season', 'Weather alert: light rain expected in coastal districts'] },
];
function modNews() {
  const st = MS('news', () => ({ cat: 'All', follow: ['n2', 'n3', 'n6'] }));
  const cats = ['All', ...new Set(CHANNELS.map((c) => c.cat))];
  const list = CHANNELS.filter((c) => st.cat === 'All' || c.cat === st.cat);
  const feed = CHANNELS.filter((c) => st.follow.includes(c.id)).flatMap((c, i) => c.posts.map((p, j) => ({ c, p, t: Date.now() - (i * 2 + j + 1) * 47 * MIN }))).sort((a, b) => b.t - a.t);
  const badge = (c) => `<span class="vbadge" style="--b:${BADGES[c.badge][1]}">${icon('verified', 12)} ${BADGES[c.badge][0]}</span>`;
  return `<div class="chips wrap">${cats.map((c) => `<button class="chip ${st.cat === c ? 'on' : ''}" data-act="nwcat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  ${sec('Channels', list.map((c) => `<div class="set-row"><span class="mod-ic" style="background:${BADGES[c.badge][1]}">${icon('news', 18)}</span><div class="grow"><div class="ci-name">${esc(c.name)}</div><div class="ci-sub">${badge(c)} · ${c.followers} followers</div></div><button class="btn sm ${st.follow.includes(c.id) ? '' : 'primary'}" data-act="nwfollow" data-c="${c.id}">${st.follow.includes(c.id) ? 'Following' : 'Follow'}</button></div>`).join(''), '<button class="link-btn" data-act="nwcreate">+ Create channel</button>')}
  ${sec('Your feed', feed.map(({ c, p, t }) => `<div class="post"><div class="row-between"><b>${esc(c.name)}</b>${badge(c)}</div><p>${esc(p)}</p><div class="ci-sub">${listTime(t)} · 👍 ${(hash(p) % 900) + 100} · 🔁 ${(hash(p + 1) % 90) + 10}</div></div>`).join('') || '<p class="muted">Follow channels to see posts</p>')}
  ${note('Verification badges follow documented criteria: Government (authorised department), Official (registered organisation), News organisation (registered publisher), Verified (identity checked), Business verified (registered business). Nobody can simply claim official status.', 'verified')}`;
}
Object.assign(XA, {
  nwcat(el) { MS('news', () => ({})).cat = el.dataset.c; save(); rerenderView(); },
  nwfollow(el) { const st = MS('news', () => ({})); st.follow = st.follow.includes(el.dataset.c) ? st.follow.filter((x) => x !== el.dataset.c) : [...st.follow, el.dataset.c]; save(); rerenderView(); },
  nwcreate() { modal({ title: 'Create a channel', body: '<label class="field"><span>Channel name</span><input id="nc-n" autofocus></label><label class="field"><span>Category</span><select><option>Local</option><option>Education</option><option>Business</option><option>Entertainment</option></select></label><p class="muted small">New channels start unverified. Apply for a badge from channel settings with supporting documents.</p>', actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: () => toast('Channel created · followers can find it by search') }] }); },
});

// ---------- MY AREA
const AREAS = ['Gachibowli', 'Madhapur', 'Kukatpally', 'Banjara Hills', 'Secunderabad'];
function modArea() {
  const st = MS('area', () => ({ area: 'Gachibowli', tab: 'jobs' }));
  const A2 = st.area;
  const data = {
    jobs: [['💼', 'Front-end developer (React)', `TechNova · ${A2} · ₹8–12 LPA`], ['🛵', 'Delivery partner', `Spice Route Kitchen · ${A2} · ₹22,000/month`], ['📚', 'Maths tutor (Class 8–10)', `Home tuition · ${A2} · ₹500/hour`]],
    events: [['🎶', 'Sunday music evening', `Community Park, ${A2} · Sun 6 PM`], ['🏃', '5K fun run', `${A2} lake · Sat 6 AM · free`], ['🧘', 'Free yoga camp', 'Community Hall · daily 7 AM']],
    shops: [['🥐', 'Sunrise Bakery', '0.8 km · open till 9 PM · ⭐ 4.7'], ['🛒', 'Metro Kirana Store', '0.3 km · home delivery'], ['💊', 'Apollo-style Pharmacy', '0.5 km · 24×7']],
    services: [['🔧', 'QuickFix plumber', 'Arrives in 2 hours · ⭐ 4.4'], ['🚗', 'Car wash at home', '₹399 · book a slot'], ['🐶', 'Pet grooming', 'Doorstep · weekends']],
    notices: [['📢', 'Water supply off Sunday 10 AM–2 PM', 'Green Valley Residents'], ['🚧', 'Road repair on Main Street', 'Municipal Corporation'], ['🗳️', 'Residents association meeting', 'Saturday 5 PM · Clubhouse']],
    lost: [['🐕', 'Lost: brown Labrador "Bruno"', `Near ${A2} metro · call via WHATSMORE`], ['👛', 'Found: black wallet', 'Handed to the security desk, Block C'], ['🔑', 'Lost: car keys (Honda)', 'Near the park gate']],
  };
  const tabs = [['jobs', 'Jobs'], ['events', 'Events'], ['shops', 'Shops'], ['services', 'Services'], ['notices', 'Announcements'], ['lost', 'Lost & found']];
  return `<div class="row-between"><label class="area-pick">${icon('place', 18)}<select id="area-sel">${AREAS.map((a) => `<option ${a === A2 ? 'selected' : ''}>${a}</option>`).join('')}</select><span class="ci-sub">Hyderabad</span></label><button class="btn sm primary" data-act="areapost">+ Post</button></div>
  <div class="chips wrap mt">${tabs.map(([k, l]) => `<button class="chip ${st.tab === k ? 'on' : ''}" data-act="areatab" data-t="${k}">${l}</button>`).join('')}</div>
  <div class="vsec">${data[st.tab].map(([e, t, s]) => `<div class="set-row"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${esc(t)}</div><div class="ci-sub">${esc(s)}</div></div><button class="btn sm" data-act="areaact">${st.tab === 'jobs' ? 'Apply' : st.tab === 'shops' || st.tab === 'services' ? 'Chat' : st.tab === 'events' ? 'Going' : 'View'}</button></div>`).join('')}</div>
  ${note(`Showing posts near <b>${esc(A2)}</b>. Your exact location is never shown to others — you choose your locality.`, 'place')}`;
}
Object.assign(XA, {
  areatab(el) { MS('area', () => ({})).tab = el.dataset.t; save(); rerenderView(); },
  areaact(el) { el.textContent = '✓ Done'; el.disabled = true; },
  areapost() { modal({ title: 'Post to My Area', body: '<label class="field"><span>Type</span><select><option>Announcement</option><option>Event</option><option>Job</option><option>Lost &amp; found</option></select></label><label class="field"><span>Details</span><textarea rows="3" autofocus></textarea></label>', actions: [{ label: 'Cancel' }, { label: 'Post', primary: true, onClick: () => toast('Posted to your locality · moderated by community admins') }] }); },
});
document.addEventListener('change', (e) => { if (e.target.id === 'area-sel') { MS('area', () => ({})).area = e.target.value; save(); rerenderView(); } });

// ---------- CREATOR STUDIO
function modCreator() {
  const st = MS('creator', () => ({ live: false }));
  return `<div class="biz-head">${avatarHTML(S.me, 56)}<div class="grow"><div class="ci-name">${esc(S.me.name)} ${icon('verified', 16, 'accent')}</div><div class="ci-sub">Creator · @${esc(S.me.username)} · Design &amp; tech tips</div></div><button class="btn sm" data-act="setprofile" data-p="creator">Use creator profile</button></div>
  <div class="kpi-grid">${kpi('Followers', '12.4K', '+320')}${kpi('Subscribers', '860', '+42')}${kpi('Views (30d)', '1.2M', '+12%')}${kpi('Revenue (30d)', money(48200), '+9%')}${kpi('Engagement', '6.8%', '+0.4')}${kpi('Tips', money(3150), '+11')}</div>
  ${st.live ? `<div class="live-box"><span class="live-dot"></span><b>You are LIVE</b> · <span id="live-n">128</span> watching<button class="btn sm danger" data-act="crlive">End live</button></div>` : `<div class="btn-row left"><button class="btn primary" data-act="crlive">🔴 Go live</button><button class="btn" data-act="crpost">+ Publish post</button></div>`}
  ${sec('Content performance', [['🎥', '10 UI tricks in 60 seconds', '312K views · 8.1% engagement'], ['🎙️', 'Podcast: designing for Bharat', '48K listens · 1,204 comments'], ['📸', 'My desk setup 2026', '96K views · 5.2% engagement']].map(([e, t, s]) => `<div class="set-row"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${t}</div><div class="ci-sub">${s}</div></div></div>`).join(''))}
  ${sec('Paid community', `<div class="set-row"><span class="big-emoji">⭐</span><div class="grow"><div class="ci-name">Design Insiders</div><div class="ci-sub">${money(149)}/month · 860 subscribers · weekly live Q&amp;A</div></div><span class="pill">Active</span></div>`)}`;
}
Object.assign(XA, {
  crlive() { const st = MS('creator', () => ({})); st.live = !st.live; save(); rerenderView(); toast(st.live ? '🔴 You are live — followers are notified' : 'Live ended · 1,240 people watched'); },
  crpost() { modal({ title: 'Publish', body: '<label class="field"><span>Post</span><textarea rows="4" autofocus placeholder="Share something with your followers"></textarea></label><label class="radio-row"><input type="checkbox"> Subscribers only (premium)</label>', actions: [{ label: 'Cancel' }, { label: 'Publish', primary: true, onClick: () => toast('Published to 12.4K followers') }] }); },
});

// ---------- VOICE ROOMS
const ROOMS = [['🎙️', 'Startup stories in Telugu', 'Siva', 342], ['🏏', 'Match analysis — live', 'Cricket Live', 2140], ['📚', 'CLAT doubt-clearing room', 'CLAT 2027 Prep', 516], ['🎵', 'Old Hindi songs request night', 'Retro Radio', 1203]];
function modVoice() {
  return `${sec('Live now', ROOMS.map(([e, t, h, n], i) => `<div class="set-row"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${t} <span class="live-tag">LIVE</span></div><div class="ci-sub">Hosted by ${esc(h)} · ${n.toLocaleString()} listening</div></div><button class="btn sm primary" data-act="vrjoin" data-i="${i}">Join</button></div>`).join(''), '<button class="link-btn" data-act="vrstart">+ Start a room</button>')}
  ${sec('Voice status & podcasts', ul(['🎤 Post a <b>voice status</b> — up to 60 seconds', '🎧 Publish short audio programmes to followers', '👥 Community audio rooms with moderators and raise-hand']) + '<button class="btn sm" data-act="vrstatus">🎤 Record voice status</button>')}`;
}
Object.assign(XA, {
  vrjoin(el) {
    const [e, t, h, n] = ROOMS[+el.dataset.i];
    const speakers = [h, 'Ananya', 'Rahul', 'Meera'];
    modal({ title: `${e} ${t}`, wide: true, body: `<div class="room">${speakers.map((s, i) => `<div class="spk ${i === 0 ? 'talking' : ''}">${avatarHTML({ name: s, color: COLORS[i + 2] }, 64)}<span>${esc(s)}${i === 0 ? ' · host' : ''}</span></div>`).join('')}</div><p class="muted center-t">${n.toLocaleString()} listening · you are muted</p>`,
      actions: [{ label: '✋ Raise hand', onClick: () => { toast('Hand raised — the host can invite you to speak'); return false; } }, { label: 'Leave quietly', primary: true }],
      onMount: (root) => { const iv = setInterval(() => { if (!root.isConnected) return clearInterval(iv); const sp = $$('.spk', root); sp.forEach((x) => x.classList.remove('talking')); sp[Math.floor(Math.random() * sp.length)].classList.add('talking'); }, 1400); } });
  },
  vrstart() { toast('🎙️ Room created — share the link to invite listeners'); },
  vrstatus() { toast('🎤 Voice status: record up to 60 seconds (uses your microphone)'); },
});

// ---------- DIGITAL WELLBEING
ui.sessionStart = Date.now();
function screenMinutes() { const st = MS('screen', () => ({ day: dayKey(Date.now()), min: 38 })); if (st.day !== dayKey(Date.now())) { st.day = dayKey(Date.now()); st.min = 0; } return st.min + Math.floor((Date.now() - ui.sessionStart) / MIN); }
setInterval(() => { const st = S?.mod?.screen; if (st) { st.min++; ui.sessionStart = Date.now(); save(); } }, 5 * MIN);
function modWellbeing() {
  const w = S.settings.wellbeing, mins = screenMinutes(), pct = Math.min(100, (mins / w.limit) * 100);
  const hours = [12, 25, 8, 31, 18, 22, mins];
  return `<div class="wb-top"><div class="wb-ring"><svg viewBox="0 0 36 36" width="120" height="120"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--track)" stroke-width="3"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg><div><b>${Math.floor(mins / 60)}h ${mins % 60}m</b><span>today</span></div></div>
    <div class="grow"><div class="ci-name">Screen time</div><div class="ci-sub">Daily goal ${Math.floor(w.limit / 60)}h ${w.limit % 60}m · ${pct >= 100 ? 'goal reached — time for a break 🌿' : Math.round(100 - pct) + '% left'}</div>
    <div class="bars sm">${hours.map((v, i) => `<div class="bar-col"><div class="bar-v" style="height:${Math.min(100, (v / 40) * 100)}%"></div><span>${new Date(Date.now() - (6 - i) * DAY).toLocaleDateString([], { weekday: 'narrow' })}</span></div>`).join('')}</div></div></div>
  ${sec('Controls', `${toggleRow('wellbeing.focus', 'Focus mode', 'Pause notifications except calls and favourites')}${toggleRow('wellbeing.quiet', 'Quiet hours', `Silence notifications ${w.quietFrom}–${w.quietTo} every night`)}${toggleRow('wellbeing.summary', 'Notification summary', 'Get non-urgent notifications in one digest at 8 PM')}${toggleRow('wellbeing.reminder', 'Screen-time reminders', 'Nudge me when I reach my daily goal')}
    ${selectRow('wellbeing.limit', 'Daily goal', [[60, '1 hour'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours']].map(([v, l]) => [v, l]))}${selectRow('theme', 'Night mode', [['light', 'Off'], ['dark', 'On'], ['system', 'Follow system']])}`)}
  ${note('Family controls let parents set quiet hours and screen-time goals for children’s accounts, with their consent.', 'heart')}`;
}
const _notify = notify;
notify = function (...args) { if (S.settings.wellbeing?.focus) return; _notify(...args); };
// main.js stores the raw value after this handler runs, so convert on the next tick
document.addEventListener('change', (e) => { if (e.target.dataset?.setting === 'wellbeing.limit') setTimeout(() => { S.settings.wellbeing.limit = +e.target.value; save(); rerenderView(); }); else if (e.target.dataset?.setting?.startsWith('wellbeing')) toast(e.target.checked ? 'On' : 'Off'); });

// ---------- ADMIN COMMAND CENTER
function modAdmin() {
  const st = MS('admin', () => ({ reports: [['Spam', '@kyc.update.desk', 'KYC phishing link reported by 214 users'], ['Fraud', '@quick.loans.247', 'Fake loan offer asking for a fee'], ['Impersonation', '@sbi.helpdesk.official', 'Claims to be a bank helpdesk']], verif: [['Spice Route Kitchen', 'Business verified', 'GST + FSSAI uploaded'], ['Hyderabad Metro Updates', 'Official', 'Authorisation letter uploaded'], ['TechGuru Kiran', 'Creator verified', 'ID + 96K followers']] }));
  const k = ui.adm || (ui.adm = { users: 1250430, active: 685240, msgs: 18450230, calls: 520340 });
  return `<div class="kpi-grid">${kpi('Total users', k.users.toLocaleString('en-IN'), '+2.1%', 'ad-u')}${kpi('Active today', k.active.toLocaleString('en-IN'), '+4.3%', 'ad-a')}${kpi('Messages today', k.msgs.toLocaleString('en-IN'), '', 'ad-m')}${kpi('Calls today', k.calls.toLocaleString('en-IN'), '', 'ad-c')}${kpi('Businesses', '42,560', '+380')}${kpi('Creators', '8,920', '+64')}${kpi('Payments today', '₹14.6 Cr', '+6%')}${kpi('System health', '99.99%', '')}</div>
  ${sec('System monitoring', [['API latency (p95)', 82, '82 ms'], ['Message delivery', 99.98, '99.98%'], ['Call quality (MOS 4.4)', 88, 'Good'], ['AI latency', 64, '640 ms'], ['Payment success', 99.2, '99.2%'], ['Storage used', 47, '4.7 PB of 10 PB']].map(([l, v, t]) => `<div class="mon"><span>${l}</span><div class="meter"><div style="width:${v}%"></div></div><b>${t}</b></div>`).join(''))}
  ${sec(`Reports queue (${st.reports.length})`, st.reports.map(([c, who, d], i) => `<div class="set-row"><span class="pill third">${c}</span><div class="grow"><div class="ci-name">${esc(who)}</div><div class="ci-sub">${esc(d)}</div></div><button class="btn sm danger" data-act="adrep" data-i="${i}" data-r="ban">Ban</button><button class="btn sm" data-act="adrep" data-i="${i}" data-r="dismiss">Dismiss</button></div>`).join('') || '<p class="muted">Queue is clear 🎉</p>')}
  ${sec(`Verification requests (${st.verif.length})`, st.verif.map(([n, b, d], i) => `<div class="set-row"><div class="grow"><div class="ci-name">${esc(n)}</div><div class="ci-sub">${esc(b)} · ${esc(d)}</div></div><button class="btn sm primary" data-act="adver" data-i="${i}" data-r="ok">Approve</button><button class="btn sm" data-act="adver" data-i="${i}" data-r="no">Reject</button></div>`).join('') || '<p class="muted">No pending requests</p>')}
  ${sec('Security alerts (38)', ul(['⚠️ 12 accounts with unusual login locations — step-up verification sent', '🛡️ Rate limit triggered for 3 bot networks (blocked)', '🔐 2 payment-fraud patterns flagged for review']))}
  ${note('Production runs this as a separate, access-controlled web admin panel with audit logs for every action.', 'shield')}`;
}
const MOD_AFTER = {
  admin() {
    ui.viewTimer = setInterval(() => {
      if (ui.view !== 'mod:admin') return clearInterval(ui.viewTimer);
      const k = ui.adm;
      k.users += Math.floor(Math.random() * 6); k.active += Math.floor(Math.random() * 20); k.msgs += 180 + Math.floor(Math.random() * 400); k.calls += Math.floor(Math.random() * 12);
      [['ad-u', k.users], ['ad-a', k.active], ['ad-m', k.msgs], ['ad-c', k.calls]].forEach(([id, v]) => { const el = $('#' + id); if (el) el.textContent = v.toLocaleString('en-IN'); });
    }, 1200);
  },
  market() { ui.viewTimer = setInterval(() => { if (ui.view !== 'mod:market') return clearInterval(ui.viewTimer); if (S.mod.market?.orders?.some((o) => Date.now() - o.t < 70000) && !document.activeElement?.matches('input')) rerenderView(); }, 5000); },
  citizen() { ui.viewTimer = setInterval(() => { if (ui.view !== 'mod:citizen') return clearInterval(ui.viewTimer); if (S.mod.citizen?.apps?.some((a) => Date.now() - a.t < 60000)) rerenderView(); }, 5000); },
  creator() { ui.viewTimer = setInterval(() => { const el = $('#live-n'); if (el) el.textContent = Math.max(40, +el.textContent + Math.floor(Math.random() * 30) - 9); }, 1500); },
};
Object.assign(XA, {
  adrep(el) { const st = MS('admin', () => ({})); const [c, who] = st.reports.splice(+el.dataset.i, 1)[0]; save(); rerenderView(); toast(el.dataset.r === 'ban' ? `${who} banned · reporters notified` : 'Report dismissed'); },
  adver(el) { const st = MS('admin', () => ({})); const [n, b] = st.verif.splice(+el.dataset.i, 1)[0]; save(); rerenderView(); toast(el.dataset.r === 'ok' ? `${n} is now ${b}` : `${n} request rejected`); },
});

const MOD_RENDER = { pay: modPay, business: modBusiness, market: modMarket, citizen: modCitizen, sos: modSOS, family: modFamily, learn: modLearn, news: modNews, area: modArea, creator: modCreator, voice: modVoice, wellbeing: modWellbeing, admin: modAdmin };
// Settings toggles inside module views re-render the view
document.addEventListener('change', (e) => { if (e.target.dataset?.setting === 'theme' && ui.view) rerenderView(); });

// ---------- extra settings pages
function extraSettingsPage(p) {
  const st = S.settings;
  if (p === 'set-devices') return devicesPage();
  if (p === 'set-profiles') return pageHead('Profiles') + `<div class="side-scroll"><p class="pad muted small">One app, separate identities. Each profile has its own chats, notifications, privacy settings, status and profile info.</p>
    ${Object.entries(PROFILES).map(([k, [l, e]]) => `<div class="set-row" data-act="setprofile" data-p="${k}"><span class="big-emoji">${e}</span><div class="grow"><div class="ci-name">${l}</div><div class="ci-sub">${{ personal: 'Friends & family · @' + esc(S.me.username), business: esc(S.me.name) + ' Designs · catalogue, orders, AI replies', creator: 'Followers, subscribers, paid community', family: 'Family Hub, shared calendar, location' }[k]}</div></div>${st.profile === k ? '<span class="pill">Active</span>' : ''}</div>`).join('')}</div>`;
  if (p === 'set-ai') return pageHead('AI & memory') + `<div class="side-scroll">${toggleRow('aiMemory', 'AI memory', 'Let WHATSMORE AI remember your preferences. Off = nothing is remembered.')}
    <div class="list-label">What AI may use</div>${toggleRow('aiPerms.chats', 'Chats you choose to summarize', 'Only when you ask — never in the background')}${toggleRow('aiPerms.files', 'Files & documents', 'For summaries, proofreading and smart search')}${toggleRow('aiPerms.contacts', 'Contact names', 'To understand “the invoice Ramesh sent”')}${toggleRow('aiPerms.location', 'Location', 'For My Area suggestions')}
    <div class="pad"><button class="btn danger block" data-act="clearaimem">Clear AI memory</button></div>
    <div class="hint-box">${icon('shield', 16)}<span>Sensitive data (payments, IDs, health) is never used for AI memory. AI runs through a model-agnostic gateway — on-device where possible.</span></div></div>`;
  if (p === 'set-notify') return pageHead('Notifications') + `<div class="side-scroll"><div class="list-label">Notify me about</div>${[['messages', 'Messages'], ['calls', 'Calls'], ['payments', 'Payments'], ['business', 'Business'], ['marketplace', 'Marketplace'], ['community', 'Community & channels'], ['ai', 'AI suggestions'], ['security', 'Security alerts'], ['services', 'Government & services']].map(([k, l]) => toggleRow('notify.' + k, l)).join('')}
    <div class="hint-box">${icon('timer', 16)}<span>Use Digital wellbeing for focus mode, quiet hours and a daily notification summary.</span></div></div>`;
  return '';
}

// ---------- universal chat import (only from apps that offer a legitimate export)
const SAMPLE_EXPORT = `12/09/26, 9:14 am - Ravi Teja: Good morning team! Meeting at 11?
12/09/26, 9:15 am - Lakshmi: Yes, I'll share the slides before that
12/09/26, 9:20 am - ${'{ME}'}: Works for me 👍
12/09/26, 10:02 am - Ravi Teja: Decided: we launch the beta on Monday 🚀
12/09/26, 10:05 am - Lakshmi: Please review the checklist by tonight
12/09/26, 10:06 am - ${'{ME}'}: On it!`;
function parseExport(text) {
  const re = /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?\]?\s*[-–]?\s*([^:]{1,40}):\s(.*)$/i;
  const out = [];
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(re);
    if (m) {
      let [, d, mo, y, h, mi, ap, who, msg] = m;
      y = +y < 100 ? 2000 + +y : +y; h = +h;
      if (ap) { const pm = /p/i.test(ap); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      out.push({ who: who.trim(), text: msg, t: new Date(y, +mo - 1, +d, h, +mi).getTime() || Date.now() });
    } else if (out.length && line.trim()) out[out.length - 1].text += '\n' + line;
  });
  return out;
}
function importChatModal() {
  modal({
    title: 'Import chats',
    body: `<p class="muted">Bring your history from any app that lets you <b>export</b> a chat (for example “Export chat” → .txt). WHATSMORE only imports files you are allowed to export — it never bypasses another app's security or encryption.</p>
      <div class="btn-row left"><button class="btn" id="im-file">${icon('upload', 16)} Choose export file (.txt)</button><button class="btn" id="im-sample">Try a sample export</button></div><div id="im-out"></div>`,
    actions: [{ label: 'Close' }],
    onMount: (root, close) => {
      const show = (text, fname) => {
        const msgs = parseExport(text);
        if (!msgs.length) { $('#im-out', root).innerHTML = note('No messages found. Use the plain-text export (without media) from your other app.'); return; }
        const people = [...new Set(msgs.map((m) => m.who))];
        $('#im-out', root).innerHTML = `<div class="list-label pad0">Found ${msgs.length} messages from ${people.length} people</div><label class="field"><span>Which one is you?</span><select id="im-me">${people.map((p) => `<option ${p === S.me.name ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><label class="field"><span>Chat name</span><input id="im-name" value="${esc(fname)}"></label><button class="btn primary" id="im-go">Import</button>`;
        $('#im-go', root).addEventListener('click', () => {
          const me = $('#im-me', root).value, ids = {};
          people.filter((p) => p !== me).forEach((p) => { const c = { id: 'i_' + uid(), name: p, username: p.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + Math.floor(Math.random() * 90 + 10), color: pick(COLORS), isContact: false }; S.contacts.push(c); ids[p] = c.id; });
          const others = Object.values(ids), t0 = msgs[0].t;
          const base = { id: 'ch_' + uid(), unread: 0, imported: true, messages: [{ id: uid(), type: 'system', from: 'system', t: t0 - 1, text: `Imported ${msgs.length} messages from an exported chat · now end-to-end encrypted on WHATSMORE` }, ...msgs.map((m) => ({ id: uid(), from: m.who === me ? 'me' : ids[m.who], type: 'text', text: m.text, t: m.t, status: 'read', reactions: {} }))] };
          const ch = others.length === 1 ? { ...base, type: 'direct', contactId: others[0] } : { ...base, type: 'group', name: $('#im-name', root).value.trim() || 'Imported chat', emoji: '📥', color: '#5e35b1', members: others, admins: ['me'], description: 'Imported chat history' };
          S.chats.push(ch); save(); close();
          ui.tab = 'chats'; ui.page = null; renderRail(); renderSidebar(); openChat(ch.id);
          toast(`📥 Imported ${msgs.length} messages`);
        });
      };
      $('#im-sample', root).addEventListener('click', () => show(SAMPLE_EXPORT.replace(/\{ME\}/g, S.me.name), 'Team Alpha (imported)'));
      $('#im-file', root).addEventListener('click', async () => { const f = (await pickFile('file-any'))[0]; if (f) show(await f.text(), f.name.replace(/\.[^.]+$/, '')); });
    },
  });
}
