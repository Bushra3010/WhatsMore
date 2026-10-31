// Info drawer, header menu, stories, calls, media lightbox
'use strict';

function headMenu(anchor) {
  const ch = chatById(ui.active);
  if (!ch) return;
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  showMenu(anchor, [
    { label: ch.type === 'group' ? 'Group info' : c.business ? 'Business info' : 'Contact info', icon: 'info', onClick: () => openDrawer('info') },
    { label: 'Search', icon: 'search', onClick: () => A.chatsearch() },
    { label: 'AI summary', icon: 'sparkle', onClick: () => aiSummaryModal(ch) },
    ch.messages.some((m) => m.tr) && { label: ch.translate ? 'Hide translations' : 'Translate chat', icon: 'translate', onClick: () => A['translate-toggle']() },
    c?.business && { label: 'View catalogue', icon: 'bag', onClick: () => catalogModal(ch) },
    { label: 'Payments', icon: 'rupee', onClick: () => payModal(ch) },
    { label: 'Disappearing messages', icon: 'timer', onClick: () => disappearModal(ch) },
    { label: ch.locked ? 'Unlock chat' : 'Lock chat', icon: 'lock', onClick: () => toggleLock(ch) },
    { label: 'Starred messages', icon: 'star', onClick: () => openDrawer('starred') },
    { label: ch.muted ? 'Unmute notifications' : 'Mute notifications', icon: 'mute', onClick: () => { ch.muted = !ch.muted; save(); refreshSidebar(); renderDrawer(); toast(ch.muted ? 'Notifications muted' : 'Notifications unmuted'); } },
    ...extraHeadItems(ch),
    '-',
    { label: 'Clear chat', icon: 'delete', onClick: () => clearChat(ch) },
    c && { label: c.blocked ? 'Unblock' : 'Block', icon: 'block', danger: true, onClick: () => toggleBlock(c) },
    c && { label: 'Report', icon: 'info', danger: true, onClick: () => reportModal(c) },
    ch.type === 'group' && !ch.left && { label: 'Exit group', icon: 'logout', danger: true, onClick: () => exitGroup(ch) },
  ]);
}

// ---------- drawer
function openDrawer(kind) { ui.drawer = kind; ui.memQuery = ''; ui.memLimit = MEM_PAGE; renderDrawer(); }
const MEM_PAGE = 20;
// Paginated so groups of any size stay fast
function memberListHTML(ch) {
  const q = ui.memQuery.trim().toLowerCase().replace(/^@/, '');
  const admins = new Set(ch.admins || []);
  let ids = ['me', ...ch.members].sort((a, b) => (admins.has(b) ? 1 : 0) - (admins.has(a) ? 1 : 0) || (a === 'me' ? -1 : b === 'me' ? 1 : 0));
  if (q) ids = ids.filter((id) => { const p = id === 'me' ? S.me : contact(id); return p && (p.name.toLowerCase().includes(q) || p.username.includes(q)); });
  const shown = ids.slice(0, ui.memLimit);
  return shown.map((id) => { const p = id === 'me' ? S.me : contact(id); return `<div class="info-row member" data-act="member" data-id="${id}">${avatarHTML(p, 40)}<div class="grow"><div>${id === 'me' ? 'You' : esc(p.name)}</div><div class="ci-sub">@${esc(p.username)}</div></div>${admins.has(id) ? '<span class="pill">Admin</span>' : ''}</div>`; }).join('') +
    (ids.length > shown.length ? `<button class="link-row" data-act="memmore">View more (${(ids.length - shown.length).toLocaleString()} remaining)</button>` : '') +
    (!ids.length ? '<div class="empty-list small">No members found</div>' : '');
}
function renderDrawer() {
  const ch = chatById(ui.active);
  if (!ui.drawer || !ch) { app.classList.remove('drawer-open'); drawer.innerHTML = ''; return; }
  app.classList.add('drawer-open');
  const head = (t) => `<header class="drawer-head"><button class="icon-btn" data-act="drawer-close" aria-label="Close">${icon('close')}</button><h3>${esc(t)}</h3></header>`;
  if (ui.drawer === 'starred') {
    drawer.innerHTML = head('Starred messages') + `<div class="drawer-body">${starredList(ch.messages.filter((m) => m.starred && m.type !== 'deleted').map((m) => ({ c: ch, m })))}</div>`;
    return;
  }
  const c = ch.type === 'direct' ? contact(ch.contactId) : null;
  const media = ch.messages.filter((m) => ['image', 'video', 'doc'].includes(m.type));
  const starredN = ch.messages.filter((m) => m.starred).length;
  const row = (act, ic, title, sub = '', extra = '') => `<div class="info-row" data-act="${act}">${icon(ic, 22, 'muted')}<div class="grow"><div>${title}</div>${sub ? `<div class="ci-sub">${sub}</div>` : ''}</div>${extra}</div>`;
  let html = '';
  if (c) {
    html += `<div class="info-sec hero">${avatarHTML(c, 160)}<h2>${esc(c.name)}${verifiedHTML(c)}</h2><div class="accent">@${esc(c.username)}</div><div class="ci-sub">${c.business ? esc(c.business.category) + ' · Business account' : 'Phone number hidden · connected by username'}</div>
      <div class="info-actions"><button data-act="call-voice">${icon('call')}<span>Audio</span></button><button data-act="call-video">${icon('video')}<span>Video</span></button><button data-act="paymodal">${icon('rupee')}<span>Pay</span></button><button data-act="chatsearch">${icon('search')}<span>Search</span></button></div></div>`;
    html += `<div class="info-sec"><div class="info-label">About</div><div>${esc(c.about || '—')}</div></div>`;
    if (c.business) {
      const b = c.business;
      html += `<div class="info-sec"><div class="info-label">Business details</div>
        <div class="biz-row">${icon('timer', 18, 'muted')}<span>${esc(b.hours)}</span></div><div class="biz-row">${icon('store', 18, 'muted')}<span>${esc(b.address)}</span></div>
        <div class="biz-row">${icon('link', 18, 'muted')}<span class="accent">${esc(b.website)}</span></div><div class="biz-row">${icon('rupee', 18, 'muted')}<span>${esc(b.payments)}</span></div></div>
        <div class="info-sec"><div class="info-label row-between"><span>Catalogue</span><button class="link-btn" data-act="catalog">See all</button></div><div class="mini-cat">${(S.catalog[c.id] || []).map((p) => `<button class="mini-prod" data-act="catalog"><div class="prod-art" style="background:${p.bg}">${p.emoji}</div><span>${money(p.price)}</span></button>`).join('')}</div></div>`;
    }
  } else {
    html += `<div class="info-sec hero">${chatAvatar(ch, 160)}<h2>${esc(ch.name)}</h2><div class="ci-sub">Group · ${(ch.members.length + 1).toLocaleString()} members${ch.community ? ' · ' + esc(S.communities.find((x) => x.id === ch.community)?.name || '') : ''}</div>
      <div class="info-actions"><button data-act="call-voice">${icon('call')}<span>Audio</span></button><button data-act="call-video">${icon('video')}<span>Video</span></button><button data-act="paymodal">${icon('rupee')}<span>Split</span></button><button data-act="aisummary">${icon('sparkle')}<span>Summary</span></button></div></div>
      <div class="info-sec" ${isAdmin(ch) ? 'data-act="editdesc"' : ''}><div class="info-label">Description</div><div>${esc(ch.description || (isAdmin(ch) ? 'Add group description' : 'No description'))}</div></div>`;
  }
  html += `<div class="info-sec"><div class="info-label row-between"><span>Media, links and docs</span><span class="ci-sub">${media.length}</span></div><div class="media-strip">${media.slice(-6).reverse().map((m) => `<button class="media-thumb" data-act="openmsg" data-chat="${ch.id}" data-mid="${m.id}">${m.type === 'image' ? (m.src ? `<img src="${m.src}" alt="">` : `<div style="background:${m.art.bg}">${m.art.emoji}</div>`) : `<div class="doc-thumb">${esc((m.ext || 'vid').toUpperCase())}</div>`}</button>`).join('') || '<span class="ci-sub">No media yet</span>'}</div></div>`;
  html += `<div class="info-sec list">
    ${row('drawer-starred', 'star', 'Starred messages', '', `<span class="ci-sub">${starredN || 'None'}</span>`)}
    ${row('mute', 'mute', 'Mute notifications', '', `<input type="checkbox" class="switch" ${ch.muted ? 'checked' : ''} tabindex="-1">`)}
    ${row('disappear', 'timer', 'Disappearing messages', ch.disappearing ? DISAPPEAR[ch.disappearing][0] : 'Off')}
    ${row('lock-toggle', 'lock', 'Chat lock', ch.locked ? 'Locked · hidden from chat list' : 'Lock and hide this chat on this device', `<input type="checkbox" class="switch" ${ch.locked ? 'checked' : ''} tabindex="-1">`)}
    ${ch.messages.some((m) => m.tr) ? row('translate-toggle', 'translate', 'Translate messages', 'Show English translations', `<input type="checkbox" class="switch" ${ch.translate ? 'checked' : ''} tabindex="-1">`) : ''}
    ${row('verify', 'lock', 'Encryption', 'Messages and calls are end-to-end encrypted. Tap to verify.')}
  </div>`;
  if (ch.type === 'group') {
    const total = ch.members.length + 1;
    html += `<div class="info-sec list"><div class="info-label pad-x row-between"><span>${total.toLocaleString()} members</span><span class="muted small">No limit</span></div>
      ${isAdmin(ch) && !ch.left ? `<div class="info-row" data-act="addmember"><span class="action-ic">${icon('personadd', 20)}</span><div class="grow">Add members</div></div>
      <div class="info-row" data-act="invitelink"><span class="action-ic">${icon('link', 20)}</span><div class="grow">Invite to group via link</div></div>` : ''}
      ${total > 8 ? `<div class="pad-x"><div class="search">${icon('search', 18)}<input id="mem-search" placeholder="Search ${total.toLocaleString()} members" value="${esc(ui.memQuery)}" autocomplete="off"></div></div>` : ''}
      <div id="mem-list">${memberListHTML(ch)}</div>
    </div>`;
    if (isAdmin(ch)) html += `<div class="info-sec list"><div class="info-label pad-x">Admin controls</div>${row('toggle-readonly', 'megaphone', 'Only admins can send messages', 'Turn the group into an announcement channel', `<input type="checkbox" class="switch" ${ch.readOnly ? 'checked' : ''} tabindex="-1">`)}</div>`;
  }
  html += `<div class="info-sec list danger">
    ${c ? row('block', 'block', c.blocked ? 'Unblock ' + esc(c.name) : 'Block ' + esc(c.name)) + row('report', 'info', 'Report ' + esc(c.name)) : ''}
    ${ch.type === 'group' && !ch.left ? row('exitgroup', 'logout', 'Exit group') : ''}
    ${row('deletechat', 'delete', 'Delete chat')}
  </div>`;
  drawer.innerHTML = head(ch.type === 'group' ? 'Group info' : c.business ? 'Business info' : 'Contact info') + `<div class="drawer-body">${html}</div>`;
}

// ---------- stories
function openStatus(idx) {
  const order = [...S.statuses.filter((s) => !s.viewed), ...S.statuses.filter((s) => s.viewed)];
  ui.story = { owners: order.map((s) => ({ ref: s, who: contact(s.contactId), items: s.items })), oi: Math.max(0, order.indexOf(S.statuses[idx])), ii: 0 };
  renderStory();
}
function openMyStatus() {
  if (!S.myStatus.items.length) return addStatusModal();
  ui.story = { owners: [{ ref: null, who: S.me, items: S.myStatus.items, mine: true }], oi: 0, ii: 0 };
  renderStory();
}
function renderStory() {
  clearTimeout(ui.storyTimer);
  const st = ui.story;
  if (!st) return;
  let el = $('#story');
  if (!el) { el = document.createElement('div'); el.id = 'story'; el.className = 'story'; overlayRoot.appendChild(el); }
  el.classList.remove('paused');
  const o = st.owners[st.oi], it = o.items[st.ii];
  if (o.ref && st.ii === o.items.length - 1) o.ref.viewed = true;
  if (o.mine) it.views = it.views || 0;
  el.innerHTML = `<div class="story-inner">
    <div class="story-bars">${o.items.map((_, i) => `<div class="sbar"><div class="sfill ${i < st.ii ? 'done' : i === st.ii ? 'run' : ''}"></div></div>`).join('')}</div>
    <div class="story-head">${avatarHTML(o.who, 40)}<div class="grow"><div class="sh-name">${o.mine ? 'My status' : esc(o.who.name)}${o.ref?.business ? ' · <span class="pill biz">Business</span>' : ''}</div><div class="sh-time">${listTime(it.t)}${it.privacy ? ' · ' + privacyLabel(it.privacy) : ''}</div></div>
      ${o.mine ? `<button class="icon-btn light" data-act="story-delete" aria-label="Delete status">${icon('delete')}</button>` : ''}<button class="icon-btn light" data-act="story-close" aria-label="Close">${icon('close')}</button></div>
    <div class="story-stage" style="background:${it.type === 'text' ? it.bg : '#000'}">
      ${it.type === 'voice' ? voiceStoryHTML(it) : it.type === 'text' ? `<div class="story-text">${fmtText(it.text)}</div>` : it.src ? `<img src="${it.src}" alt="">` : `<div class="story-art" style="background:${it.art.bg}"><span>${it.art.emoji}</span></div>`}
      ${it.caption ? `<div class="story-caption">${esc(it.caption)}</div>` : ''}
      <button class="story-nav prev" data-act="story-prev" aria-label="Previous"></button><button class="story-nav next" data-act="story-next" aria-label="Next"></button>
    </div>
    <div class="story-foot">${o.mine ? `<div class="story-views">👁 ${it.views} view${it.views === 1 ? '' : 's'}</div>` : `<div class="story-reacts">${['❤️', '😂', '😮', '🔥', '👏', '🙏'].map((e) => `<button data-act="story-react" data-e="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div><div class="story-reply"><input id="story-input" placeholder="Reply to ${esc(o.who.name.split(' ')[0])}…" autocomplete="off"><button class="icon-btn light" data-act="story-send" aria-label="Send reply">${icon('send')}</button></div>`}</div>
  </div>`;
  ui.storyTimer = setTimeout(storyNext, 5000);
  const inp = $('#story-input');
  if (inp) {
    inp.addEventListener('focus', () => { clearTimeout(ui.storyTimer); el.classList.add('paused'); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') A['story-send'](); });
  }
}
function storyNext() {
  const st = ui.story; if (!st) return;
  if (st.ii < st.owners[st.oi].items.length - 1) st.ii++;
  else if (st.oi < st.owners.length - 1) { st.oi++; st.ii = 0; }
  else return closeStory();
  renderStory();
}
function storyPrev() {
  const st = ui.story; if (!st) return;
  if (st.ii > 0) st.ii--;
  else if (st.oi > 0) { st.oi--; st.ii = 0; }
  renderStory();
}
function closeStory() { clearTimeout(ui.storyTimer); ui.story = null; $('#story')?.remove(); save(); renderRail(); if (ui.tab === 'status' && !ui.page) renderSidebar(); }
function storyReply(text) {
  const st = ui.story, o = st.owners[st.oi], it = o.items[st.ii];
  if (o.mine || !text) return;
  let ch = directChatFor(o.who.id);
  if (!ch) return;
  const m = sendMsg(ch, { type: 'text', text, statusQuote: { who: o.who.name, text: it.text || it.caption || 'Photo', bg: it.bg || it.art?.bg || '#333' } });
  scheduleReply(ch, m);
  toast('Reply sent to ' + o.who.name);
}
function addStatusModal() {
  const bgs = ['#5e35b1', '#00a884', '#e91e63', '#0288d1', '#f4511e', '#37474f', '#c2185b'];
  let bg = bgs[0], photo = null;
  modal({
    title: 'New status',
    body: `<div class="seg"><button class="on" data-st="text">Text</button><button data-st="photo">Photo</button></div>
      <div id="st-text-wrap"><textarea id="st-text" class="status-compose" style="background:${bg}" rows="4" maxlength="400" placeholder="Type a status" autofocus></textarea>
      <div class="swatches">${bgs.map((c, i) => `<button class="swatch ${i === 0 ? 'on' : ''}" style="background:${c}" data-bg="${c}" aria-label="Background ${c}"></button>`).join('')}</div></div>
      <div id="st-photo-wrap" hidden><div class="media-preview" id="st-prev"><button class="btn" id="st-pick">${icon('image', 18)} Choose photo</button></div><label class="field"><span>Caption</span><input id="st-cap" maxlength="200"></label></div>
      <label class="field"><span>Who can see this?</span><select id="st-priv">${PRIVACY_OPTS.map(([v, l]) => `<option value="${v}" ${v === S.settings.privacy.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Post', primary: true, onClick: (root) => {
        const mode = $('.seg .on', root).dataset.st, privacy = $('#st-priv', root).value, t = Date.now();
        let item;
        if (mode === 'text') { const text = $('#st-text', root).value.trim(); if (!text) { toast('Type something first'); return false; } item = { type: 'text', text, bg, t, privacy, views: 0 }; }
        else { if (!photo) { toast('Choose a photo'); return false; } item = { type: 'image', src: photo, caption: $('#st-cap', root).value.trim(), t, privacy, views: 0 }; }
        S.myStatus.items.push(item);
        save(); renderSidebar(); toast('Status posted · ' + privacyLabel(privacy));
        [3000, 7000, 12000].forEach((d) => setTimeout(() => { if (privacy !== 'private') { item.views++; save(); } }, d));
      },
    }],
    onMount: (root) => root.addEventListener('click', async (e) => {
      const s = e.target.closest('[data-st]'), b = e.target.closest('[data-bg]');
      if (s) { $$('.seg button', root).forEach((x) => x.classList.toggle('on', x === s)); $('#st-text-wrap', root).hidden = s.dataset.st !== 'text'; $('#st-photo-wrap', root).hidden = s.dataset.st !== 'photo'; }
      if (b) { bg = b.dataset.bg; $('#st-text', root).style.background = bg; $$('.swatch', root).forEach((x) => x.classList.toggle('on', x === b)); }
      if (e.target.closest('#st-pick')) {
        const files = await pickFile('file-status');
        if (!files[0]) return;
        try { photo = await readImage(files[0], 1080); $('#st-prev', root).innerHTML = `<img src="${photo}" alt="">`; } catch (err) { toast('Could not read that image'); }
      }
    }),
  });
}

// ---------- calls
async function startCall(ch, video, opts = {}) {
  if (ui.call) return toast('You are already in a call');
  if (ch?.type === 'direct' && contact(ch.contactId)?.blocked) return toast('Unblock this contact to call them');
  const call = ui.call = { ch, video, state: 'calling', start: null, muted: false, camOff: false, blur: false, stream: null, screen: null, room: opts.room || null, joined: [] };
  renderCall();
  if (video) await getCam(call);
  call.ringT = setTimeout(() => {
    if (ui.call !== call) return;
    call.state = call.room ? 'waiting' : 'ringing';
    renderCall();
    call.ansT = setTimeout(() => {
      if (ui.call !== call) return;
      if (call.room) call.joined = ['c_siva'];
      call.state = 'connected';
      call.start = Date.now();
      renderCall();
      call.timer = setInterval(() => { const s = $('#call-status'); if (s && ui.call?.start) s.textContent = fmtDur((Date.now() - ui.call.start) / 1000); }, 1000);
      if (call.room) setTimeout(() => { if (ui.call === call) { call.joined.push('c_ananya'); renderCall(); toast('Ananya joined the call'); } }, 4000);
    }, call.room ? 3500 : 2400);
  }, 1200);
}
async function getCam(call) {
  try { call.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); call.camErr = false; }
  catch (e) { call.camErr = true; }
  if (ui.call === call) renderCall(); else call.stream?.getTracks().forEach((t) => t.stop());
}
function renderCall() {
  const call = ui.call;
  let el = $('#call');
  if (!call) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'call'; el.className = 'call'; overlayRoot.appendChild(el); }
  const title = call.room ? 'WHATSMORE Call Room' : chatTitle(call.ch);
  const label = { calling: 'Calling…', ringing: 'Ringing…', waiting: 'Waiting for others to join…', connected: call.start ? fmtDur((Date.now() - call.start) / 1000) : '0:00' }[call.state];
  const all = (call.room ? call.joined : call.ch.type === 'group' ? call.ch.members : []).filter((id) => !(call.removed || []).includes(id));
  const people = all.slice(0, 11), extra = all.length - people.length;
  const grid = people.length > 0 && call.state === 'connected';
  el.innerHTML = `
    <div class="call-top">${icon('lock', 14)} End-to-end encrypted${call.room ? ` · whatsmore.app/call/${esc(call.room)}` : ''}</div>
    <div class="call-stage">
      ${call.screen ? `<video id="screen-vid" autoplay playsinline muted></video><div class="screen-label">${icon('screen', 16)} You are presenting · <span id="call-status">${label}</span></div>` :
      grid ? `<div class="call-grid-wrap"><div class="call-title">${esc(title)} · <span id="call-status">${label}</span></div><div class="call-grid">${people.map((id) => `<div class="tile">${avatarHTML(contact(id), 84)}<span>${esc(contact(id).name)}</span><span class="tile-mic">${icon('mic', 14)}</span></div>`).join('')}${extra > 0 ? `<div class="tile more"><b>+${extra.toLocaleString()}</b><span>more in call</span></div>` : ''}</div></div>` :
      `<div class="call-hero">${call.room ? `<div class="action-ic big">${icon('link', 40)}</div>` : chatAvatar(call.ch, 128)}<h2>${esc(title)}</h2><div class="call-status" id="call-status">${label}</div><div class="call-kind">${call.video ? 'WHATSMORE video call' : 'WHATSMORE voice call'}</div></div>`}
      ${call.video ? `<div class="self-view ${call.blur ? 'blur' : ''}">${call.stream && !call.camOff ? '<video id="self-vid" autoplay playsinline muted></video>' : `<div class="self-off">${call.camErr ? 'Camera unavailable' : 'Camera off'}</div>`}<span>You${call.blur ? ' · blur on' : ''}</span></div>` : ''}
      ${callPlusStageHTML(call)}
    </div>
    <div class="call-controls">
      <button class="cbtn ${call.muted ? 'on' : ''}" data-act="call-mute" title="${call.muted ? 'Unmute' : 'Mute'}" aria-label="Mute">${icon(call.muted ? 'micoff' : 'mic')}</button>
      <button class="cbtn ${call.video && !call.camOff ? '' : 'on'}" data-act="call-cam" title="Camera" aria-label="Camera">${icon(call.video && !call.camOff ? 'video' : 'videooff')}</button>
      ${call.video ? `<button class="cbtn ${call.blur ? 'on' : ''}" data-act="call-blur" title="Background blur" aria-label="Background blur">${icon('blur')}</button>` : ''}
      <button class="cbtn ${call.screen ? 'on' : ''}" data-act="call-screen" title="Share screen" aria-label="Share screen">${icon('screen')}</button>
      ${call.room ? `<button class="cbtn" data-act="call-copylink" title="Copy link" aria-label="Copy call link">${icon('link')}</button>` : ''}
      ${callPlusButtonsHTML(call)}
      <button class="cbtn end" data-act="call-end" title="End call" aria-label="End call">${icon('callend')}</button>
    </div>`;
  const sv = $('#self-vid'); if (sv && call.stream) sv.srcObject = call.stream;
  const scr = $('#screen-vid'); if (scr && call.screen) scr.srcObject = call.screen;
}
async function toggleScreen() {
  const call = ui.call;
  if (!call) return;
  if (call.screen) { call.screen.getTracks().forEach((t) => t.stop()); call.screen = null; return renderCall(); }
  try {
    call.screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    call.screen.getVideoTracks()[0].onended = () => { if (ui.call === call) { call.screen = null; renderCall(); } };
    renderCall();
  } catch (e) { toast('Screen sharing was cancelled or is unavailable'); }
}
function endCall() {
  const call = ui.call;
  if (!call) return;
  clearTimeout(call.ringT); clearTimeout(call.ansT); clearInterval(call.timer);
  call.stream?.getTracks().forEach((t) => t.stop());
  call.screen?.getTracks().forEach((t) => t.stop());
  ui.call = null;
  renderCall();
  if (call.ch) {
    const dur = call.start ? Math.round((Date.now() - call.start) / 1000) : 0;
    S.calls.push({ id: uid(), chatId: call.ch.id, dir: 'out', video: call.video, t: Date.now(), dur, missed: !dur });
    sendMsg(call.ch, { type: 'call', video: call.video, dur, missed: !dur });
    if (ui.tab === 'calls') renderSidebar();
  }
  toast(call.start ? 'Call ended · ' + fmtDur((Date.now() - call.start) / 1000) : 'Call cancelled');
}

// ---------- media lightbox
function viewMedia(m) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.id = 'lightbox';
  el.innerHTML = `<div class="lb-head">${avatarHTML(m.from === 'me' ? S.me : contact(m.from), 40)}<div class="grow"><div>${esc(senderName(m.from))}</div><div class="ci-sub">${dayLabel(m.t)} at ${fmtTime(m.t)}</div></div><button class="icon-btn" data-act="lb-close" aria-label="Close">${icon('close')}</button></div>
    <div class="lb-stage" data-act="lb-close">${m.src ? `<img src="${m.src}" alt="">` : `<div class="lb-art" style="background:${m.art.bg}">${m.art.emoji}</div>`}</div>
    ${m.caption ? `<div class="lb-cap">${esc(m.caption)}</div>` : ''}`;
  overlayRoot.appendChild(el);
}
