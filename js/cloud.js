// Real accounts and live chats through Supabase.
// Email + password sign-up with a unique @username, find people by @username, and live 1:1 / group
// chats between real users: text, photos, videos, voice notes, documents, stickers, GIFs and locations,
// with replies, edits, delete-for-everyone, reactions, read receipts, typing and online status.
// Row-level security in the database means each person only ever receives conversations they belong to.
// Demo contacts and bots keep working alongside.
'use strict';
const SB_URL = 'https://nkmqdkkjdrvsconphnae.supabase.co';
// Publishable key: meant to be in the browser. Access is enforced by row-level security.
const SB_KEY = 'sb_publishable_vr2jTPISjmK4FBkmGNOQ8A_Ay5tx6se';
const sb = window.supabase?.createClient ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const CL = { user: null, channel: null, syncing: null, found: new Map(), searchT: 0, noted: new Set(), conv: new Map(), urls: new Map(), typingT: {}, typingSent: 0, readT: {} };
const cuid = (u) => 'u_' + u, chid = (c) => 'sb_' + c, rawId = (id) => String(id).replace(/^(u_|sb_|sm_)/, '');
const cloudOn = () => !!(sb && CL.user);
const SYS_E2E = 'This is a live chat with real WHATSMORE accounts. Messages, photos, voice notes and files sync instantly to everyone in the chat.';
const BUCKET = 'chat-media', MAX_MEDIA = 25 * 1024 * 1024;
const MEDIA_KINDS = ['image', 'video', 'voice', 'doc'];
// Simple, self-contained message types that can be shared as-is
const RICH = { sticker: ['text'], gif: ['gif'], location: ['lat', 'lng', 'name', 'acc', 'live'], poll: ['question', 'options', 'multi'], event: ['title', 'when', 'place'], payment: ['kind', 'amount', 'note', 'split'], contact: ['user'] };
const MSG_COLS = 'id, conversation_id, sender_id, kind, body, caption, payload, media_path, media_name, media_size, media_mime, duration, reply_to, edited_at, deleted_at, created_at';

// ---------- people
function upsertCloudContact(p) {
  const id = cuid(p.id);
  let c = contact(id);
  const fields = { name: p.name, username: p.username, about: p.about, color: p.color || '#1565d8', badge: p.badge || null };
  if (c) Object.assign(c, fields);
  else { c = { id, ...fields, isContact: true, cloud: true, online: false }; S.contacts.push(c); }
  return c;
}
async function fetchProfiles(ids) {
  const need = [...new Set(ids)].filter((x) => x && x !== CL.user?.id);
  if (!need.length) return;
  const { data } = await sb.from('profiles').select('id, username, name, about, color, badge').in('id', need);
  (data || []).forEach(upsertCloudContact);
}

// ---------- server row -> app message
function mapCloudMsg(r) {
  const base = { id: 'sm_' + r.id, sbId: r.id, from: r.sender_id === CL.user.id ? 'me' : cuid(r.sender_id), t: Date.parse(r.created_at), status: 'delivered', reactions: {} };
  if (r.reply_to) base.replyTo = 'sm_' + r.reply_to;
  if (r.edited_at) base.edited = true;
  const media = { mediaPath: r.media_path, size: r.media_size, caption: r.caption || '' };
  const url = r.media_path && CL.urls.get(r.media_path);
  switch (r.kind) {
    case 'text': return { ...base, type: 'text', text: r.body };
    case 'deleted': return { ...base, type: 'deleted' };
    case 'rich': {
      const p = r.payload || {}; const keep = RICH[p.type] || [];
      const o = { ...base, type: RICH[p.type] ? p.type : 'text', text: RICH[p.type] ? undefined : '[unsupported message]' };
      keep.forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; });
      if (p.type === 'poll') o.votes = {};
      if (p.type === 'event') o.going = [base.from];
      if (p.type === 'payment') { o.status = p.kind === 'send' ? 'paid' : 'pending'; o.paidBy = p.split ? [base.from] : []; }
      if (p.type === 'contact') { o.userId = cuid(p.user); delete o.user; }
      return o;
    }
    case 'image': return { ...base, ...media, type: 'image', src: url || '', art: { bg: 'linear-gradient(135deg,#cfd8dc,#eceff1)', emoji: '🖼️' } };
    case 'video': return { ...base, ...media, type: 'video', src: url || '' };
    case 'voice': return { ...base, ...media, type: 'voice', dur: r.duration || 1, src: url || '' };
    case 'doc': return { ...base, ...media, type: 'doc', name: r.media_name || 'file', ext: extOf(r.media_name || 'file'), url: url || '' };
  }
  return { ...base, type: 'text', text: r.body || '' };
}
// Private files are read through short-lived signed links
async function signMedia(paths) {
  const need = [...new Set(paths.filter((p) => p && !CL.urls.has(p)))];
  for (let i = 0; i < need.length; i += 100) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), 60 * 60 * 12);
    (data || []).forEach((d) => { if (d.signedUrl) { CL.urls.set(d.path, d.signedUrl); ui.blobs.add(d.signedUrl); } });
  }
}
function attachUrl(m) {
  const url = m.mediaPath && CL.urls.get(m.mediaPath);
  if (!url) return;
  if (m.type === 'doc') { if (!m.url || !ui.blobs.has(m.url)) m.url = url; }
  else if (!m.src || !(ui.blobs.has(m.src) || m.src.startsWith('data:'))) m.src = url;
}
function applyReaction(ch, r) {
  const m = ch?.messages.find((x) => x.sbId === r.message_id);
  if (!m) return false;
  const who = r.user_id === CL.user.id ? 'me' : cuid(r.user_id);
  m.reactions ||= {};
  Object.keys(m.reactions).forEach((k) => { m.reactions[k] = m.reactions[k].filter((x) => x !== who); if (!m.reactions[k].length) delete m.reactions[k]; });
  if (r.emoji) (m.reactions[r.emoji] ||= []).push(who);
  return true;
}
// Blue ticks: my message is read once everyone else has read up to it (and only if I share receipts too)
function applyReads(ch) {
  if (!ch?.cloud) return;
  const others = ch.type === 'direct' ? [ch.contactId] : ch.members;
  const upTo = S.settings.privacy.readReceipts && others.length ? Math.min(...others.map((id) => ch.readBy?.[id] || 0)) : 0;
  ch.messages.forEach((m) => { if (m.from === 'me' && m.sbId && m.status !== 'failed' && m.status !== 'sent') m.status = m.t <= upTo ? 'read' : 'delivered'; });
}

// ---------- full sync: my conversations, members, recent messages, reactions and files
async function cloudSync() {
  if (!cloudOn()) return;
  if (CL.syncing) return CL.syncing;
  CL.syncing = (async () => {
    const me = CL.user.id;
    const { data: mine, error } = await sb.from('members').select('conversation_id, conversations(id, kind, name, emoji, color, created_at)').eq('user_id', me);
    if (error) { toast('Could not load your chats: ' + error.message); return; }
    const convs = (mine || []).map((r) => r.conversations).filter(Boolean);
    const ids = convs.map((c) => c.id);
    let members = [], msgs = [], reacts = [], acts = [];
    if (ids.length) {
      const [mr, gr, rr, ar] = await Promise.all([
        sb.from('members').select('conversation_id, user_id, role, last_read_at').in('conversation_id', ids),
        sb.from('messages').select(MSG_COLS).in('conversation_id', ids).order('created_at', { ascending: false }).limit(1500),
        sb.from('reactions').select('message_id, user_id, conversation_id, emoji').in('conversation_id', ids).not('emoji', 'is', null),
        sb.from('message_actions').select('message_id, user_id, conversation_id, action, value').in('conversation_id', ids),
      ]);
      members = mr.data || []; msgs = (gr.data || []).reverse(); reacts = rr.data || []; acts = ar.data || [];
    }
    await Promise.all([fetchProfiles([...members.map((m) => m.user_id), ...msgs.filter((m) => m.payload?.type === 'contact').map((m) => m.payload.user)]), signMedia(msgs.map((m) => m.media_path))]);
    const read = (S.cloudRead ||= {});
    const old = new Map(S.chats.filter((c) => c.cloud).map((c) => [c.id, c]));
    S.chats = S.chats.filter((c) => !c.cloud);
    convs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).forEach((cv) => {
      const mem = members.filter((m) => m.conversation_id === cv.id);
      const others = mem.filter((m) => m.user_id !== me);
      const prev = old.get(chid(cv.id));
      const prevById = new Map((prev?.messages || []).map((m) => [m.id, m]));
      const list = msgs.filter((m) => m.conversation_id === cv.id).map((r) => {
        const m = mapCloudMsg(r), p = prevById.get(m.id);
        // keep my own local copies of files (instant, works offline) and per-device flags
        if (p && m.from === 'me' && (p.src || p.url) && m.type !== 'deleted') { if (p.src) m.src = p.src; if (p.url) m.url = p.url; if (p.data) m.data = p.data; if (p.content) m.content = p.content; }
        if (p) ['starred', 'pinned', 'played'].forEach((k) => { if (p[k]) m[k] = p[k]; });
        return m;
      });
      (prev?.messages || []).forEach((m) => { if ((m.localOnly || (m.from === 'me' && m.status === 'sent')) && !list.some((x) => x.id === m.id)) list.push(m); });
      list.sort((a, b) => a.t - b.t);
      const base = { id: chid(cv.id), sbId: cv.id, cloud: true, unread: list.filter((m) => m.from !== 'me' && m.t > (read[cv.id] || 0)).length, readBy: {}, messages: [{ id: 'sys_' + cv.id, type: 'system', from: 'system', t: Date.parse(cv.created_at), text: SYS_E2E }, ...list] };
      others.forEach((m) => { if (m.last_read_at) base.readBy[cuid(m.user_id)] = Date.parse(m.last_read_at); });
      ['pinned', 'muted', 'archived', 'translate', 'live', 'privacy', 'draft'].forEach((k) => { if (prev && prev[k] !== undefined) base[k] = prev[k]; });
      let ch;
      if (cv.kind === 'direct') {
        const other = others[0]; if (!other) return;
        ch = { ...base, type: 'direct', contactId: cuid(other.user_id) };
      } else {
        ch = { ...base, type: 'group', name: cv.name, emoji: cv.emoji, color: cv.color, description: '', members: others.map((m) => cuid(m.user_id)), admins: mem.filter((m) => m.role === 'admin').map((m) => (m.user_id === me ? 'me' : cuid(m.user_id))) };
      }
      reacts.filter((r) => r.conversation_id === cv.id).forEach((r) => applyReaction(ch, r));
      acts.filter((a) => a.conversation_id === cv.id).forEach((a) => applyAction(ch, a));
      if (ch.type === 'direct') ch.messages.forEach((m) => creditIncomingSend(ch, m));
      applyReads(ch);
      S.chats.push(ch);
    });
    if (ui.active?.startsWith('sb_') && !chatById(ui.active)) ui.active = null;
    save();
    ensureConvChannels();
    renderRail(); refreshSidebar();
    if (ui.active?.startsWith('sb_')) { renderChatSub(); renderBars(); renderMessages({ keep: true }); markRead(chatById(ui.active)); }
  })().finally(() => { CL.syncing = null; });
  return CL.syncing;
}

// ---------- live updates
function cloudSubscribe() {
  cloudUnsubscribe();
  const me = CL.user.id;
  CL.channel = sb.channel('wm-' + me)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onCloudMessage(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => onCloudMessageUpdate(p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (p) => { if (p.new?.message_id) { const ch = chatById(chid(p.new.conversation_id)); if (applyReaction(ch, p.new)) { save(); if (ch.id === ui.active) renderMessages({ keep: true }); } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_actions' }, (p) => { if (p.new?.message_id) { const ch = chatById(chid(p.new.conversation_id)); if (applyAction(ch, p.new)) { save(); if (ch.id === ui.active) renderMessages({ keep: true }); refreshSidebar(); } } })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members' }, (p) => onMemberUpdate(p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: 'user_id=eq.' + me }, () => { cloudSync().then(() => toast('🌐 You were added to a new chat')); })
    .subscribe();
}
function cloudUnsubscribe() {
  if (CL.channel) { sb.removeChannel(CL.channel); CL.channel = null; }
  CL.conv.forEach((c) => sb.removeChannel(c)); CL.conv.clear();
}
async function onCloudMessage(r) {
  let ch = chatById(chid(r.conversation_id));
  if (!ch) { await cloudSync(); ch = chatById(chid(r.conversation_id)); if (!ch) return; }
  if (ch.messages.some((m) => m.sbId === r.id)) return;
  if (r.sender_id !== CL.user.id && !contact(cuid(r.sender_id))) await fetchProfiles([r.sender_id]);
  if (r.media_path) await signMedia([r.media_path]);
  if (r.payload?.type === 'contact' && !contact(cuid(r.payload.user))) await fetchProfiles([r.payload.user]);
  if (ch.type === 'group' && r.sender_id !== CL.user.id && !ch.members.includes(cuid(r.sender_id))) ch.members.push(cuid(r.sender_id));
  const m = mapCloudMsg(r);
  if (ui.typing[ch.id]) { delete ui.typing[ch.id]; renderChatSub(); }
  ch.messages.push(m);
  creditIncomingSend(ch, m);
  if (m.from !== 'me') {
    if (ui.active === ch.id && document.visibilityState === 'visible') { (S.cloudRead ||= {})[ch.sbId] = m.t; markRead(ch); }
    else { ch.unread = (ch.unread || 0) + 1; notify(ch, m.from, preview(m)); }
  }
  save();
  if (ch.id === ui.active) { renderMessages(); renderSmart(); }
  refreshSidebar(); renderRail();
}
async function onCloudMessageUpdate(r) {
  const ch = chatById(chid(r.conversation_id));
  const i = ch?.messages.findIndex((m) => m.sbId === r.id);
  if (!ch || i < 0) return;
  const cur = ch.messages[i], next = mapCloudMsg(r);
  ['reactions', 'starred', 'pinned', 'played', 'status'].forEach((k) => { if (cur[k] !== undefined) next[k] = cur[k]; });
  if (next.type !== 'deleted' && cur.from === 'me') { if (cur.src) next.src = cur.src; if (cur.url) next.url = cur.url; }
  ch.messages[i] = next;
  save();
  if (ch.id === ui.active) renderMessages({ keep: true });
  refreshSidebar();
}
function onMemberUpdate(r) {
  if (r.user_id === CL.user.id || !r.last_read_at) return;
  const ch = chatById(chid(r.conversation_id));
  if (!ch) return;
  (ch.readBy ||= {})[cuid(r.user_id)] = Date.parse(r.last_read_at);
  applyReads(ch); save();
  if (ch.id === ui.active) renderMessages({ keep: true });
  refreshSidebar();
}
// Tell others I've read this chat (skipped when I've turned read receipts off)
function markRead(ch) {
  if (!ch?.cloud || !cloudOn() || document.visibilityState !== 'visible') return;
  (S.cloudRead ||= {})[ch.sbId] = lastTime(ch);
  if (!S.settings.privacy.readReceipts) return;
  clearTimeout(CL.readT[ch.sbId]);
  CL.readT[ch.sbId] = setTimeout(() => sb.rpc('mark_read', { c: ch.sbId }).then(() => {}), 400); // queries only run once then()-ed
}
document.addEventListener('visibilitychange', () => { if (ui.active?.startsWith('sb_')) markRead(chatById(ui.active)); });

// ---------- typing and online: Realtime broadcast + presence, one channel per conversation
function ensureConvChannels() {
  if (!cloudOn()) return;
  const want = new Set(S.chats.filter((c) => c.cloud).map((c) => c.sbId));
  CL.conv.forEach((chn, id) => { if (!want.has(id)) { sb.removeChannel(chn); CL.conv.delete(id); } });
  want.forEach((id) => {
    if (CL.conv.has(id)) return;
    const chn = sb.channel('wm-conv-' + id, { config: { presence: { key: CL.user.id }, broadcast: { self: false } } });
    chn.on('broadcast', { event: 'typing' }, ({ payload }) => onTyping(id, payload))
      .on('broadcast', { event: 'rtc' }, ({ payload }) => { if (typeof onRtcSignal === 'function') onRtcSignal(id, payload); })
      .on('presence', { event: 'sync' }, () => onPresence())
      .subscribe((st) => { if (st === 'SUBSCRIBED' && S.settings.privacy.lastSeen !== 'nobody') chn.track({ at: Date.now() }); });
    CL.conv.set(id, chn);
  });
}
function onTyping(convId, p) {
  const ch = chatById(chid(convId));
  if (!ch || !p?.uid || p.uid === CL.user?.id) return;
  ui.typing[ch.id] = (p.name || 'Someone').split(' ')[0];
  clearTimeout(CL.typingT[ch.id]);
  CL.typingT[ch.id] = setTimeout(() => { delete ui.typing[ch.id]; if (ui.active === ch.id) renderChatSub(); refreshSidebar(); }, 3500);
  if (ui.active === ch.id) renderChatSub();
  refreshSidebar();
}
function onPresence() {
  const online = new Set();
  CL.conv.forEach((chn) => Object.keys(chn.presenceState()).forEach((k) => online.add(k)));
  let changed = false;
  S.contacts.forEach((c) => {
    if (!c.cloud) return;
    const on = online.has(rawId(c.id));
    if (c.online !== on) { if (c.online && !on) c.lastSeen = Date.now(); c.online = on; changed = true; }
  });
  if (changed && ui.active?.startsWith('sb_')) renderChatSub();
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'input' || !ui.active?.startsWith('sb_') || !e.target.value.trim()) return;
  const ch = chatById(ui.active), chn = ch && CL.conv.get(ch.sbId);
  if (!chn || Date.now() - CL.typingSent < 2500) return;
  CL.typingSent = Date.now();
  chn.send({ type: 'broadcast', event: 'typing', payload: { uid: CL.user.id, name: S.me.name } });
});

// ---------- sending
const _sendMsgCloud = sendMsg;
sendMsg = function (ch, partial, opts) {
  if (!ch?.cloud) return _sendMsgCloud(ch, partial, opts);
  const kind = partial?.type;
  const localUrl = kind === 'doc' ? partial.url : partial?.src;
  const syncable = cloudOn() && (kind === 'text' || (RICH[kind] && (kind !== 'contact' || contact(partial.userId)?.cloud)) || (MEDIA_KINDS.includes(kind) && localUrl));
  const m = _sendMsgCloud(ch, partial, opts);
  if (!m) return m;
  if (!syncable) {
    m.localOnly = true;
    if (!CL.noted.has(ch.id + kind)) { CL.noted.add(ch.id + kind); toast(cloudOn() ? (kind === 'contact' ? 'Only contacts with WHATSMORE accounts can be shared in a live chat — this one stays on this device' : 'This item stays on this device') : 'Sign in to send live messages'); }
    return m;
  }
  const sid = crypto.randomUUID();
  const oldId = m.id;
  m.id = 'sm_' + sid; m.sbId = sid; m.status = 'sent';
  if (ui.replyTo === oldId) ui.replyTo = m.id;
  const reply_to = m.replyTo?.startsWith('sm_') ? rawId(m.replyTo) : null;
  refreshMsg(ch);
  (async () => {
    let row;
    if (kind === 'text') row = { kind: 'text', body: m.text };
    else if (RICH[kind]) { const payload = { type: kind }; RICH[kind].forEach((k) => { if (m[k] !== undefined) payload[k] = m[k]; }); if (kind === 'contact') payload.user = rawId(m.userId); row = { kind: 'rich', payload }; }
    else {
      const blob = await (await fetch(localUrl)).blob();
      if (blob.size > MAX_MEDIA) throw new Error('files must be 25 MB or smaller');
      const name = kind === 'doc' ? m.name : kind === 'voice' ? 'voice-note.webm' : kind === 'video' ? 'video' + (blob.type.includes('mp4') ? '.mp4' : '.webm') : 'photo.jpg';
      const path = `${ch.sbId}/${sid}-${name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
      if (up.error) throw up.error;
      m.mediaPath = path;
      row = { kind, media_path: path, media_name: name, media_size: blob.size, media_mime: blob.type || null, duration: kind === 'voice' ? Math.round(m.dur || 1) : null, caption: m.caption || null };
    }
    const { data, error } = await sb.from('messages').insert({ id: sid, conversation_id: ch.sbId, reply_to, ...row }).select('created_at').single();
    if (error) throw error;
    m.t = Date.parse(data.created_at); m.status = 'delivered';
    applyReads(ch); refreshMsg(ch);
  })().catch((err) => {
    m.status = 'failed'; refreshMsg(ch);
    // refused by the database: most likely a suspension made after this page loaded
    if (/row-level security/i.test(err.message || '') && typeof checkModeration === 'function') checkModeration(true);
    else toast('Not sent: ' + (err.message || err));
  });
  return m;
};
// Edits go to everyone (your own text, within 15 minutes)
const _sendTextCloud = sendText;
sendText = function () {
  const ch = chatById(ui.active);
  const editing = ch?.cloud && ui.editing ? ch.messages.find((x) => x.id === ui.editing) : null;
  const before = editing?.text;
  _sendTextCloud();
  if (editing?.sbId && editing.text !== before) {
    sb.rpc('edit_message', { m: editing.sbId, new_body: editing.text }).then(({ error }) => {
      if (!error) return;
      editing.text = before; editing.edited = false; refreshMsg(ch); toast('Not edited: ' + error.message);
    });
  }
};
const _deleteMsgModalCloud = deleteMsgModal;
deleteMsgModal = function (ch, m) {
  if (!ch?.cloud || !m.sbId || m.localOnly) return _deleteMsgModalCloud(ch, m);
  const acts = [{ label: 'Cancel' }];
  if (m.from === 'me' && m.type !== 'deleted' && m.status !== 'sent') acts.push({ label: 'Delete for everyone', danger: true, onClick: () => {
    sb.rpc('delete_message', { m: m.sbId }).then(({ data: path, error }) => {
      if (error) return toast('Not deleted: ' + error.message);
      if (path) sb.storage.from(BUCKET).remove([path]);
      const keep = { id: m.id, sbId: m.sbId, from: m.from, t: m.t, status: m.status, reactions: {} };
      Object.keys(m).forEach((k) => delete m[k]); Object.assign(m, keep, { type: 'deleted' });
      save(); renderMessages({ keep: true }); refreshSidebar();
    });
  } });
  acts.push({ label: 'Delete for me', danger: true, onClick: () => { ch.messages = ch.messages.filter((x) => x !== m); save(); renderMessages({ keep: true }); renderBars(); refreshSidebar(); } });
  modal({ title: 'Delete message?', body: `<p class="muted">${esc(preview(m)).slice(0, 120)}</p>`, actions: acts });
};
const _reactCloud = react;
react = function (ch, m, e) {
  _reactCloud(ch, m, e);
  if (!ch?.cloud || !m.sbId || m.localOnly) return;
  const mine = Object.entries(m.reactions || {}).find(([, v]) => v.includes('me'))?.[0] || null;
  sb.rpc('set_reaction', { m: m.sbId, e: mine }).then(({ error }) => { if (error) toast('Reaction not saved: ' + error.message); });
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
  if (ch?.cloud) { markRead(ch); save(); }
};
const _extraBarsCloud = extraBarsHTML;
extraBarsHTML = function (ch) {
  return _extraBarsCloud(ch) + (ch.cloud ? `<div class="bar cloudbar">${icon('cloud', 18)}<span class="grow">Live chat · messages, photos, voice notes, files, polls, events and payment requests sync instantly. Payments use demo money.</span></div>` : '');
};

// ---------- polls, events, payment requests: everyone's votes / RSVPs / payments, live
// Payments use the demo wallet on each device: no real money moves.
function creditOnce(key, amount, who, note) {
  S.cloudCredits ||= {};
  if (S.cloudCredits[key]) return;
  S.cloudCredits[key] = Date.now();
  S.wallet += amount;
  S.payments.push({ id: uid(), dir: 'in', amount, with: who, note: note || 'Payment', t: Date.now() });
}
function creditIncomingSend(ch, m) {
  if (ch.type === 'direct' && m.type === 'payment' && m.kind === 'send' && m.from !== 'me' && m.sbId) creditOnce('send:' + m.sbId, m.amount, senderName(m.from), m.note);
}
function applyAction(ch, a) {
  const m = ch?.messages.find((x) => x.sbId === a.message_id);
  if (!m) return false;
  const who = a.user_id === CL.user.id ? 'me' : cuid(a.user_id);
  if (a.action === 'vote' && m.type === 'poll') {
    m.votes ||= {};
    Object.keys(m.votes).forEach((k) => { m.votes[k] = m.votes[k].filter((x) => x !== who); if (!m.votes[k].length) delete m.votes[k]; });
    (Array.isArray(a.value) ? a.value : []).forEach((i) => { if (Number.isInteger(i) && i >= 0 && i < (m.options || []).length) (m.votes[i] ||= []).push(who); });
  } else if (a.action === 'rsvp' && m.type === 'event') {
    m.going = (m.going || []).filter((x) => x !== who);
    if (a.value === true) m.going.push(who);
  } else if (a.action === 'pay' && m.type === 'payment') {
    m.paidBy ||= [];
    if (!m.paidBy.includes(who)) m.paidBy.push(who);
    const done = m.split ? m.paidBy.length >= m.split.people : m.paidBy.some((x) => x !== m.from);
    if (done) m.status = 'paid';
    if (m.from === 'me' && who !== 'me') creditOnce(`${m.sbId}:${who}`, m.amount, senderName(who), m.note);
  } else if (a.action === 'decline' && m.type === 'payment' && ch.type === 'direct') {
    m.status = 'declined';
  } else return false;
  return true;
}
function sendAction(ch, m, action, value, undo) {
  if (!ch?.cloud || !m.sbId || m.localOnly || !cloudOn()) return;
  sb.rpc('set_action', { m: m.sbId, a: action, v: value }).then(({ error }) => {
    if (!error) return;
    toast('Not saved: ' + error.message);
    if (undo) { undo(); refreshMsg(ch); }
  });
}
const _voteCloud = vote;
vote = function (ch, m, i) {
  const before = JSON.stringify(m.votes || {});
  _voteCloud(ch, m, i);
  const mine = Object.entries(m.votes || {}).filter(([, v]) => v.includes('me')).map(([k]) => +k);
  sendAction(ch, m, 'vote', mine, () => { m.votes = JSON.parse(before); });
};
XA.going = (el) => {
  const ch = curChat(), m = msgOf(el);
  if (!m) return;
  const was = (m.going || []).includes('me');
  m.going = was ? m.going.filter((x) => x !== 'me') : [...(m.going || []), 'me'];
  refreshMsg(ch);
  sendAction(ch, m, 'rsvp', !was, () => { m.going = was ? [...m.going, 'me'] : m.going.filter((x) => x !== 'me'); });
};
XA['pay-decline'] = (el) => {
  const ch = curChat(), m = msgOf(el);
  if (!m) return;
  m.status = 'declined'; refreshMsg(ch);
  sendAction(ch, m, 'decline', true, () => { m.status = 'pending'; });
};
const _payRequestCloud = payRequest;
payRequest = function (ch, m) {
  if (!ch?.cloud || !m.sbId || m.localOnly) return _payRequestCloud(ch, m);
  if (S.wallet < m.amount) return toast('Insufficient demo balance');
  modal({
    title: 'Confirm payment',
    body: `<div class="pay-confirm">${avatarHTML(contact(m.from), 56)}<div class="muted">Paying ${esc(senderName(m.from))}</div><div class="pay-amount big">${money(m.amount)}</div>${m.note ? `<div class="muted">${esc(m.note)}</div>` : ''}</div>${note('Demo wallet: the amount moves between demo wallets only. No real money moves.', 'info')}`,
    actions: [{ label: 'Cancel' }, { label: 'Pay ' + money(m.amount), primary: true, onClick: () => {
      S.wallet -= m.amount;
      const rec = { id: uid(), dir: 'out', amount: m.amount, with: senderName(m.from), note: m.note || 'Payment', t: Date.now() };
      S.payments.push(rec);
      applyAction(ch, { message_id: m.sbId, user_id: CL.user.id, action: 'pay', value: { amount: m.amount } });
      refreshMsg(ch);
      toast(`Paid ${money(m.amount)} to ${senderName(m.from)} ✅`);
      sendAction(ch, m, 'pay', { amount: m.amount }, () => {
        S.wallet += m.amount; S.payments = S.payments.filter((x) => x !== rec);
        m.paidBy = (m.paidBy || []).filter((x) => x !== 'me'); m.status = 'pending';
      });
    } }],
  });
};
// Events in a live chat: no simulated RSVPs from real people
const _eventModalCloud = eventModal;
eventModal = function (ch) {
  if (!ch?.cloud) return _eventModalCloud(ch);
  const d = new Date(Date.now() + DAY); d.setHours(18, 0, 0, 0);
  const local = new Date(d - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  modal({
    title: 'Create event',
    body: `<label class="field"><span>Event name</span><input id="ev-t" maxlength="60" placeholder="e.g. Team dinner" autofocus></label>
      <label class="field"><span>Date & time</span><input id="ev-d" type="datetime-local" value="${local}"></label>
      <label class="field"><span>Location (optional)</span><input id="ev-p" maxlength="60" placeholder="Add a place"></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => {
      const title = $('#ev-t', root).value.trim(), when = new Date($('#ev-d', root).value).getTime();
      if (!title || !when) { toast('Add a name and date'); return false; }
      sendMsg(ch, { type: 'event', title, when, place: $('#ev-p', root).value.trim(), going: ['me'] });
    } }],
  });
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
  const { data, error } = await sb.from('profiles').select('id, username, name, about, color, badge').or(`username.ilike.%${q}%,name.ilike.%${q}%`).neq('id', CL.user.id).limit(20);
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
    const { data } = await sb.from('profiles').select('id, username, name, about, color, badge').eq('id', user.id).maybeSingle();
    p = data; if (!p) await new Promise((r) => setTimeout(r, 400));
  }
  if (!p) { // the account was deleted: drop the stale session instead of half-signing in
    await sb.auth.signOut().catch(() => {});
    cloudSignedOut();
    return toast('That account no longer exists — please sign in or create a new one');
  }
  Object.assign(S.me, { name: p.name, username: p.username, about: p.about, color: p.color, cloudId: p.id, email: user.email, badge: p.badge || null });
  const { data: mod } = await sb.rpc('my_moderation'); // your own suspension is private to you
  CL.suspended = mod?.suspended_until && Date.parse(mod.suspended_until) > Date.now() ? { until: Date.parse(mod.suspended_until), reason: mod.suspend_reason || '' } : null;
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
