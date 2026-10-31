// Left navigation rail + sidebar (chats, new chat, status, calls, communities, files)
'use strict';
// Mobile bottom bar follows the blueprint: Home | Chats | AI | Services | Profile. The rest live on Home.
const TABS = [['home', 'home', 'Home'], ['chats', 'chat', 'Chats'], ['status', 'status', 'Status', 1], ['calls', 'call', 'Calls', 1], ['communities', 'groups', 'Communities', 1], ['files', 'cloud', 'Files', 1], ['ai', 'sparkle', 'AI'], ['services', 'apps', 'Services']];

function renderRail() {
  const unread = S.chats.filter((c) => c.unread > 0 && !c.archived && !c.locked).length;
  const newStatus = S.statuses.some((s) => !s.viewed);
  const btn = (id, ic, label, desk) => `<button class="rail-btn ${ui.tab === id ? 'active' : ''} ${desk ? 'desk-only' : ''}" data-act="tab" data-tab="${id}" title="${label}" aria-label="${label}">
    <span class="rail-ic">${icon(ic)}</span>${id === 'chats' && unread ? `<span class="rail-badge">${unread}</span>` : ''}${id === 'status' && newStatus ? '<span class="rail-dot"></span>' : ''}<span class="rail-label">${label}</span></button>`;
  rail.innerHTML = `<div class="rail-top">${TABS.map((t) => btn(...t)).join('')}</div>
    <div class="rail-bottom">${btn('settings', 'settings', innerWidth <= 760 ? 'Profile' : 'Settings')}<button class="rail-me" data-act="tab" data-tab="settings" title="Profile" aria-label="Profile">${avatarHTML(S.me, 32)}</button></div>`;
}

function renderSidebar() {
  let html;
  const p = ui.page;
  if (p === 'newchat') html = pageNewChat();
  else if (p === 'newgroup') html = pageNewGroup();
  else if (p === 'archived') html = pageHead('Archived') + `<div class="side-scroll" id="chat-list" data-mode="archived">${chatListHTML('archived')}</div>`;
  else if (p === 'locked') html = pageHead('Locked chats') + `<div class="hint-box">${icon('lock', 16)} These chats are hidden from your chat list and need your PIN to open.</div><div class="side-scroll" id="chat-list" data-mode="locked">${chatListHTML('locked')}</div>`;
  else if (p === 'starred') html = pageHead('Starred messages') + `<div class="side-scroll">${starredList(allStarred())}</div>`;
  else if (p && p.startsWith('set-')) html = settingsPage(p);
  else html = ({ home: tabHome, chats: tabChats, status: tabStatus, calls: tabCalls, communities: tabCommunities, files: tabFiles, ai: tabAI, services: tabServices, settings: tabSettings })[ui.tab]();
  sidebar.innerHTML = html;
}
function refreshSidebar() {
  const list = $('#chat-list');
  if (list) { list.innerHTML = chatListHTML(list.dataset.mode || undefined); return; }
  if ($('#files-list')) { $('#files-list').innerHTML = filesListHTML(); return; }
  if (!ui.page && (ui.tab === 'communities' || ui.tab === 'calls')) renderSidebar();
}

const pageHead = (title, extra = '') => `<header class="side-head page"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button><h2>${esc(title)}</h2>${extra}</header>`;
const searchBox = (id, ph, val) => `<div class="search"><span class="search-ic">${icon('search', 20)}</span><input id="${id}" type="search" placeholder="${esc(ph)}" value="${esc(val)}" autocomplete="off" /><button class="icon-btn sm search-clear" data-act="clearsearch" data-for="${id}" aria-label="Clear search">${icon('close', 18)}</button></div>`;

// ---------- chats
function tabChats() {
  return `<header class="side-head"><h1 class="brand">WHATSMORE</h1><div class="head-actions">
      <button class="icon-btn" data-act="newchat" title="New chat" aria-label="New chat">${icon('newchat')}</button>
      <button class="icon-btn" data-act="chatsmenu" title="Menu" aria-label="Menu">${icon('more')}</button></div></header>
    <div class="side-tools">${searchBox('chat-search', 'Search or start a new chat', ui.search)}
      <div class="chips">${[['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups'], ['business', 'Business']].map(([k, l]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div></div>
    <div class="side-scroll" id="chat-list" data-mode="">${chatListHTML()}</div>`;
}

function chatListHTML(mode) {
  const q = ui.search.trim().toLowerCase();
  let list = S.chats.filter((c) => (mode === 'archived' ? c.archived && !c.locked : mode === 'locked' ? c.locked : !c.archived && !c.locked)).filter((c) => mode || profileMatch(c));
  if (!mode) {
    if (ui.filter === 'unread') list = list.filter((c) => c.unread > 0);
    if (ui.filter === 'groups') list = list.filter((c) => c.type === 'group');
    if (ui.filter === 'business') list = list.filter(isBiz);
  }
  let hits = [];
  if (q && !mode) {
    const pool = S.chats.filter((c) => !c.locked || ui.unlocked.has(c.id));
    const uq = q.replace(/^@/, '');
    list = pool.filter((c) => chatTitle(c).toLowerCase().includes(q) || (c.type === 'direct' && contact(c.contactId)?.username.includes(uq)));
    pool.forEach((c) => c.messages.forEach((m) => {
      if (m.type === 'system' || m.type === 'deleted') return;
      const txt = m.type === 'text' ? m.text + ' ' + (m.tr || '') : m.type === 'doc' ? m.name : m.caption || m.question || '';
      if (txt.toLowerCase().includes(q)) hits.push({ c, m });
    }));
    hits = hits.sort((a, b) => b.m.t - a.m.t).slice(0, 30);
  }
  list.sort((a, b) => (mode ? 0 : (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || lastTime(b) - lastTime(a));
  let html = '';
  if (!mode && !q) {
    const locked = S.chats.filter((c) => c.locked).length;
    const arch = S.chats.filter((c) => c.archived && !c.locked);
    if (locked) html += `<div class="list-row special" data-act="openlocked"><span class="special-ic">${icon('lock', 20)}</span><span class="ci-name">Locked chats</span><span class="ci-count">${locked}</span></div>`;
    if (arch.length) { const u = arch.filter((c) => c.unread).length; html += `<div class="list-row special" data-act="openarchived"><span class="special-ic">${icon('archive', 20)}</span><span class="ci-name">Archived</span><span class="ci-count ${u ? 'green' : ''}">${u || arch.length}</span></div>`; }
  }
  if (q && list.length) html += '<div class="list-label">Chats</div>';
  html += list.map(chatItemHTML).join('');
  if (hits.length) html += '<div class="list-label">Messages</div>' + hits.map(({ c, m }) => `<div class="chat-item" data-act="openmsg" data-chat="${c.id}" data-mid="${m.id}"><div class="ci-body"><div class="ci-top"><span class="ci-name">${esc(chatTitle(c))}</span><span class="ci-time">${listTime(m.t)}</span></div><div class="ci-bottom"><span class="ci-preview">${m.from === 'me' ? 'You: ' : c.type === 'group' ? esc(firstName(m.from)) + ': ' : ''}${highlight(preview(m) + (m.tr ? ' · ' + m.tr : ''), q)}</span></div></div></div>`).join('');
  if (q && !list.length && !hits.length) html += `<div class="empty-list">No chats or messages found for “${esc(q)}”.<br><button class="link-btn" data-act="newchat">Search @usernames on WHATSMORE</button></div>`;
  if (!q && !html) html = `<div class="empty-list">${mode === 'archived' ? 'No archived chats' : ui.filter !== 'all' ? 'Nothing in this filter' : 'No chats yet'}</div>`;
  return html;
}

function chatItemHTML(c) {
  const m = lastMsg(c);
  const typing = ui.typing[c.id];
  let pv = '';
  if (typing) pv = `<span class="typing-txt">${c.type === 'group' ? esc(typing) + ' is ' : ''}typing…</span>`;
  else if (ui.draft[c.id] && c.id !== ui.active) pv = `<span class="draft">Draft:</span> ${esc(ui.draft[c.id])}`;
  else if (m) {
    const who = m.type !== 'system' && c.type === 'group' && m.from !== 'me' ? esc(firstName(m.from)) + ': ' : '';
    pv = (m.from === 'me' && !['system', 'deleted', 'call'].includes(m.type) ? ticks(m.status) : '') + who + esc(preview(m));
  }
  return `<div class="chat-item ${ui.active === c.id ? 'active' : ''}" data-act="open" data-chat="${c.id}">
    ${chatAvatar(c)}
    <div class="ci-body">
      <div class="ci-top"><span class="ci-name">${esc(chatTitle(c))}${c.type === 'direct' ? verifiedHTML(contact(c.contactId)) : ''}</span><span class="ci-time ${c.unread && !c.muted ? 'unread' : ''}">${m ? listTime(m.t) : ''}</span></div>
      <div class="ci-bottom"><span class="ci-preview">${c.disappearing ? `<span class="dis-ic">${icon('timer', 14)}</span>` : ''}${pv}</span>
        <span class="ci-badges">${c.muted ? icon('mute', 18) : ''}${c.pinned ? icon('pin', 18) : ''}${c.unread ? `<span class="badge ${c.muted ? 'grey' : ''}">${c.unread}</span>` : ''}<button class="ci-menu" data-act="chatitemmenu" data-chat="${c.id}" aria-label="Chat options">${icon('chevdown', 20)}</button></span>
      </div>
    </div>
  </div>`;
}

function chatItemMenu(id, anchor) {
  const ch = chatById(id);
  if (!ch) return;
  const upd = (msg) => { save(); refreshSidebar(); renderRail(); if (msg) toast(msg); };
  showMenu(anchor, [
    { label: ch.archived ? 'Unarchive chat' : 'Archive chat', icon: 'archive', onClick: () => { ch.archived = !ch.archived; upd(ch.archived ? 'Chat archived' : 'Chat unarchived'); } },
    { label: ch.muted ? 'Unmute notifications' : 'Mute notifications', icon: 'mute', onClick: () => { ch.muted = !ch.muted; upd(ch.muted ? 'Notifications muted' : 'Notifications unmuted'); } },
    { label: ch.pinned ? 'Unpin chat' : 'Pin chat', icon: 'pin', onClick: () => { if (!ch.pinned && S.chats.filter((c) => c.pinned).length >= 3) return toast('You can only pin up to 3 chats'); ch.pinned = !ch.pinned; upd(); } },
    { label: ch.unread ? 'Mark as read' : 'Mark as unread', icon: 'chat', onClick: () => { ch.unread = ch.unread ? 0 : 1; upd(); } },
    { label: ch.locked ? 'Unlock chat' : 'Lock chat', icon: 'lock', onClick: () => toggleLock(ch) },
    '-',
    { label: 'Delete chat', icon: 'delete', danger: true, onClick: () => deleteChat(ch) },
  ]);
}
function chatsMenu(anchor) {
  showMenu(anchor, [
    { label: 'New group', icon: 'groups', onClick: () => { ui.page = 'newgroup'; renderSidebar(); } },
    { label: 'New community', icon: 'groups', onClick: newCommunityModal },
    { label: 'Starred messages', icon: 'star', onClick: () => { ui.page = 'starred'; renderSidebar(); } },
    { label: 'Archived chats', icon: 'archive', onClick: () => { ui.page = 'archived'; renderSidebar(); } },
    { label: 'Locked chats', icon: 'lock', onClick: () => A.openlocked() },
    { label: 'Linked devices', icon: 'devices', onClick: () => { ui.tab = 'settings'; ui.page = 'set-devices'; renderRail(); renderSidebar(); } },
    { label: 'Import chats', icon: 'importin', onClick: importChatModal },
    { label: 'My QR code', icon: 'qr', onClick: qrModal },
    { label: document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode', icon: 'moon', onClick: () => { S.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); } },
    { label: 'Settings', icon: 'settings', onClick: () => { ui.tab = 'settings'; ui.page = null; renderRail(); renderSidebar(); } },
  ]);
}

// ---------- new chat / username connect
function pageNewChat() {
  return pageHead('New chat') + `<div class="side-tools">${searchBox('nc-search', 'Search name or @username', ui.ncQuery)}</div><div class="side-scroll" id="nc-list">${newChatListHTML()}</div>`;
}
function personRow(u, request) {
  return `<div class="chat-item" data-act="startdm" data-user="${u.id}">${avatarHTML(u)}<div class="ci-body"><div class="ci-top"><span class="ci-name">${esc(u.name)}${verifiedHTML(u)}</span>${request ? '<span class="pill">Chat request</span>' : ''}</div><div class="ci-bottom"><span class="ci-preview">@${esc(u.username)}${u.about ? ' · ' + esc(u.about) : ''}</span></div></div></div>`;
}
function newChatListHTML() {
  const q = ui.ncQuery.trim().toLowerCase().replace(/^@/, '');
  let html = '';
  if (!q) {
    const row = (act, ic, title, sub = '') => `<div class="list-row action" data-act="${act}"><span class="action-ic">${icon(ic, 22)}</span><div><div class="ci-name">${title}</div>${sub ? `<div class="ci-sub">${sub}</div>` : ''}</div></div>`;
    html += row('newgroup', 'groups', 'New group') + row('newcommunity', 'groups', 'New community') +
      row('myqr', 'qr', 'My QR code', 'Share your profile without a phone number') + row('scanqr', 'qr', 'Scan QR code or paste profile link') +
      row('calllink', 'link', 'Create call link', 'WHATSMORE Call Rooms');
  }
  const contacts = S.contacts.filter((c) => c.isContact && (!q || c.name.toLowerCase().includes(q) || c.username.includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  if (contacts.length) html += '<div class="list-label">Contacts on WHATSMORE</div>' + contacts.map((c) => personRow(c)).join('');
  if (q.length >= 2) {
    const others = [...S.directory.filter((u) => !S.contacts.some((c) => c.id === u.id)), ...S.contacts.filter((c) => !c.isContact)].filter((u) => u.username.includes(q));
    html += '<div class="list-label">Find by username</div>';
    html += others.length ? others.map((u) => personRow(u, true)).join('') : `<div class="empty-list small">No one found with @${esc(q)}. Usernames are unique — check the spelling.</div>`;
  } else if (!q) {
    html += `<div class="hint-box">${icon('person', 18)}<span>Connect with anyone by their unique <b>@username</b> — no phone number needed. Try <b>@meera.designs</b> or <b>@techguru_kiran</b>.</span></div>`;
  }
  return html;
}

const PICK_PAGE = 60;
// Checkbox rows for choosing group members from everyone on WHATSMORE
function peoplePickerHTML(q, picked, exclude = [], attr = 'data-pick') {
  const list = findPeople(q, exclude);
  const shown = list.slice(0, PICK_PAGE);
  if (!list.length) return `<div class="empty-list small">No one found${q ? ` for “${esc(q)}”` : ''}.</div>`;
  return shown.map((c) => `<label class="chat-item check-row">${avatarHTML(c, 40)}<div class="ci-body"><div class="ci-name">${esc(c.name)}${c.isContact ? '' : ' <span class="pill">On WHATSMORE</span>'}</div><div class="ci-preview">@${esc(c.username)}</div></div><input type="checkbox" class="check" ${attr}="${c.id}" ${picked.has(c.id) ? 'checked' : ''}></label>`).join('') +
    (list.length > shown.length ? `<div class="empty-list small">Showing ${shown.length} of ${list.length.toLocaleString()} — search by name or @username to find more.</div>` : '');
}
function ngPickedHTML() {
  const n = ui.ngPick.size;
  return n ? `<span class="pill">${n.toLocaleString()} selected</span> <span class="muted small">${esc(namesSummary([...ui.ngPick], 4))}</span>` : '<span class="muted small">Select members below — there is no limit on group size</span>';
}
function pageNewGroup() {
  return pageHead('New group') + `<div class="form-pad">
      <label class="field"><span>Group name</span><input id="ng-name" maxlength="40" placeholder="e.g. College Friends" value="${esc(ui.ngName)}"></label>
      <div class="picked" id="ng-picked">${ngPickedHTML()}</div></div>
    <div class="side-tools">${searchBox('ng-search', 'Search name or @username', ui.ngQuery || '')}</div>
    <div class="list-label">Add members · unlimited</div>
    <div class="side-scroll" id="ng-list">${peoplePickerHTML(ui.ngQuery, ui.ngPick)}</div>
    <div class="side-foot"><button class="btn primary block" data-act="creategroup">${icon('check', 18)} Create group</button></div>`;
}

// ---------- starred
function allStarred() {
  const out = [];
  S.chats.forEach((c) => c.messages.forEach((m) => { if (m.starred && m.type !== 'deleted') out.push({ c, m }); }));
  return out;
}
function starredList(items) {
  if (!items.length) return `<div class="empty-list">${icon('star', 40)}<br>No starred messages<br><small>Open a message's menu and choose Star to save it here.</small></div>`;
  return items.sort((a, b) => b.m.t - a.m.t).map(({ c, m }) => `<div class="starred-item" data-act="openmsg" data-chat="${c.id}" data-mid="${m.id}">
    <div class="st-top">${avatarHTML(m.from === 'me' ? S.me : contact(m.from), 24)}<span class="st-who">${esc(senderName(m.from))} ▸ ${esc(chatTitle(c))}</span><span class="ci-time">${listTime(m.t)}</span></div>
    <div class="st-bubble ${m.from === 'me' ? 'out' : ''}">${esc(preview(m))}</div></div>`).join('');
}

// ---------- status
function ringAvatar(o, count, viewed) {
  const r = 26, C = 2 * Math.PI * r, gap = count > 1 ? 4 : 0, seg = C / count - gap;
  return `<div class="ring-wrap"><svg width="56" height="56" viewBox="0 0 56 56" class="ring ${viewed ? 'viewed' : ''}"><circle cx="28" cy="28" r="${r}" fill="none" stroke-width="2.4" ${count > 1 ? `stroke-dasharray="${seg} ${gap}"` : ''} transform="rotate(-90 28 28)"/></svg>${avatarHTML(o, 46)}</div>`;
}
function tabStatus() {
  const my = S.myStatus.items;
  const row = (s) => {
    const c = contact(s.contactId), last = s.items[s.items.length - 1];
    return `<div class="chat-item" data-act="viewstatus" data-idx="${S.statuses.indexOf(s)}">${ringAvatar(c, s.items.length, s.viewed)}<div class="ci-body"><div class="ci-name">${esc(c.name)}${s.business ? ' <span class="pill biz">Business</span>' : ''}</div><div class="ci-preview">${listTime(last.t)}</div></div></div>`;
  };
  const recent = S.statuses.filter((s) => !s.viewed), viewed = S.statuses.filter((s) => s.viewed);
  return `<header class="side-head"><h2>Status</h2><div class="head-actions"><button class="icon-btn" data-act="addstatus" title="Add status" aria-label="Add status">${icon('add')}</button></div></header>
  <div class="side-scroll">
    <div class="chat-item" data-act="${my.length ? 'viewmystatus' : 'addstatus'}">${my.length ? ringAvatar(S.me, my.length, false) : `<div class="av-wrap">${avatarHTML(S.me)}<span class="av-plus">${icon('add', 14)}</span></div>`}
      <div class="ci-body"><div class="ci-name">My status</div><div class="ci-preview">${my.length ? listTime(my[my.length - 1].t) + ' · ' + privacyLabel(my[my.length - 1].privacy) : 'Click to add status update'}</div></div>
      ${my.length ? `<button class="icon-btn accent" data-act="addstatus" title="Add another" aria-label="Add another status">${icon('add')}</button>` : ''}</div>
    ${recent.length ? '<div class="list-label">Recent updates</div>' + recent.map(row).join('') : ''}
    ${viewed.length ? '<div class="list-label">Viewed updates</div>' + viewed.map(row).join('') : ''}
    <div class="hint-box">${icon('lock', 16)}<span>Status updates are end-to-end encrypted. Choose who sees each one: Everyone, Contacts, Selected, Close friends or Only me.</span></div>
  </div>`;
}

// ---------- calls
function tabCalls() {
  const rows = S.calls.slice().sort((a, b) => b.t - a.t).map((k) => {
    const ch = chatById(k.chatId);
    if (!ch) return '';
    return `<div class="chat-item" data-act="open" data-chat="${ch.id}">${chatAvatar(ch)}<div class="ci-body"><div class="ci-top"><span class="ci-name ${k.missed ? 'missed' : ''}">${esc(chatTitle(ch))}</span></div>
      <div class="ci-bottom"><span class="ci-preview"><span class="call-dir ${k.missed ? 'missed' : ''}">${icon(k.dir === 'in' ? 'callin' : 'callout', 16)}</span>${callTime(k.t)}${k.dur ? ' · ' + fmtDur(k.dur) : k.missed ? ' · Missed' : ''}</span></div></div>
      <button class="icon-btn accent" data-act="callback" data-chat="${ch.id}" data-video="${k.video ? 1 : ''}" title="Call again" aria-label="Call again">${icon(k.video ? 'video' : 'call')}</button></div>`;
  }).join('');
  return `<header class="side-head"><h2>Calls</h2><div class="head-actions"><button class="icon-btn" data-act="calllink" title="Create call link" aria-label="Create call link">${icon('link')}</button></div></header>
  <div class="side-scroll">
    <div class="list-row action" data-act="calllink"><span class="action-ic">${icon('link', 22)}</span><div><div class="ci-name">Create call link</div><div class="ci-sub">WHATSMORE Call Rooms — share a link anyone can join</div></div></div>
    <div class="list-label">Recent</div>${rows || '<div class="empty-list">No calls yet</div>'}
    <div class="hint-box">${icon('lock', 16)}<span>Your personal calls are end-to-end encrypted.</span></div>
  </div>`;
}

// ---------- communities
function tabCommunities() {
  return `<header class="side-head"><h2>Communities</h2><div class="head-actions"><button class="icon-btn" data-act="newcommunity" title="New community" aria-label="New community">${icon('add')}</button></div></header>
  <div class="side-scroll">
    <div class="list-row action" data-act="newcommunity"><span class="action-ic square">${icon('groups', 22)}</span><div><div class="ci-name">New community</div><div class="ci-sub">Bring members together in topic-based groups</div></div></div>
    ${S.communities.map((cm) => `<div class="community">
      <div class="cm-head">${avatarHTML(cm, 48, 'square')}<div><div class="ci-name">${esc(cm.name)}</div><div class="ci-sub">${esc(cm.description || '')}</div></div></div>
      ${cm.groups.map((gid) => {
        const g = chatById(gid);
        if (!g) return '';
        const m = lastMsg(g);
        return `<div class="chat-item sub" data-act="open" data-chat="${g.id}">${chatAvatar(g, 40)}<div class="ci-body"><div class="ci-top"><span class="ci-name">${esc(g.name)}</span><span class="ci-time ${g.unread ? 'unread' : ''}">${m ? listTime(m.t) : ''}</span></div><div class="ci-bottom"><span class="ci-preview">${m ? esc((m.from !== 'me' && m.type !== 'system' ? firstName(m.from) + ': ' : '') + preview(m)) : ''}</span>${g.unread ? `<span class="badge">${g.unread}</span>` : ''}</div></div></div>`;
      }).join('')}
      <button class="link-row" data-act="cm-addgroup" data-cm="${cm.id}">${icon('add', 18)} Add group</button>
    </div>`).join('')}
  </div>`;
}

// ---------- files / cloud
const FILECATS = [['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos'], ['documents', 'Documents'], ['receipts', 'Receipts'], ['invoices', 'Invoices'], ['audio', 'Audio'], ['links', 'Links']];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function fileCat(m) {
  if (m.type === 'image') return 'photos';
  if (m.type === 'video') return 'videos';
  if (m.type === 'voice') return 'audio';
  if (m.type === 'invoice') return 'invoices';
  const n = m.name.toLowerCase();
  if (/invoice|inv[-_]/.test(n)) return 'invoices';
  if (/receipt|bill/.test(n)) return 'receipts';
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(n)) return 'audio';
  return 'documents';
}
function allFiles() {
  const out = [];
  S.chats.forEach((c) => {
    if (c.locked && !ui.unlocked.has(c.id)) return;
    c.messages.forEach((m) => { if (['image', 'video', 'doc', 'voice', 'invoice'].includes(m.type)) out.push({ c, m, cat: fileCat(m) }); });
  });
  return out.sort((a, b) => b.m.t - a.m.t);
}
const fileName = (m) => m.name || (m.type === 'invoice' ? `Invoice_${m.orderId}.pdf` : m.caption || ({ image: 'Photo', video: 'Video', voice: 'Voice message' })[m.type]);
function parseFileQuery(q) {
  const s = q.toLowerCase();
  const f = {};
  const cats = { invoices: /\binvoices?\b/, receipts: /\b(receipts?|bills?)\b/, photos: /\b(photos?|pictures?|pics?|images?)\b/, videos: /\bvideos?\b/, audio: /\b(audio|voice|recordings?)\b/, documents: /\b(docs?|documents?|pdfs?|sheets?|spreadsheets?|prd)\b/ };
  for (const [k, re] of Object.entries(cats)) if (re.test(s)) { f.cat = k; break; }
  MONTHS.forEach((mo, i) => { if (new RegExp('\\b(' + mo + '|' + mo.slice(0, 3) + ')\\b').test(s) && !(mo === 'may' && /\bmay (i|be)\b/.test(s))) f.month = i; });
  if (/\btoday\b/.test(s)) f.since = new Date().setHours(0, 0, 0, 0);
  if (/\blast week|this week\b/.test(s)) f.since = Date.now() - 7 * DAY;
  if (/\bi (sent|shared|uploaded)\b/.test(s)) f.from = 'me';
  else for (const p of S.contacts) {
    const fn = p.name.split(' ')[0].toLowerCase().replace(/[^\p{L}]/gu, '');
    if ((fn.length > 1 && new RegExp('\\b' + fn + '\\b', 'u').test(s)) || s.includes('@' + p.username)) { f.from = p.id; break; }
  }
  const stop = new Set('show me the a an that which sent send shared share in on from by find get all my of to for what did i was were with last week this please where is files file give search month year'.split(' '));
  f.words = s.split(/[^\p{L}\p{N}_.-]+/u).filter((w) => w && w.length > 2 && !stop.has(w) && !MONTHS.includes(w) && !MONTHS.some((mo) => mo.slice(0, 3) === w) && !Object.values(cats).some((re) => re.test(w)) && !(f.from && f.from !== 'me' && contact(f.from).name.toLowerCase().includes(w)));
  return f;
}
function filesListHTML() {
  let items = allFiles();
  let note = '';
  const q = ui.filesQuery.trim();
  if (q) {
    const f = parseFileQuery(q);
    if (f.cat) items = items.filter((x) => x.cat === f.cat);
    if (f.month != null) items = items.filter((x) => new Date(x.m.t).getMonth() === f.month);
    if (f.from) items = items.filter((x) => x.m.from === f.from);
    if (f.since) items = items.filter((x) => x.m.t >= f.since);
    if (f.words.length) {
      const w = items.filter((x) => f.words.some((wd) => (fileName(x.m) + ' ' + chatTitle(x.c)).toLowerCase().includes(wd)));
      if (w.length || (!f.cat && f.month == null && !f.from)) items = w;
    }
    const parts = [];
    if (f.cat) parts.push(FILECATS.find((c) => c[0] === f.cat)[1]);
    if (f.from) parts.push('from ' + senderName(f.from));
    if (f.month != null) parts.push('in ' + MONTHS[f.month][0].toUpperCase() + MONTHS[f.month].slice(1));
    if (f.since) parts.push('recent');
    if (f.words.length) parts.push('“' + f.words.join(' ') + '”');
    note = `<div class="ai-note">${icon('sparkle', 16)}<span>Smart search understood: <b>${esc(parts.join(' · ') || q)}</b> — ${items.length} result${items.length === 1 ? '' : 's'}</span></div>`;
  } else {
    note = `<div class="examples">${['Invoice Ramesh sent in January', 'Photos from Ananya', 'Receipts', 'PRD Siva shared'].map((e) => `<button class="chip" data-act="fileq" data-q="${esc(e)}">${icon('sparkle', 14)} ${esc(e)}</button>`).join('')}</div>`;
  }
  if (ui.filesCat !== 'all') items = items.filter((x) => x.cat === ui.filesCat);
  return note + (items.length ? items.map(fileRow).join('') : '<div class="empty-list">No files found</div>');
}
function fileRow({ c, m, cat }) {
  let thumb;
  if (m.type === 'image') thumb = m.src ? `<img src="${m.src}" alt="">` : `<div class="mini-art" style="background:${m.art.bg}">${m.art.emoji}</div>`;
  else if (m.type === 'voice') thumb = `<div class="mini-ic">${icon('mic', 22)}</div>`;
  else if (m.type === 'video') thumb = `<div class="mini-ic">${icon('video', 22)}</div>`;
  else if (m.type === 'invoice') thumb = `<div class="mini-ic inv">${icon('receipt', 22)}</div>`;
  else thumb = docIconHTML(m.ext);
  return `<div class="file-row" data-act="openmsg" data-chat="${c.id}" data-mid="${m.id}"><div class="file-thumb">${thumb}</div><div class="ci-body"><div class="ci-name">${esc(fileName(m))}</div><div class="ci-preview">${esc(senderName(m.from))} · ${esc(chatTitle(c))} · ${new Date(m.t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}${m.size ? ' · ' + fmtSize(m.size) : ''}</div></div><span class="pill">${esc(FILECATS.find((x) => x[0] === cat)[1])}</span></div>`;
}
function storageUsed() {
  return allFiles().reduce((s, { m }) => s + (m.size || (m.src ? m.src.length * 0.75 : 0) || (m.type === 'voice' ? m.dur * 4000 : 180000)), 0);
}
function tabFiles() {
  const used = storageUsed(), plan = PLANS[S.settings.plan];
  return `<header class="side-head"><h2>Files</h2><div class="head-actions"><button class="icon-btn" data-act="cloudupload" title="Upload any file" aria-label="Upload any file">${icon('upload')}</button><button class="pill clickable" data-act="page" data-page="set-storage">${plan.name} plan</button></div></header>
  <div class="side-tools">
    <div class="storage"><div class="storage-top"><span>${icon('cloud', 18)} WHATSMORE Cloud</span><span>${fmtSize(used)} of ${plan.quota}</span></div><div class="meter"><div style="width:${Math.max(2, (used / plan.bytes) * 100)}%"></div></div></div>
    ${searchBox('files-search', 'Ask: “invoice Ramesh sent in January”', ui.filesQuery)}
    <div class="chips">${FILECATS.map(([k, l]) => `<button class="chip ${ui.filesCat === k ? 'on' : ''}" data-act="filescat" data-f="${k}">${l}</button>`).join('')}</div>
  </div>
  <div class="side-scroll" id="files-list">${filesListHTML()}</div>`;
}
