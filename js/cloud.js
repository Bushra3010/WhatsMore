// Real accounts and live chats through Supabase.
// Email + password sign-up with a unique @username, find people by @username, and live 1:1 / group
// text chats between real users. Row-level security in the database means each person only ever
// receives conversations they belong to. Demo contacts and bots keep working alongside.
'use strict';
const SB_URL = 'https://nkmqdkkjdrvsconphnae.supabase.co';
// Publishable key: meant to be in the browser. Access is enforced by row-level security.
const SB_KEY = 'sb_publishable_vr2jTPISjmK4FBkmGNOQ8A_Ay5tx6se';
const sb = window.supabase?.createClient ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const CL = { user: null, channel: null, syncing: null, found: new Map(), searchT: 0, noted: new Set() };
const cuid = (u) => 'u_' + u, chid = (c) => 'sb_' + c, rawId = (id) => String(id).replace(/^(u_|sb_)/, '');
const cloudOn = () => !!(sb && CL.user);
const SYS_E2E = 'This is a live chat with a real WHATSMORE account. Text messages sync instantly to everyone in the chat.';

// ---------- people
function upsertCloudContact(p) {
  const id = cuid(p.id);
  let c = contact(id);
  const fields = { name: p.name, username: p.username, about: p.about, color: p.color || '#1565d8' };
  if (c) Object.assign(c, fields);
  else { c = { id, ...fields, isContact: true, cloud: true, online: false }; S.contacts.push(c); }
  return c;
}
async function fetchProfiles(ids) {
  const need = [...new Set(ids)].filter((x) => x && x !== CL.user?.id);
  if (!need.length) return;
  const { data } = await sb.from('profiles').select('id, username, name, about, color').in('id', need);
  (data || []).forEach(upsertCloudContact);
}

// ---------- full sync: my conversations, their members and recent messages
async function cloudSync() {
  if (!cloudOn()) return;
  if (CL.syncing) return CL.syncing;
  CL.syncing = (async () => {
    const me = CL.user.id;
    const { data: mine, error } = await sb.from('members').select('conversation_id, conversations(id, kind, name, emoji, color, created_at)').eq('user_id', me);
    if (error) { toast('Could not load your chats: ' + error.message); return; }
    const convs = (mine || []).map((r) => r.conversations).filter(Boolean);
    const ids = convs.map((c) => c.id);
    let members = [], msgs = [];
    if (ids.length) {
      const [mr, gr] = await Promise.all([
        sb.from('members').select('conversation_id, user_id, role').in('conversation_id', ids),
        sb.from('messages').select('id, conversation_id, sender_id, body, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(1500),
      ]);
      members = mr.data || []; msgs = (gr.data || []).reverse();
    }
    await fetchProfiles(members.map((m) => m.user_id));
    const read = (S.cloudRead ||= {});
    const old = new Map(S.chats.filter((c) => c.cloud).map((c) => [c.id, c]));
    S.chats = S.chats.filter((c) => !c.cloud);
    convs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).forEach((cv) => {
      const mem = members.filter((m) => m.conversation_id === cv.id);
      const others = mem.filter((m) => m.user_id !== me);
      const prev = old.get(chid(cv.id));
      const list = msgs.filter((m) => m.conversation_id === cv.id).map(mapCloudMsg);
      // keep messages of mine that are still on their way, and anything only on this device
      (prev?.messages || []).forEach((m) => { if ((m.localOnly || (m.from === 'me' && !m.sbId && m.status !== 'failed')) && !list.some((x) => x.id === m.id)) list.push(m); });
      list.sort((a, b) => a.t - b.t);
      const base = { id: chid(cv.id), sbId: cv.id, cloud: true, unread: list.filter((m) => m.from !== 'me' && m.t > (read[cv.id] || 0)).length, messages: [{ id: 'sys_' + cv.id, type: 'system', from: 'system', t: Date.parse(cv.created_at), text: SYS_E2E }, ...list] };
      ['pinned', 'muted', 'archived', 'translate', 'live', 'privacy', 'draft'].forEach((k) => { if (prev && prev[k] !== undefined) base[k] = prev[k]; });
      if (cv.kind === 'direct') {
        const other = others[0]; if (!other) return;
        S.chats.push({ ...base, type: 'direct', contactId: cuid(other.user_id) });
      } else {
        S.chats.push({ ...base, type: 'group', name: cv.name, emoji: cv.emoji, color: cv.color, description: '', members: others.map((m) => cuid(m.user_id)), admins: mem.filter((m) => m.role === 'admin').map((m) => (m.user_id === me ? 'me' : cuid(m.user_id))) });
      }
    });
    if (ui.active?.startsWith('sb_') && !chatById(ui.active)) ui.active = null;
    save();
    renderRail(); refreshSidebar();
    if (ui.active?.startsWith('sb_')) { renderChatSub(); renderBars(); renderMessages({ keep: true }); }
  })().finally(() => { CL.syncing = null; });
  return CL.syncing;
}
function mapCloudMsg(m) {
  return { id: 'sm_' + m.id, sbId: m.id, type: 'text', text: m.body, from: m.sender_id === CL.user.id ? 'me' : cuid(m.sender_id), t: Date.parse(m.created_at), status: 'delivered', reactions: {} };
}

// ---------- live updates
function cloudSubscribe() {
  cloudUnsubscribe();
  const me = CL.user.id;
  CL.channel = sb.channel('wm-' + me)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onCloudMessage(p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: 'user_id=eq.' + me }, () => { cloudSync().then(() => toast('🌐 You were added to a new chat')); })
    .subscribe();
}
function cloudUnsubscribe() { if (CL.channel) { sb.removeChannel(CL.channel); CL.channel = null; } }
async function onCloudMessage(r) {
  let ch = chatById(chid(r.conversation_id));
  if (!ch) { await cloudSync(); ch = chatById(chid(r.conversation_id)); if (!ch) return; }
  if (ch.messages.some((m) => m.sbId === r.id)) return;
  if (r.sender_id === CL.user.id) {
    const mine = ch.messages.find((m) => m.from === 'me' && !m.sbId && m.pendingBody === r.body);
    if (mine) { Object.assign(mine, { sbId: r.id, status: 'delivered' }); delete mine.pendingBody; refreshMsg(ch); return; }
  } else if (!contact(cuid(r.sender_id))) await fetchProfiles([r.sender_id]);
  if (ch.type === 'group' && r.sender_id !== CL.user.id && !ch.members.includes(cuid(r.sender_id))) ch.members.push(cuid(r.sender_id));
  const m = mapCloudMsg(r);
  ch.messages.push(m);
  if (m.from !== 'me') {
    if (ui.active === ch.id && document.visibilityState === 'visible') (S.cloudRead ||= {})[ch.sbId] = m.t;
    else { ch.unread = (ch.unread || 0) + 1; notify(ch, m.from, { text: m.text }); }
  }
  save();
  if (ch.id === ui.active) { renderMessages(); renderSmart(); }
  refreshSidebar(); renderRail();
}

// ---------- sending: text goes to Supabase; other kinds stay on this device for now
const _sendMsgCloud = sendMsg;
sendMsg = function (ch, partial, opts) {
  if (!ch?.cloud) return _sendMsgCloud(ch, partial, opts);
  if (partial?.type !== 'text' || !cloudOn()) {
    const m = _sendMsgCloud(ch, partial, opts);
    if (m) m.localOnly = true;
    if (!CL.noted.has(ch.id)) { CL.noted.add(ch.id); toast(cloudOn() ? 'Only text messages sync in live chats for now — this one stays on this device' : 'Sign in to send live messages'); }
    return m;
  }
  const m = _sendMsgCloud(ch, partial, opts);
  if (!m) return m;
  m.status = 'sent'; m.pendingBody = m.text;
  sb.from('messages').insert({ conversation_id: ch.sbId, body: m.text }).select('id, created_at').single().then(({ data, error }) => {
    if (error) { m.status = 'failed'; toast('Message not sent: ' + error.message); refreshMsg(ch); return; }
    if (!ch.messages.some((x) => x !== m && x.sbId === data.id)) { m.sbId = data.id; m.t = Date.parse(data.created_at); }
    else ch.messages.splice(ch.messages.indexOf(m), 1); // the live update already added it
    m.status = 'delivered'; delete m.pendingBody;
    refreshMsg(ch);
  });
  return m;
};
// Real chats have real people: no simulated ticks, typing or bot replies
const _progressTicksCloud = progressTicks;
progressTicks = function (ch, m) { if (!ch?.cloud) _progressTicksCloud(ch, m); };
const _scheduleReplyCloud = scheduleReply;
scheduleReply = function (ch, trig) { if (!ch?.cloud) return _scheduleReplyCloud(ch, trig); };
const _openChatCloud = openChat;
openChat = function (id, opts) {
  _openChatCloud(id, opts);
  const ch = chatById(id);
  if (ch?.cloud) { (S.cloudRead ||= {})[ch.sbId] = lastTime(ch); save(); }
};
const _extraBarsCloud = extraBarsHTML;
extraBarsHTML = function (ch) {
  return _extraBarsCloud(ch) + (ch.cloud ? `<div class="bar cloudbar">${icon('cloud', 18)}<span class="grow">Live chat · text syncs instantly between real accounts. Photos, payments and other items stay on this device for now.</span></div>` : '');
};

// ---------- start a 1:1 chat, create and grow groups
async function startCloudDM(uid) {
  if (!cloudOn()) return openAccountFlow('signin');
  const p = CL.found.get(uid); if (p) upsertCloudContact(p);
  const { data, error } = await sb.rpc('start_direct', { other: uid });
  if (error) return toast('Could not start the chat: ' + error.message);
  await cloudSync();
  ui.page = null; ui.tab = 'chats'; renderRail(); renderSidebar();
  openChat(chid(data));
}
const _createGroupCloud = createGroup;
createGroup = async function () {
  const picked = [...ui.ngPick];
  const real = picked.filter((id) => contact(id)?.cloud);
  if (!real.length) return _createGroupCloud();
  const name = ui.ngName.trim();
  if (!name) return toast('Enter a group name');
  if (real.length !== picked.length) return toast('A live group can only include people with WHATSMORE accounts. Untick the demo contacts, or make a separate demo group.');
  if (!cloudOn()) return openAccountFlow('signin');
  const { data, error } = await sb.rpc('create_group', { p_name: name, p_emoji: '👥', p_members: real.map(rawId) });
  if (error) return toast('Could not create the group: ' + error.message);
  ui.ngName = ''; ui.ngQuery = ''; ui.ngPick.clear(); ui.page = null;
  await cloudSync();
  renderSidebar(); openChat(chid(data));
  toast(`Live group “${name}” created`);
};
const _addMembersCloud = addMembers;
addMembers = function (ch, ids, how) {
  if (!ch?.cloud) return _addMembersCloud(ch, ids, how);
  const real = ids.filter((id) => contact(id)?.cloud && !ch.members.includes(id));
  if (real.length !== ids.length) toast('Only people with WHATSMORE accounts can join a live group');
  if (!real.length) return 0;
  sb.rpc('add_group_members', { c: ch.sbId, p_members: real.map(rawId) }).then(({ error }) => { if (error) toast('Could not add: ' + error.message); else cloudSync(); });
  return real.length;
};

// ---------- new chat: search real accounts by @username or name
const _newChatListCloud = newChatListHTML;
newChatListHTML = function () {
  const q = (ui.ncQuery || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._ ]/g, '');
  let h = _newChatListCloud();
  if (!sb) return h;
  if (!cloudOn()) return `<div class="hint-box cloud-hint">${icon('cloud', 18)}<span><b>Chat with real people:</b> <button class="link-btn" data-act="cloudsignin">sign in or create an account</button> to find friends by their @username.</span></div>` + h;
  if (q.length < 2) return `<div class="hint-box cloud-hint">${icon('cloud', 18)}<span>Type at least 2 letters of a friend's <b>@username</b> to find their real WHATSMORE account.</span></div>` + h;
  clearTimeout(CL.searchT);
  CL.searchT = setTimeout(() => cloudSearch(q), 250);
  return `<div id="nc-cloud"><div class="list-label">WHATSMORE accounts</div><div class="empty-list small">Searching…</div></div>` + h;
};
async function cloudSearch(q) {
  const { data, error } = await sb.from('profiles').select('id, username, name, about, color').or(`username.ilike.%${q}%,name.ilike.%${q}%`).neq('id', CL.user.id).limit(20);
  const box = $('#nc-cloud');
  const cur = (ui.ncQuery || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._ ]/g, '');
  if (!box || cur !== q) return;
  if (error) { box.innerHTML = `<div class="empty-list small">Search failed: ${esc(error.message)}</div>`; return; }
  (data || []).forEach((p) => CL.found.set(p.id, p));
  box.innerHTML = '<div class="list-label">WHATSMORE accounts</div>' + ((data || []).length
    ? data.map((p) => `<div class="chat-item" data-act="sbdm" data-uid="${p.id}">${avatarHTML(p)}<div class="ci-body"><div class="ci-top"><span class="ci-name">${esc(p.name)}</span><span class="pill live-acct">Live</span></div><div class="ci-bottom"><span class="ci-preview">@${esc(p.username)} · ${esc(p.about)}</span></div></div></div>`).join('')
    : `<div class="empty-list small">No account found for “${esc(q)}”.</div>`);
}

// ---------- sign-up / sign-in screens (replace the demo OTP screens)
const ACC = { name: '', un: '', email: '' };
function accountScreen(step) {
  const back = '<button class="link-btn" data-act="ob" data-go="welcome">← Back</button>';
  if (step === 'acct-signup') return `<div class="ob-card">${logoSVG(56)}<h2>Create your account</h2><p class="muted small">Friends find you by your unique @username. Your email stays private.</p>
    <label class="field"><span>Your name</span><input id="ac-name" maxlength="40" value="${esc(ACC.name)}" placeholder="e.g. Anil Kumar" autocomplete="name" autofocus></label>
    <label class="field"><span>Choose a unique username</span><div class="un-input"><b>@</b><input id="ac-un" maxlength="24" value="${esc(ACC.un)}" placeholder="anilkumar" autocapitalize="off" spellcheck="false" autocomplete="username"></div><small id="ac-un-st" class="un-status"></small></label>
    <label class="field"><span>Email</span><input id="ac-email" type="email" value="${esc(ACC.email)}" placeholder="you@example.com" autocomplete="email"></label>
    <label class="field"><span>Password (at least 8 characters)</span><input id="ac-pw" type="password" minlength="8" autocomplete="new-password"></label>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="acct-create">Create account</button>
    <button class="link-btn" data-act="ob" data-go="acct-signin">I already have an account</button>${back}</div>`;
  if (step === 'acct-signin') return `<div class="ob-card">${logoSVG(56)}<h2>Sign in</h2>
    <label class="field"><span>Email</span><input id="ac-email" type="email" value="${esc(ACC.email)}" placeholder="you@example.com" autocomplete="email" autofocus></label>
    <label class="field"><span>Password</span><input id="ac-pw" type="password" autocomplete="current-password"></label>
    <div class="err" id="ob-err"></div>
    <button class="btn primary block" data-act="ob" data-go="acct-login">Sign in</button>
    <button class="link-btn" data-act="ob" data-go="acct-forgot">Forgot password?</button>
    <button class="link-btn" data-act="ob" data-go="acct-signup">Create a new account</button>${back}</div>`;
  return null;
}
const _obScreenCloud = obScreen;
obScreen = function () {
  const a = accountScreen(OB.step);
  if (a) return a;
  if (OB.step === 'welcome' && sb) return `<div class="ob-card">${logoSVG(64)}<h2>Welcome to WHATSMORE</h2><p class="muted">Chat. AI. Pay. Business. Services. Community.<br>One secure app for your digital life.</p>
    <label class="field"><span>App language</span><select id="ob-lang">${ONB_LANGS.map(([k, l]) => `<option value="${k}" ${k === (S.settings.myLang || 'en') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn primary block" data-act="ob" data-go="acct-signup">${icon('personadd', 18)} Create an account</button>
    <button class="btn block" data-act="ob" data-go="acct-signin">${icon('person', 18)} Sign in</button>
    <p class="muted small">By continuing you agree to the Terms and Privacy Policy.</p>
    <button class="link-btn" data-act="ob" data-go="skip">Try the demo without an account</button></div>`;
  if (OB.step === 'done' && cloudOn()) return _obScreenCloud().replace('your phone number stays private', 'your email stays private');
  return _obScreenCloud();
};
const _renderObCloud = renderOnboarding;
renderOnboarding = function () { _renderObCloud(); if (OB.step === 'acct-signup') acCheckUn(); };
function acCheckUn() {
  const inp = $('#ac-un'), st = $('#ac-un-st');
  if (!inp || !st) return;
  const v = inp.value.trim().toLowerCase();
  if (!v) { st.className = 'un-status'; st.textContent = ''; return; }
  if (!/^[a-z0-9._]{3,24}$/.test(v)) { st.className = 'un-status bad'; st.textContent = '3–24 characters: letters, numbers, dot or underscore'; return; }
  st.className = 'un-status'; st.textContent = 'Checking…';
  clearTimeout(acCheckUn.t);
  acCheckUn.t = setTimeout(async () => {
    const { data, error } = await sb.rpc('username_available', { u: v });
    if ($('#ac-un')?.value.trim().toLowerCase() !== v) return;
    st.className = 'un-status ' + (error ? '' : data ? 'ok' : 'bad');
    st.textContent = error ? 'Could not check right now' : data ? `✓ @${v} is available` : `@${v} is already taken`;
  }, 300);
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'ac-un') { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); acCheckUn(); }
});
const busy = (on) => { const b = $('#onboard .btn.primary'); if (b) { b.disabled = on; b.classList.toggle('loading', on); } };
const _obCloud = XA.ob;
XA.ob = async (el) => {
  const go = el.dataset.go;
  if (!go.startsWith('acct')) return _obCloud(el);
  if (!sb) return toast('Accounts are unavailable — the Supabase library did not load');
  if (go === 'acct-signup' || go === 'acct-signin') { const l = $('#ob-lang'); if (l) S.settings.myLang = l.value; OB.step = go; return renderOnboarding(); }
  const email = $('#ac-email')?.value.trim() || '', pw = $('#ac-pw')?.value || '';
  ACC.email = email;
  if (go === 'acct-forgot') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return obErr('Enter your email above first');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    return error ? obErr(error.message) : toast('📨 If that email has an account, a reset link is on its way (limited to a few emails per hour)', null, { ms: 6000 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return obErr('Enter a valid email address');
  if (go === 'acct-login') {
    if (!pw) return obErr('Enter your password');
    busy(true);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    busy(false);
    if (error) return obErr(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
    await cloudSignedIn(data.user);
    closeOnboarding(); renderRail(); renderSidebar(); renderMain();
    return toast(`👋 Welcome back, ${S.me.name.split(' ')[0]}!`);
  }
  if (go === 'acct-create') {
    const name = $('#ac-name').value.trim(), un = $('#ac-un').value.trim().toLowerCase();
    Object.assign(ACC, { name, un });
    if (!name) return obErr('Enter your name');
    if (!/^[a-z0-9._]{3,24}$/.test(un)) return obErr('Username: 3–24 letters, numbers, dot or underscore');
    if (pw.length < 8) return obErr('Password must be at least 8 characters');
    busy(true);
    const { data: free } = await sb.rpc('username_available', { u: un });
    if (free === false) { busy(false); return obErr(`@${un} is already taken — try another`); }
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { name, username: un, color: S.me.color || '#1565d8' } } });
    busy(false);
    if (error) return obErr(/database error/i.test(error.message) ? `@${un} was just taken — try another` : /registered/i.test(error.message) ? 'That email already has an account — sign in instead' : error.message);
    if (!data.session) return obErr('Account created. Check your email to confirm it, then sign in.');
    await cloudSignedIn(data.user);
    Object.assign(OB, { name, un, hidePhone: true });
    S.settings.onboarded = true; save();
    OB.step = 'done';
    return renderOnboarding();
  }
};

// ---------- session lifecycle
async function cloudSignedIn(user) {
  CL.user = user;
  let p = null;
  for (let i = 0; i < 4 && !p; i++) {
    const { data } = await sb.from('profiles').select('id, username, name, about, color').eq('id', user.id).maybeSingle();
    p = data; if (!p) await new Promise((r) => setTimeout(r, 400));
  }
  if (!p) { // the account was deleted: drop the stale session instead of half-signing in
    await sb.auth.signOut().catch(() => {});
    cloudSignedOut();
    return toast('That account no longer exists — please sign in or create a new one');
  }
  Object.assign(S.me, { name: p.name, username: p.username, about: p.about, color: p.color, cloudId: p.id, email: user.email });
  S.settings.onboarded = true;
  save();
  closeOnboarding();
  cloudSubscribe();
  await cloudSync();
}
function cloudSignedOut() {
  cloudUnsubscribe();
  CL.user = null;
  S.chats = S.chats.filter((c) => !c.cloud);
  S.contacts = S.contacts.filter((c) => !c.cloud);
  delete S.me.cloudId; delete S.me.email;
  if (ui.active?.startsWith('sb_')) ui.active = null;
  save(); renderRail(); renderSidebar(); renderMain();
}
function openAccountFlow(step) { if (!sb) return toast('Accounts are unavailable right now'); startOnboarding(); OB.step = step; renderOnboarding(); }
Object.assign(XA, {
  sbdm(el) { startCloudDM(el.dataset.uid); },
  cloudsignin() { openAccountFlow('acct-signin'); },
  cloudsignup() { openAccountFlow('acct-signup'); },
  async cloudsignout() {
    confirmModal('Sign out?', 'Your live chats stay safe in your account. Demo chats on this device are kept.', 'Sign out', async () => { await sb.auth.signOut(); cloudSignedOut(); toast('Signed out'); }, false);
  },
});
const _tabSettingsCloud = tabSettings;
tabSettings = function () {
  const row = !sb ? '' : cloudOn()
    ? `<div class="list-row action" data-act="cloudsignout"><span class="action-ic plain">${icon('cloud', 22)}</span><div class="grow"><div class="ci-name">Signed in · live account</div><div class="ci-sub">${esc(CL.user.email || '')} · @${esc(S.me.username)} · tap to sign out</div></div></div>`
    : `<div class="list-row action" data-act="cloudsignin"><span class="action-ic plain">${icon('cloud', 22)}</span><div class="grow"><div class="ci-name">Sign in or create an account</div><div class="ci-sub">Chat live with real people by @username</div></div>${icon('chevright', 20, 'muted')}</div>`;
  return _tabSettingsCloud().replace(/(<div class="profile-card"[\s\S]*?<\/div><\/div><button[\s\S]*?<\/button><\/div>)/, '$1' + row);
};
// Profile edits go to the account when signed in
const _saveProfileCloud = saveProfile;
saveProfile = async function () {
  if (!cloudOn()) return _saveProfileCloud();
  const name = $('#pf-name').value.trim(), un = $('#pf-un').value.trim().toLowerCase(), about = $('#pf-about').value.trim() || 'Hey there! I am using WHATSMORE.';
  if (!name) return toast('Name cannot be empty');
  if (!/^[a-z0-9._]{3,24}$/.test(un)) return toast('Username: 3–24 letters, numbers, dot or underscore');
  const { error } = await sb.from('profiles').update({ name, username: un, about, color: S.me.color }).eq('id', CL.user.id);
  if (error) return toast(/duplicate|unique/i.test(error.message) ? `@${un} is already taken` : 'Could not save: ' + error.message);
  Object.assign(S.me, { name, username: un, about });
  save(); renderRail(); renderSidebar(); toast('Profile saved to your account');
};
// Password reset links land back here
sb?.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    setTimeout(() => modal({ title: 'Set a new password', body: '<label class="field"><span>New password (at least 8 characters)</span><input id="np-pw" type="password" minlength="8" autocomplete="new-password" autofocus></label>',
      actions: [{ label: 'Save', primary: true, onClick: (root) => { const pw = $('#np-pw', root).value; if (pw.length < 8) { toast('At least 8 characters'); return false; } sb.auth.updateUser({ password: pw }).then(({ error }) => toast(error ? error.message : 'Password updated')); } }] }), 300);
  }
  if (event === 'SIGNED_OUT' && CL.user) cloudSignedOut();
  if (event === 'TOKEN_REFRESHED' && session) CL.user = session.user;
});
// Restore a saved session once the app data is loaded
const cloudInit = async () => {
  if (!S) return setTimeout(cloudInit, 50);
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (data.session) await cloudSignedIn(data.session.user);
  else if (S.chats.some((c) => c.cloud)) cloudSignedOut();
};
setTimeout(cloudInit, 0);
window.addEventListener('focus', () => { if (cloudOn()) cloudSync(); });
