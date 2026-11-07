// Real stories (statuses) between WHATSMORE accounts, through Supabase.
// Your status posts are stored for 24 hours and shown to the audience you pick: Everyone, Contacts
// (people you share a chat with), Close friends or Only me. Viewers are recorded so you see real
// view counts. Demo statuses keep working alongside.
'use strict';
const ST_BUCKET = 'status-media';
const STV = { loading: null, uploading: new Set(), reloadT: 0, urls: new Map() };
const AUDIENCE = { everyone: 'everyone', contacts: 'contacts', selected: 'contacts', close: 'close', private: 'private' };

// ---------- load other people's statuses
async function loadCloudStatuses() {
  if (!cloudOn()) return;
  if (STV.loading) return STV.loading;
  STV.loading = (async () => {
    const me = CL.user.id;
    const { data, error } = await sb.from('statuses').select('id, user_id, kind, body, bg, caption, media_path, duration, created_at, expires_at').gt('expires_at', new Date().toISOString()).order('created_at');
    if (error) return;
    const others = data.filter((s) => s.user_id !== me), mine = data.filter((s) => s.user_id === me);
    await fetchProfiles(others.map((s) => s.user_id));
    const paths = others.map((s) => s.media_path).filter((p) => p && !STV.urls.has(p));
    if (paths.length) {
      const { data: signed } = await sb.storage.from(ST_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
      (signed || []).forEach((d) => { if (d.signedUrl) STV.urls.set(d.path, d.signedUrl); });
    }
    const seen = (S.cloudSeenStatus ||= {});
    const byUser = new Map();
    others.forEach((s) => {
      const it = { sid: s.id, t: Date.parse(s.created_at), type: s.kind === 'video' ? 'image' : s.kind, caption: s.caption || '' };
      if (s.kind === 'text') Object.assign(it, { text: s.body, bg: s.bg || '#1565d8' });
      else if (s.kind === 'voice') Object.assign(it, { src: STV.urls.get(s.media_path) || '', dur: s.duration || 1, bg: s.bg || '#1565d8' });
      else Object.assign(it, { src: STV.urls.get(s.media_path) || '', art: { bg: '#263238', e: '📷' } });
      (byUser.get(s.user_id) || byUser.set(s.user_id, []).get(s.user_id)).push(it);
    });
    S.statuses = S.statuses.filter((s) => !s.cloud);
    byUser.forEach((items, uid) => S.statuses.unshift({ contactId: cuid(uid), items, cloud: true, viewed: items.every((i) => seen[i.sid]) }));
    // my own: real view counts, and tidy up expired posts
    const { data: views } = mine.length ? await sb.from('status_views').select('status_id').in('status_id', mine.map((s) => s.id)) : { data: [] };
    const counts = {}; (views || []).forEach((v) => { counts[v.status_id] = (counts[v.status_id] || 0) + 1; });
    S.myStatus.items.forEach((it) => { if (it.sid) it.views = counts[it.sid] || 0; });
    const live = new Set(mine.map((s) => s.id));
    S.myStatus.items = S.myStatus.items.filter((it) => !it.sid || live.has(it.sid) || Date.now() - it.t < 60000);
    save();
    if (ui.tab === 'status' && !ui.page) renderSidebar();
    renderRail();
  })().finally(() => { STV.loading = null; });
  return STV.loading;
}
function scheduleStatusReload() { clearTimeout(STV.reloadT); STV.reloadT = setTimeout(loadCloudStatuses, 600); }

// ---------- post my statuses (anything new in My status gets uploaded)
async function uploadStatus(it) {
  if (!cloudOn() || it.sid || it.localOnly || STV.uploading.has(it)) return;
  STV.uploading.add(it);
  try {
    const id = crypto.randomUUID(), me = CL.user.id;
    const row = { id, kind: it.type === 'voice' ? 'voice' : it.type === 'text' ? 'text' : 'image', audience: AUDIENCE[it.privacy] || 'contacts', caption: it.caption || null };
    if (it.type === 'text') Object.assign(row, { body: it.text, bg: /^#[0-9a-f]{3,8}$/i.test(it.bg || '') ? it.bg : null });
    else {
      if (!it.src) { it.localOnly = true; return; }
      const blob = await (await fetch(it.src)).blob();
      const ext = it.type === 'voice' ? 'webm' : (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${me}/${id}.${ext}`;
      const up = await sb.storage.from(ST_BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream' });
      if (up.error) throw up.error;
      Object.assign(row, { media_path: path, duration: it.type === 'voice' ? Math.round(it.dur || 1) : null, bg: /^#[0-9a-f]{3,8}$/i.test(it.bg || '') ? it.bg : null });
      it.mediaPath = path;
    }
    const { error } = await sb.from('statuses').insert(row);
    if (error) throw error;
    it.sid = id; it.views = 0; it.cloudAudience = row.audience;
    save();
    toast(`🌐 Status shared with ${{ everyone: 'everyone', contacts: 'your contacts', close: 'your close friends', private: 'only you' }[row.audience]}`);
  } catch (e) {
    it.uploadFailed = true;
    toast('Status not shared: ' + (e.message || e));
  } finally { STV.uploading.delete(it); }
}
const _saveStories = save;
save = function () {
  _saveStories();
  if (cloudOn() && S.myStatus?.items?.length) S.myStatus.items.forEach((it) => { if (!it.sid && !it.localOnly && !it.uploadFailed && Date.now() - it.t < 60000) setTimeout(() => uploadStatus(it), 0); });
};

// ---------- viewing, replying, deleting
const _renderStoryCloud = renderStory;
renderStory = function () {
  _renderStoryCloud();
  const st = ui.story; if (!st) return;
  const o = st.owners[st.oi], it = o.items[st.ii];
  if (!o.mine && it?.sid && cloudOn() && !(S.cloudSeenStatus ||= {})[it.sid]) {
    S.cloudSeenStatus[it.sid] = Date.now();
    sb.from('status_views').upsert({ status_id: it.sid }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true }).then(() => {});
  }
  if (o.mine && it?.sid) { const f = $('#story .story-views'); if (f) f.innerHTML = `👁 ${it.views || 0} view${it.views === 1 ? '' : 's'} · ${{ everyone: 'Everyone', contacts: 'Contacts', close: 'Close friends', private: 'Only me' }[it.cloudAudience] || 'Shared'} <button class="link-btn light" data-act="story-viewers">Who viewed</button>`; }
};
const _storyReplyCloud = storyReply;
storyReply = async function (text) {
  const st = ui.story, o = st?.owners[st.oi];
  if (o && !o.mine && o.who?.cloud && !directChatFor(o.who.id) && cloudOn()) {
    const { error } = await sb.rpc('start_direct', { other: rawId(o.who.id) });
    if (error) return toast('Could not reply: ' + error.message);
    await cloudSync();
  }
  return _storyReplyCloud(text);
};
XA['story-delete'] = () => {
  const st = ui.story, it = S.myStatus.items[st.ii];
  S.myStatus.items.splice(st.ii, 1); save(); closeStory(); toast('Status deleted');
  if (it?.sid && cloudOn()) {
    sb.from('statuses').delete().eq('id', it.sid).then(({ error }) => { if (error) toast('Could not delete it for everyone: ' + error.message); });
    if (it.mediaPath) sb.storage.from(ST_BUCKET).remove([it.mediaPath]);
  }
};
XA['story-viewers'] = async () => {
  const st = ui.story, it = S.myStatus.items[st?.ii];
  if (!it?.sid) return;
  clearTimeout(ui.storyTimer); $('#story')?.classList.add('paused');
  const { data } = await sb.from('status_views').select('viewer_id, viewed_at').eq('status_id', it.sid).order('viewed_at', { ascending: false });
  await fetchProfiles((data || []).map((v) => v.viewer_id));
  modal({ title: `Viewed by ${(data || []).length}`, body: (data || []).length ? (data || []).map((v) => `<div class="set-row">${avatarHTML(contact(cuid(v.viewer_id)), 36)}<div class="grow"><div class="ci-name">${esc(senderName(cuid(v.viewer_id)))}</div><div class="ci-sub">${listTime(Date.parse(v.viewed_at))}</div></div></div>`).join('') : '<p class="muted">No views yet.</p>', actions: [{ label: 'Close', primary: true }] });
};

// ---------- close friends (for statuses shared with "Close friends")
async function closeFriendsModal() {
  if (!cloudOn()) return openAccountFlow('acct-signin');
  const { data } = await sb.from('close_friends').select('friend_id');
  const picked = new Set((data || []).map((r) => r.friend_id));
  const people = S.contacts.filter((c) => c.cloud);
  modal({
    title: 'Close friends',
    body: people.length ? `<p class="muted small">Statuses shared with “Close friends” are seen only by these people.</p><div class="pick-list">${people.map((c) => `<label class="chat-item check-row">${avatarHTML(c, 40)}<div class="ci-body"><div class="ci-name">${esc(c.name)}</div><div class="ci-preview">@${esc(c.username)}</div></div><input type="checkbox" class="check" data-cf="${rawId(c.id)}" ${picked.has(rawId(c.id)) ? 'checked' : ''}></label>`).join('')}</div>`
      : '<p class="muted">Start a live chat with someone first, then add them here.</p>',
    actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: (root) => {
      const now = new Set($$('[data-cf]', root).filter((i) => i.checked).map((i) => i.dataset.cf));
      const add = [...now].filter((x) => !picked.has(x)), del = [...picked].filter((x) => !now.has(x));
      Promise.all([
        add.length ? sb.from('close_friends').insert(add.map((f) => ({ friend_id: f }))) : null,
        del.length ? sb.from('close_friends').delete().in('friend_id', del) : null,
      ]).then((rs) => { const err = rs.find((r) => r?.error); toast(err ? 'Not saved: ' + err.error.message : `Close friends saved · ${now.size} ${now.size === 1 ? 'person' : 'people'}`); });
    } }],
  });
}
XA.closefriends = () => closeFriendsModal();
const _tabStatusCloud = tabStatus;
tabStatus = function () {
  const h = _tabStatusCloud();
  if (!cloudOn()) return h;
  return h.replace('<div class="hint-box">', `<div class="list-row action" data-act="closefriends"><span class="action-ic plain">${icon('heart', 22)}</span><div class="grow"><div class="ci-name">Close friends</div><div class="ci-sub">Choose who sees statuses shared with “Close friends”</div></div>${icon('chevright', 20, 'muted')}</div><div class="hint-box">`);
};

// ---------- live: new statuses from people I can see, and views on mine
let stChannel = null;
function subscribeStatuses() {
  if (stChannel) sb.removeChannel(stChannel);
  stChannel = sb.channel('wm-status-' + CL.user.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'statuses' }, () => scheduleStatusReload())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'statuses' }, () => scheduleStatusReload())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_views' }, (p) => {
      const it = S.myStatus.items.find((x) => x.sid === p.new.status_id);
      if (it) { it.views = (it.views || 0) + 1; save(); if (ui.story?.owners?.[0]?.mine) renderStory(); }
    })
    .subscribe();
}
const _cloudSyncStories = cloudSync;
cloudSync = async function () {
  const r = await _cloudSyncStories();
  if (cloudOn()) { if (!stChannel) subscribeStatuses(); scheduleStatusReload(); }
  return r;
};
const _cloudSignedOutStories = cloudSignedOut;
cloudSignedOut = function () {
  if (stChannel) { sb.removeChannel(stChannel); stChannel = null; }
  S.statuses = S.statuses.filter((s) => !s.cloud);
  _cloudSignedOutStories();
};
