// Contact/group info drawer, chat actions, modals, stories, calls, media viewer
'use strict';

// ---------- open / close chats
function openChat(id, opts = {}) {
  const ch = chatById(id);
  if (!ch) return;
  if (ch.locked && !ui.unlocked.has(id)) return withPin(() => { ui.unlocked.add(id); openChat(id, opts); });
  if (ui.active !== id) { stopVoice(); if (ui.rec) stopRecording(false); }
  ui.active = id; ui.replyTo = null; ui.editing = null; ui.chatSearch = null; ui.emojiOpen = false;
  if (ui.drawer === 'starred') ui.drawer = null;
  ch.unread = 0;
  save();
  renderMain(); refreshSidebar(); renderRail(); renderDrawer();
  if (opts.mid) setTimeout(() => jumpTo(opts.mid), 60);
  else if (innerWidth > 760) focusInput();
}
function closeChat() { stopVoice(); ui.active = null; ui.drawer = null; renderMain(); renderDrawer(); refreshSidebar(); }

function startDM(userId) {
  let c = contact(userId);
  if (!c) {
    const u = S.directory.find((x) => x.id === userId);
    if (!u) return;
    c = { ...u, isContact: false, online: true };
    S.contacts.push(c);
  }
  let ch = directChatFor(c.id);
  if (!ch) {
    const t = Date.now();
    ch = { id: 'ch_' + uid(), type: 'direct', contactId: c.id, unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' }] };
    if (!c.isContact) {
      ch.request = 'pending';
      ch.messages.push({ id: uid(), type: 'system', from: 'system', t: t + 1, text: `You sent a chat request to @${c.username}. Your phone number stays hidden.` });
      setTimeout(() => {
        ch.request = 'accepted';
        ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `@${c.username} accepted your chat request` });
        ch.messages.forEach((m) => { if (m.from === 'me') m.status = 'read'; });
        save();
        if (ui.active === ch.id) { renderChatSub(); renderBars(); renderMessages(); }
        simulateIncoming(ch, c.id, `Hi ${S.me.name.split(' ')[0]}! Thanks for connecting 👋`, 600);
      }, 4500);
    }
    S.chats.push(ch);
    save();
  }
  closeAllModals();
  ui.page = null; ui.tab = 'chats'; ui.ncQuery = '';
  renderRail(); renderSidebar();
  openChat(ch.id);
}
function closeAllModals() { $$('.modal-backdrop').forEach((m) => m._close ? m._close() : m.remove()); }

// ---------- chat lock
function withPin(cb) {
  if (!S.settings.lockPin) return setPinModal(cb);
  modal({
    title: 'Locked chat',
    body: `<p class="muted">Enter your 4-digit chat lock PIN.</p><input id="pin-in" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="off" autofocus><div class="err" id="pin-err"></div><p class="muted small">Production apps would use Face ID / fingerprint here.</p>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Unlock', primary: true, onClick: (root) => {
        if ($('#pin-in', root).value === S.settings.lockPin) { setTimeout(cb, 0); return; }
        $('#pin-err', root).textContent = 'Incorrect PIN'; $('#pin-in', root).value = ''; $('.modal', root).classList.add('shake');
        setTimeout(() => $('.modal', root)?.classList.remove('shake'), 400);
        return false;
      },
    }],
    onMount: (root) => $('#pin-in', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-mact="1"]', root).click(); }),
  });
}
function setPinModal(cb) {
  modal({
    title: 'Create chat lock PIN',
    body: `<p class="muted">Locked chats are hidden from your chat list and need this PIN to open.</p><input id="pin-a" class="pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autofocus><input id="pin-b" class="pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="Confirm"><div class="err" id="pin-err"></div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Save PIN', primary: true, onClick: (root) => {
        const a = $('#pin-a', root).value, b = $('#pin-b', root).value;
        if (!/^\d{4}$/.test(a)) { $('#pin-err', root).textContent = 'PIN must be 4 digits'; return false; }
        if (a !== b) { $('#pin-err', root).textContent = "PINs don't match"; return false; }
        S.settings.lockPin = a; save(); toast('Chat lock PIN saved');
        if (cb) setTimeout(cb, 0);
        if (ui.page === 'set-security') renderSidebar();
      },
    }],
  });
}
function toggleLock(ch) {
  withPin(() => {
    ch.locked = !ch.locked;
    if (ch.locked) ui.unlocked.add(ch.id);
    save(); refreshSidebar(); renderDrawer(); renderRail();
    toast(ch.locked ? 'Chat locked — find it under “Locked chats” at the top of your chat list' : 'Chat unlocked');
  });
}

// ---------- chat-level actions
function deleteChat(ch) {
  confirmModal('Delete this chat?', 'Messages will be removed from this device.', 'Delete chat', () => {
    S.chats = S.chats.filter((c) => c !== ch);
    S.communities.forEach((cm) => { cm.groups = cm.groups.filter((g) => g !== ch.id); });
    if (ui.active === ch.id) closeChat();
    save(); refreshSidebar(); renderRail(); toast('Chat deleted');
  });
}
function clearChat(ch) {
  confirmModal('Clear this chat?', 'All messages in this chat will be deleted for you.', 'Clear chat', () => {
    ch.messages = ch.messages.filter((m) => m.type === 'system' && /end-to-end/.test(m.text));
    save(); renderMessages(); renderBars(); refreshSidebar(); toast('Chat cleared');
  });
}
function toggleBlock(c) {
  const doIt = () => { c.blocked = !c.blocked; save(); if (ui.active) { renderChatSub(); renderComposer(); } renderDrawer(); toast(c.blocked ? `${c.name} blocked` : `${c.name} unblocked`); if (ui.page === 'set-privacy') renderSidebar(); };
  if (c.blocked) doIt(); else confirmModal(`Block ${c.name}?`, "Blocked contacts can't call you or send you messages.", 'Block', doIt);
}
function reportModal(c) {
  modal({
    title: `Report ${c.name}?`,
    body: `<p class="muted">The last 5 messages from this contact will be forwarded to WHATSMORE for review. They won't be notified.</p>${['Spam', 'Scam or fraud', 'Harassment', 'Impersonation', 'Something else'].map((r, i) => `<label class="radio-row"><input type="radio" name="rr" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}<label class="radio-row"><input type="checkbox" id="rp-block" checked> Also block contact</label>`,
    actions: [{ label: 'Cancel' }, { label: 'Report', danger: true, onClick: (root) => { if ($('#rp-block', root).checked && !c.blocked) { c.blocked = true; save(); renderComposer(); renderChatSub(); } toast('Report sent. Thanks for keeping WHATSMORE safe.'); renderDrawer(); } }],
  });
}
function exitGroup(ch) {
  confirmModal(`Exit "${ch.name}"?`, 'You will no longer receive messages from this group.', 'Exit group', () => {
    ch.left = true;
    ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'You left' });
    save(); renderMessages(); renderComposer(); renderDrawer(); refreshSidebar();
  });
}
function disappearModal(ch) {
  const opts = [['', 'Off'], ...Object.entries(DISAPPEAR).map(([k, [l]]) => [k, l])];
  modal({
    title: 'Disappearing messages',
    body: `<p class="muted">New messages will disappear from this chat after the selected time. Choose “1 minute (demo)” to watch it happen.</p>${opts.map(([k, l]) => `<label class="radio-row"><input type="radio" name="dm" value="${k}" ${(ch.disappearing || '') === k ? 'checked' : ''}> ${l}</label>`).join('')}`,
    actions: [{ label: 'Cancel' }, {
      label: 'Save', primary: true, onClick: (root) => {
        const v = $('input[name=dm]:checked', root).value || null;
        if (v === (ch.disappearing || null)) return;
        ch.disappearing = v;
        ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: v ? `You turned on disappearing messages. New messages will disappear from this chat ${DISAPPEAR[v][0].replace(' (demo)', '')} after they're sent.` : 'You turned off disappearing messages.' });
        save(); renderMain(); renderDrawer(); refreshSidebar();
      },
    }],
  });
}
function sweepExpired() {
  const now = Date.now();
  let changed = false;
  S.chats.forEach((ch) => {
    const before = ch.messages.length;
    ch.messages = ch.messages.filter((m) => !m.exp || m.exp > now);
    if (ch.messages.length !== before) { changed = true; if (ch.id === ui.active) renderMessages({ keep: true }); }
  });
  if (changed) { save(); refreshSidebar(); }
}

// ---------- message actions
function msgMenu(mid, anchor) {
  const ch = chatById(ui.active), m = ch?.messages.find((x) => x.id === mid);
  if (!m || m.type === 'system') return;
  const out = m.from === 'me', alive = m.type !== 'deleted';
  const fwdable = alive && !['payment', 'poll', 'invoice', 'call', 'event'].includes(m.type) && !noForward(ch);
  showMenu(anchor, [
    alive && { label: 'Reply', icon: 'reply', onClick: () => { ui.replyTo = mid; ui.editing = null; renderReplyBox(); renderSmart(); focusInput(); } },
    alive && (m.text || m.caption) && m.type !== 'sticker' && !noForward(ch) && { label: 'Copy', icon: 'copy', onClick: () => copyText(m.text || m.caption) },
    fwdable && { label: 'Forward', icon: 'forward', onClick: () => forwardModal(m) },
    alive && { label: m.pinned ? 'Unpin' : 'Pin', icon: 'pin', onClick: () => { m.pinned = !m.pinned; save(); renderBars(); renderMessages({ keep: true }); toast(m.pinned ? 'Message pinned' : 'Message unpinned'); } },
    alive && { label: m.starred ? 'Unstar' : 'Star', icon: 'star', onClick: () => { m.starred = !m.starred; save(); renderMessages({ keep: true }); } },
    alive && m.tr && { label: ch.translate ? 'Hide translation' : 'Translate', icon: 'translate', onClick: () => A['translate-toggle']() },
    alive && out && m.type === 'text' && Date.now() - m.t < 15 * MIN && { label: 'Edit', icon: 'edit', onClick: () => { ui.editing = mid; ui.replyTo = null; const ta = $('#input'); ta.value = m.text; ta.dispatchEvent(new Event('input', { bubbles: true })); renderReplyBox(); focusInput(); } },
    ...extraMsgItems(ch, m),
    { label: 'Delete', icon: 'delete', danger: true, onClick: () => deleteMsgModal(ch, m) },
  ], {
    alignLeft: !out,
    header: alive ? `<div class="react-row">${REACTS.map((e) => `<button data-react="${e}" class="${(m.reactions?.[e] || []).includes('me') ? 'on' : ''}" aria-label="React ${e}">${e}</button>`).join('')}</div>` : '',
    onReact: (e) => react(ch, m, e),
  });
}
function react(ch, m, e) {
  m.reactions = m.reactions || {};
  const had = (m.reactions[e] || []).includes('me');
  Object.keys(m.reactions).forEach((k) => { m.reactions[k] = m.reactions[k].filter((x) => x !== 'me'); if (!m.reactions[k].length) delete m.reactions[k]; });
  if (!had) (m.reactions[e] = m.reactions[e] || []).push('me');
  save(); renderMessages({ keep: true });
}
function deleteMsgModal(ch, m) {
  const acts = [{ label: 'Cancel' }];
  if (m.from === 'me' && m.type !== 'deleted') acts.push({ label: 'Delete for everyone', danger: true, onClick: () => { const keep = { id: m.id, from: m.from, t: m.t, status: m.status }; Object.keys(m).forEach((k) => delete m[k]); Object.assign(m, keep, { type: 'deleted', reactions: {} }); save(); renderMessages({ keep: true }); renderBars(); refreshSidebar(); } });
  acts.push({ label: 'Delete for me', danger: true, onClick: () => { ch.messages = ch.messages.filter((x) => x !== m); save(); renderMessages({ keep: true }); renderBars(); refreshSidebar(); } });
  modal({ title: 'Delete message?', body: `<p class="muted">${esc(preview(m)).slice(0, 120)}</p>`, actions: acts });
}
function chatPicker(title, cb, opts = {}) {
  const chats = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  modal({
    title,
    body: `<div class="search modal-search">${icon('search', 18)}<input id="pk-q" placeholder="Search chats" autocomplete="off"></div><div class="pick-list">${chats.map((c) => `<label class="chat-item check-row" data-name="${esc(chatTitle(c).toLowerCase())}">${chatAvatar(c, 40)}<div class="ci-body"><div class="ci-name">${esc(chatTitle(c))}</div></div><input type="${opts.single ? 'radio' : 'checkbox'}" name="pk" class="check" value="${c.id}"></label>`).join('')}</div>`,
    actions: [{ label: 'Cancel' }, { label: opts.label || 'Send', primary: true, onClick: (root) => { const ids = $$('input[name=pk]:checked', root).map((i) => i.value); if (!ids.length) { toast('Select at least one chat'); return false; } if (cb(ids.map(chatById)) === false) return false; } }],
    onMount: (root) => $('#pk-q', root).addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); $$('.pick-list .chat-item', root).forEach((r) => { r.hidden = !r.dataset.name.includes(q); }); }),
  });
}
function forwardModal(m) {
  chatPicker('Forward message to…', (chats) => {
    if (chats.length > FORWARD_LIMIT) { toast(`You can forward to up to ${FORWARD_LIMIT} chats at once`); return false; }
    chats.forEach((ch) => {
      const copy = JSON.parse(JSON.stringify(m));
      ['id', 'from', 't', 'status', 'reactions', 'starred', 'pinned', 'replyTo', 'edited', 'exp', 'bot', 'scheduled'].forEach((k) => delete copy[k]);
      const sent = sendMsg(ch, { ...copy, forwarded: true });
      if (ch.id !== ui.active) scheduleReply(ch, sent);
    });
    toast(`Forwarded to ${chats.length} chat${chats.length > 1 ? 's' : ''}`);
  });
}

// ---------- attachments
function attachMenu(anchor) {
  const ch = chatById(ui.active);
  showMenu(anchor, [
    { label: 'Document · any file type', icon: 'doc', color: '#7f66ff', onClick: sendDocs },
    { label: 'Create document', icon: 'edit', color: '#2b6fd6', onClick: () => openStudio({ ch, blank: true }) },
    { label: 'Request signature', icon: 'draw', color: '#5e35b1', onClick: () => signRequestModal(ch) },
    { label: 'Photos & videos', icon: 'image', color: '#007bfc', onClick: sendMedia },
    { label: 'Payment', icon: 'rupee', color: '#00a884', onClick: () => payModal(ch) },
    { label: 'Poll', icon: 'poll', color: '#ffbc38', onClick: () => pollModal(ch) },
    { label: 'Event', icon: 'event', color: '#ff2e74', onClick: () => eventModal(ch) },
    { label: 'Contact', icon: 'person', color: '#009de2', onClick: () => shareContactModal(ch) },
    isBiz(ch) && { label: 'Catalogue', icon: 'bag', color: '#f4511e', onClick: () => catalogModal(ch) },
    { label: 'Schedule message', icon: 'timer', color: '#02a698', onClick: () => scheduleModal(ch) },
  ], { above: true, alignLeft: true, cls: 'attach' });
}
async function sendMedia() {
  const files = await pickFile('file-media');
  const ch = chatById(ui.active);
  if (!files.length || !ch) return;
  const f = files[0];
  let src, type;
  if (f.type.startsWith('video/')) { src = URL.createObjectURL(f); ui.blobs.add(src); type = 'video'; }
  else if (f.type.startsWith('image/')) { try { src = await readImage(f); } catch (e) { return toast('Could not read that image'); } type = 'image'; }
  else return toast('Unsupported file type');
  modal({
    title: 'Send ' + (type === 'image' ? 'photo' : 'video'),
    body: `<div class="media-preview">${type === 'image' ? `<img src="${src}" alt="">` : `<video src="${src}" controls></video>`}</div><label class="field"><span>Caption</span><input id="cap" maxlength="300" placeholder="Add a caption…" autofocus></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const m = sendMsg(ch, { type, src, caption: $('#cap', root).value.trim(), size: f.size }); scheduleReply(ch, m); } }],
    onMount: (root) => $('#cap', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-mact="1"]', root).click(); }),
  });
}
async function sendDocs() {
  const files = await pickFile('file-doc');
  const ch = chatById(ui.active);
  if (!files.length || !ch) return;
  sendFiles(ch, files);
}
function shareContactModal(ch) {
  const people = S.contacts.filter((c) => c.isContact && c.id !== ch.contactId);
  modal({
    title: 'Share contact',
    body: `<div class="pick-list">${people.map((c, i) => `<label class="chat-item check-row">${avatarHTML(c, 40)}<div class="ci-body"><div class="ci-name">${esc(c.name)}</div><div class="ci-preview">@${esc(c.username)}</div></div><input type="radio" name="sc" class="check" value="${c.id}" ${i === 0 ? 'checked' : ''}></label>`).join('')}</div>`,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const id = $('input[name=sc]:checked', root)?.value; if (id) sendMsg(ch, { type: 'contact', userId: id }); } }],
  });
}
function catalogModal(ch) {
  const c = contact(ch.contactId), items = S.catalog[c.id] || [];
  modal({
    title: `${c.name} · Catalogue`,
    wide: true,
    body: `<div class="catalog">${items.map((p) => `<div class="cat-item"><div class="prod-art big" style="background:${p.bg}">${p.emoji}</div><div class="ev-title">${esc(p.name)}</div><div class="ci-sub">${esc(p.desc)}</div><div class="cat-foot"><b>${money(p.price)}</b>${p.stock ? `<button class="btn sm primary" data-order="${p.id}">Order</button>` : '<span class="pill">Sold out</span>'}</div></div>`).join('')}</div>
      <p class="muted small">Product → Chat → Order → Payment → Invoice, all inside WHATSMORE.</p>`,
    onMount: (root, close) => root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-order]');
      if (!b) return;
      close();
      if (ui.active !== ch.id) openChat(ch.id);
      const m = sendMsg(ch, { type: 'product', productId: b.dataset.order, text: "Hi! I'd like to order this 🙂" });
      scheduleReply(ch, m);
    }),
  });
}
function scheduleModal(ch) {
  const draft = $('#input')?.value.trim() || '';
  const toLocal = (t) => new Date(t - new Date(t).getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  const tonight = new Date(); tonight.setHours(21, 0, 0, 0); if (tonight < Date.now()) tonight.setDate(tonight.getDate() + 1);
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1); tmrw.setHours(9, 0, 0, 0);
  modal({
    title: 'Schedule message',
    body: `<label class="field"><span>Message</span><textarea id="sc-text" rows="3" maxlength="1000" placeholder="Type your message" autofocus>${esc(draft)}</textarea></label>
      <div class="chips">${[['In 1 min', Date.now() + MIN], ['In 1 hour', Date.now() + HOUR], ['Tonight 9 PM', +tonight], ['Tomorrow 9 AM', +tmrw]].map(([l, t]) => `<button class="chip" data-at="${toLocal(t)}">${l}</button>`).join('')}</div>
      <label class="field"><span>Send at</span><input id="sc-at" type="datetime-local" value="${toLocal(Date.now() + MIN)}"></label>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Schedule', primary: true, onClick: (root) => {
        const text = $('#sc-text', root).value.trim(), at = new Date($('#sc-at', root).value).getTime();
        if (!text) { toast('Write a message first'); return false; }
        if (!(at > Date.now())) { toast('Pick a time in the future'); return false; }
        S.scheduled.push({ id: uid(), chatId: ch.id, text, at });
        if ($('#input') && draft) { $('#input').value = ''; $('#input').dispatchEvent(new Event('input', { bubbles: true })); }
        save(); renderBars(); toast(`Scheduled for ${dayLabel(at).toLowerCase()} at ${fmtTime(at)}`);
      },
    }],
    onMount: (root) => root.addEventListener('click', (e) => { const b = e.target.closest('[data-at]'); if (b) $('#sc-at', root).value = b.dataset.at; }),
  });
}
function scheduledListModal(ch) {
  const list = S.scheduled.filter((s) => s.chatId === ch.id).sort((a, b) => a.at - b.at);
  modal({
    title: 'Scheduled messages',
    body: list.map((s) => `<div class="sched-row"><div class="grow"><div>${esc(s.text)}</div><div class="ci-sub">${dayLabel(s.at)} at ${fmtTime(s.at)}</div></div><button class="btn sm" data-now="${s.id}">Send now</button><button class="icon-btn sm" data-del="${s.id}" aria-label="Cancel">${icon('delete', 18)}</button></div>`).join('') || '<p class="muted">Nothing scheduled.</p>',
    actions: [{ label: 'Done', primary: true }],
    onMount: (root, close) => root.addEventListener('click', (e) => {
      const n = e.target.closest('[data-now]'), d = e.target.closest('[data-del]');
      if (n) { const s = S.scheduled.find((x) => x.id === n.dataset.now); if (s) s.at = Date.now() - 1; runScheduled(); close(); }
      if (d) { S.scheduled = S.scheduled.filter((x) => x.id !== d.dataset.del); save(); renderBars(); close(); toast('Scheduled message cancelled'); }
    }),
  });
}
function runScheduled() {
  const due = S.scheduled.filter((s) => s.at <= Date.now());
  if (!due.length) return;
  S.scheduled = S.scheduled.filter((s) => s.at > Date.now());
  due.forEach((s) => { const ch = chatById(s.chatId); if (!ch) return; const m = sendMsg(ch, { type: 'text', text: s.text, scheduled: true }); scheduleReply(ch, m); toast(`Scheduled message sent to ${chatTitle(ch)}`); });
  save(); renderBars();
}

// ---------- QR, call links, communities, groups
function drawQR(el, text) {
  if (window.QRCode) new QRCode(el, { text, width: 196, height: 196, colorDark: '#111b21', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  else el.innerHTML = `<div class="qr-fallback">${icon('qr', 120)}<small>QR library offline</small></div>`;
}
function qrModal() {
  const link = `https://whatsmore.app/u/${S.me.username}`;
  modal({
    title: 'My QR code',
    body: `<div class="qr-card">${avatarHTML(S.me, 64)}<div class="pc-name">${esc(S.me.name)}</div><div class="accent">@${esc(S.me.username)}</div><div id="qr-box" class="qr-box"></div><div class="qr-link">${esc(link)}</div><p class="muted small">Scan → Profile → Connect. Works as your digital contact card — your phone number stays private.</p></div>`,
    actions: [{ label: 'Copy link', onClick: () => { copyText(link); return false; } }, { label: 'Done', primary: true }],
    onMount: (root) => drawQR($('#qr-box', root), link),
  });
}
function scanModal() {
  let stream, raf;
  modal({
    title: 'Scan QR code',
    body: `<div class="scan-box"><video id="scan-vid" playsinline muted></video><div class="scan-frame"></div><div class="scan-msg" id="scan-msg">Starting camera…</div></div>
      <label class="field"><span>Or paste a profile link / @username</span><input id="scan-in" placeholder="https://whatsmore.app/u/meera.designs"></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Connect', primary: true, onClick: (root) => { if (!connectFromText($('#scan-in', root).value)) { toast('No WHATSMORE user found for that link'); return false; } } }],
    onClose: () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); },
    onMount: async (root) => {
      const msg = $('#scan-msg', root);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = $('#scan-vid', root); v.srcObject = stream; await v.play();
        if (!('BarcodeDetector' in window)) { msg.textContent = 'QR detection not supported in this browser — paste the link below.'; return; }
        msg.textContent = 'Point at a WHATSMORE QR code';
        const det = new BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
          if (!root.isConnected) return;
          try { const codes = await det.detect(v); if (codes[0] && connectFromText(codes[0].rawValue)) return; } catch (e) { /* keep scanning */ }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) { msg.textContent = 'Camera unavailable — paste a profile link below.'; }
    },
  });
}
function connectFromText(t) {
  const mm = String(t).trim().match(/(?:whatsmore\.app\/u\/|^@?)([a-z0-9._]{3,24})$/i);
  if (!mm) return false;
  const un = mm[1].toLowerCase();
  if (un === S.me.username) { toast("That's your own QR code 🙂"); return true; }
  const u = [...S.contacts, ...S.directory].find((x) => x.username === un);
  if (!u) return false;
  startDM(u.id);
  return true;
}
function callLinkModal() {
  const code = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
  const link = `https://whatsmore.app/call/${code}`;
  modal({
    title: 'Create call link',
    body: `<div class="call-link-card"><div class="action-ic big">${icon('video', 28)}</div><div><div class="ci-name">WHATSMORE Call Room</div><div class="qr-link">${link}</div></div></div><p class="muted small">Anyone with this link can join. Share it in a chat or copy it.</p>`,
    actions: [
      { label: 'Copy link', onClick: () => { copyText(link); return false; } },
      { label: 'Share in chat', onClick: () => { setTimeout(() => chatPicker('Share call link', (chats) => { chats.forEach((ch) => sendMsg(ch, { type: 'text', text: `Join my WHATSMORE call 📹 ${link}` })); toast('Call link shared'); }), 0); } },
      { label: 'Join now', primary: true, onClick: () => startCall(null, true, { room: code }) },
    ],
  });
}
function newCommunityModal() {
  modal({
    title: 'New community',
    body: `<label class="field"><span>Community name</span><input id="cm-n" maxlength="40" placeholder="e.g. Hyderabad Startups" autofocus></label><label class="field"><span>Description</span><input id="cm-d" maxlength="100" placeholder="What is this community about?"></label><p class="muted small">An Announcements group is created automatically — only admins can post there.</p>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Create', primary: true, onClick: (root) => {
        const name = $('#cm-n', root).value.trim();
        if (!name) { toast('Give your community a name'); return false; }
        const id = 'cm_' + uid(), color = pick(COLORS), t = Date.now();
        const mk = (gname, emoji, extra) => ({ id: 'ch_' + uid(), type: 'group', name: gname, community: id, emoji, color, members: [], admins: ['me'], unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t, text: `You created "${gname}"` }], ...extra });
        const ann = mk('Announcements', '📢', { readOnly: true }), gen = mk('General', '💬', {});
        S.chats.push(ann, gen);
        S.communities.push({ id, name, emoji: '🏘️', color, description: $('#cm-d', root).value.trim(), groups: [ann.id, gen.id] });
        save(); ui.tab = 'communities'; ui.page = null; renderRail(); renderSidebar(); toast('Community created');
      },
    }],
  });
}
function addGroupToCommunity(cmId) {
  const cm = S.communities.find((c) => c.id === cmId);
  modal({
    title: 'Add group to ' + cm.name,
    body: `<label class="field"><span>Group name</span><input id="ag-n" maxlength="40" placeholder="e.g. Sports Club" autofocus></label>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Create', primary: true, onClick: (root) => {
        const name = $('#ag-n', root).value.trim();
        if (!name) return false;
        const g = { id: 'ch_' + uid(), type: 'group', name, community: cmId, emoji: '👥', color: pick(COLORS), members: [], admins: ['me'], unread: 0, messages: [{ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You created group "${name}"` }] };
        S.chats.push(g); cm.groups.push(g.id); save(); renderSidebar(); openChat(g.id);
      },
    }],
  });
}
function createGroup() {
  const name = ui.ngName.trim();
  if (!name) return toast('Enter a group name');
  if (!ui.ngPick.size) return toast('Select at least one member');
  const members = [...ui.ngPick].filter((id) => ensureContact(id)), t = Date.now();
  const g = {
    id: 'ch_' + uid(), type: 'group', name, emoji: '👥', color: pick(COLORS), members, admins: ['me'], description: '', unread: 0,
    messages: [
      { id: uid(), type: 'system', from: 'system', t, text: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.' },
      { id: uid(), type: 'system', from: 'system', t: t + 1, text: `You created group "${name}"` },
      { id: uid(), type: 'system', from: 'system', t: t + 2, text: 'You added ' + namesSummary(members, 5) },
    ],
  };
  S.chats.push(g);
  ui.ngName = ''; ui.ngQuery = ''; ui.ngPick.clear(); ui.page = null;
  save(); renderSidebar(); openChat(g.id);
  simulateIncoming(g, members[0], 'Hey everyone 👋', 1500);
}
// Add members: anyone on WHATSMORE, as many as you like (no participant limit)
function addMembers(ch, ids, how = 'You added') {
  const have = new Set(ch.members);
  ids = ids.filter((id) => !have.has(id) && ensureContact(id));
  if (!ids.length) return 0;
  ch.members.push(...ids);
  ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: how === 'joined' ? `${namesSummary(ids, 3)} joined using this group's invite link` : 'You added ' + namesSummary(ids, 5) });
  save(); renderMain(); renderDrawer(); refreshSidebar();
  return ids.length;
}
function addMemberModal(ch) {
  const picked = new Set();
  const list = (root) => { $('#am-list', root).innerHTML = peoplePickerHTML($('#am-q', root).value, picked, ch.members, 'data-am'); };
  const count = (root) => { $('#am-count', root).textContent = picked.size ? `${picked.size.toLocaleString()} selected` : 'No limit — add as many people as you like'; };
  modal({
    title: 'Add members',
    body: `<div class="search modal-search">${icon('search', 18)}<input id="am-q" placeholder="Search name or @username" autocomplete="off" autofocus></div>
      <div class="row-between"><span class="muted small" id="am-count"></span><button class="link-btn" id="am-link">${icon('link', 16)} Invite via link</button></div>
      <div class="pick-list" id="am-list"></div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Add', primary: true, onClick: () => {
        if (!picked.size) { toast('Select at least one person'); return false; }
        const n = addMembers(ch, [...picked]);
        toast(`Added ${n.toLocaleString()} member${n === 1 ? '' : 's'}`);
      },
    }],
    onMount: (root, close) => {
      list(root); count(root);
      $('#am-q', root).addEventListener('input', () => list(root));
      root.addEventListener('change', (e) => { const id = e.target.dataset.am; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); count(root); });
      $('#am-link', root).addEventListener('click', () => { close(); inviteLinkModal(ch); });
    },
  });
}
function inviteLinkModal(ch) {
  ch.invite = ch.invite || Math.random().toString(36).slice(2, 12);
  const link = `https://whatsmore.app/g/${ch.invite}`;
  save();
  modal({
    title: 'Group invite link',
    body: `<div class="call-link-card">${chatAvatar(ch, 56)}<div class="grow"><div class="ci-name">${esc(ch.name)}</div><div class="qr-link">${link}</div></div></div>
      <p class="muted small">Anyone with WHATSMORE can follow this link to join. Groups have <b>no participant limit</b> — currently ${(ch.members.length + 1).toLocaleString()} members.</p>
      <div class="hint-box">${icon('groups', 16)}<div class="grow"><div><b>Demo:</b> simulate people joining via the link</div>
        <div class="join-sim"><input id="join-n" type="number" min="1" step="1" value="500" aria-label="Number of people"><button class="btn sm primary" id="join-go">Join</button></div></div></div>`,
    actions: [
      { label: 'Reset link', onClick: () => { ch.invite = null; save(); toast('Old link no longer works'); setTimeout(() => inviteLinkModal(ch), 0); } },
      { label: 'Share in chat', onClick: () => { setTimeout(() => chatPicker('Share invite link', (chats) => { chats.forEach((c) => sendMsg(c, { type: 'text', text: `Join "${ch.name}" on WHATSMORE 👥 ${link}` })); toast('Invite link shared'); }), 0); } },
      { label: 'Copy link', primary: true, onClick: () => { copyText(link); return false; } },
    ],
    onMount: (root) => $('#join-go', root).addEventListener('click', () => {
      const n = Math.floor(+$('#join-n', root).value);
      if (!(n > 0)) return toast('Enter how many people');
      const added = addMembers(ch, generatePeople(n), 'joined');
      toast(`${added.toLocaleString()} people joined · ${(ch.members.length + 1).toLocaleString()} members`);
      $('.modal-body p', root).innerHTML = `Anyone with WHATSMORE can follow this link to join. Groups have <b>no participant limit</b> — currently ${(ch.members.length + 1).toLocaleString()} members.`;
    }),
  });
}
function memberMenu(ch, id, anchor) {
  if (id === 'me') return;
  const adm = (ch.admins || []).includes(id);
  showMenu(anchor, [
    { label: 'Message ' + firstName(id), icon: 'chat', onClick: () => startDM(id) },
    { label: 'Voice call', icon: 'call', onClick: () => { const dc = directChatFor(id); if (dc) startCall(dc, false); else startDM(id); } },
    isAdmin(ch) && { label: adm ? 'Dismiss as admin' : 'Make group admin', icon: 'shield', onClick: () => { ch.admins = adm ? ch.admins.filter((a) => a !== id) : [...ch.admins, id]; ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `${firstName(id)} is ${adm ? 'no longer' : 'now'} an admin` }); save(); renderMessages(); renderDrawer(); } },
    isAdmin(ch) && { label: 'Remove from group', icon: 'delete', danger: true, onClick: () => { ch.members = ch.members.filter((m) => m !== id); ch.admins = (ch.admins || []).filter((a) => a !== id); ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: `You removed ${firstName(id)}` }); save(); renderMain(); renderDrawer(); } },
  ]);
}
function verifyModal(ch) {
  const seed = hash(S.me.username + (ch.contactId || ch.id));
  const digits = Array.from({ length: 12 }, (_, i) => String((seed * (i + 7) * 2654435761) % 100000).padStart(5, '0'));
  modal({
    title: 'Encryption',
    body: `<p class="muted">Messages and calls in this chat are end-to-end encrypted. Compare this security code with ${esc(chatTitle(ch))} to verify.</p><div id="sec-qr" class="qr-box"></div><div class="sec-code">${digits.map((d) => `<span>${d}</span>`).join('')}</div><p class="muted small">Demo: production uses the Signal protocol for 1:1 chats and Sender Keys for groups.</p>`,
    actions: [{ label: 'Done', primary: true }],
    onMount: (root) => drawQR($('#sec-qr', root), digits.join('')),
  });
}
function editDescModal(ch) {
  modal({
    title: 'Group description',
    body: `<label class="field"><span>Description</span><textarea id="gd" rows="3" maxlength="300" autofocus>${esc(ch.description || '')}</textarea></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: (root) => { ch.description = $('#gd', root).value.trim(); ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: 'You changed the group description' }); save(); renderMessages(); renderDrawer(); } }],
  });
}
