// Action dispatcher, global event wiring, startup
'use strict';
const curChat = () => chatById(ui.active);
const msgOf = (el) => curChat()?.messages.find((m) => m.id === el.dataset.mid);

const A = {
  // navigation
  tab(el) { ui.tab = el.dataset.tab; ui.page = null; renderRail(); renderSidebar(); onTabOpen(ui.tab); },
  page(el) { ui.page = el.dataset.page; renderSidebar(); },
  back() { ui.page = ui.page === 'newgroup' ? 'newchat' : null; renderSidebar(); },
  newchat() { ui.page = 'newchat'; ui.ncQuery = ''; ui.tab = 'chats'; renderRail(); renderSidebar(); setTimeout(() => $('#nc-search')?.focus(), 30); },
  newgroup() { ui.page = 'newgroup'; renderSidebar(); },
  chatsmenu(el) { chatsMenu(el); },
  filter(el) { ui.filter = el.dataset.f; renderSidebar(); },
  open(el) { openChat(el.dataset.chat); },
  openmsg(el) { if (ui.drawer === 'starred' && innerWidth <= 1100) ui.drawer = null; openChat(el.dataset.chat, { mid: el.dataset.mid }); },
  chatitemmenu(el) { chatItemMenu(el.dataset.chat, el); },
  openarchived() { ui.page = 'archived'; renderSidebar(); },
  openlocked() { withPin(() => { S.chats.filter((c) => c.locked).forEach((c) => ui.unlocked.add(c.id)); ui.tab = 'chats'; ui.page = 'locked'; renderRail(); renderSidebar(); }); },
  startdm(el) { startDM(el.dataset.user); },
  creategroup() { createGroup(); },
  newcommunity() { newCommunityModal(); },
  'cm-addgroup'(el) { addGroupToCommunity(el.dataset.cm); },
  myqr() { qrModal(); },
  scanqr() { scanModal(); },
  calllink() { callLinkModal(); },
  clearsearch(el) { const inp = $('#' + el.dataset.for); if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); } },
  filescat(el) { ui.filesCat = el.dataset.f; renderSidebar(); },
  fileq(el) { ui.filesQuery = el.dataset.q; renderSidebar(); },
  callback(el) { const ch = chatById(el.dataset.chat); if (ch) startCall(ch, !!el.dataset.video); },

  // status
  viewstatus(el) { openStatus(+el.dataset.idx); },
  viewmystatus() { openMyStatus(); },
  addstatus() { addStatusModal(); },
  'story-close'() { closeStory(); },
  'story-next'() { storyNext(); },
  'story-prev'() { storyPrev(); },
  'story-react'(el) { storyReply(el.dataset.e); },
  'story-send'() { const i = $('#story-input'); if (i && i.value.trim()) { storyReply(i.value.trim()); i.value = ''; storyNext(); } },
  'story-delete'() { const st = ui.story; S.myStatus.items.splice(st.ii, 1); save(); closeStory(); toast('Status deleted'); },

  // settings
  mecolor(el) { S.me.color = el.dataset.c; save(); renderRail(); renderSidebar(); },
  saveprofile() { saveProfile(); },
  setpin() { setPinModal(); },
  unblockc(el) { const c = contact(el.dataset.c); if (c) toggleBlock(c); },
  logoutsession(el) { S.settings.sessions = S.settings.sessions.filter((s) => s.id !== el.dataset.s); save(); renderSidebar(); toast('Session logged out'); },
  logoutall() { confirmModal('Log out of all other sessions?', 'Every device except this browser will be signed out.', 'Log out', () => { S.settings.sessions = S.settings.sessions.filter((s) => s.current); save(); renderSidebar(); toast('Logged out of all other sessions'); }); },
  chooseplan(el) { S.settings.plan = el.dataset.plan; save(); renderSidebar(); toast(`Switched to ${PLANS[el.dataset.plan].name} plan (demo — no charge)`); },
  resetdemo() { confirmModal('Reset demo data?', 'All chats, settings and media you added will be replaced with the original demo data.', 'Reset', () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } location.reload(); }); },

  // conversation
  closechat() { closeChat(); },
  info() { openDrawer(ui.drawer === 'info' ? null : 'info'); },
  'call-video'() { const ch = curChat(); if (ch) startCall(ch, true); },
  'call-voice'() { const ch = curChat(); if (ch) startCall(ch, false); },
  headmenu(el) { headMenu(el); },
  chatsearch() { if (innerWidth <= 1100) ui.drawer = null; renderDrawer(); ui.chatSearch = ui.chatSearch ?? ''; ui.searchIdx = 0; renderBars(); $('#cs-input')?.focus(); },
  'cs-prev'() { ui.searchIdx++; updateSearchCount(true); },
  'cs-next'() { ui.searchIdx--; updateSearchCount(true); },
  'cs-close'() { ui.chatSearch = null; renderBars(); renderMessages({ keep: true }); },
  scrollbottom() { const m = $('#msgs'); m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' }); },
  jump(el) { jumpTo(el.dataset.mid); },
  quote(el) { jumpTo(el.dataset.mid); },
  'translate-toggle'() { const ch = curChat(); ch.translate = !ch.translate; save(); renderBars(); renderMessages({ keep: true }); renderDrawer(); },
  'sched-view'() { scheduledListModal(curChat()); },
  emoji() { ui.emojiOpen = !ui.emojiOpen; renderComposer(); if (!ui.emojiOpen) focusInput(); },
  emojitab(el) { ui.emojiTab = el.dataset.t; renderEmojiPanel(); },
  emo(el) { insertAtCursor($('#input'), el.dataset.e); },
  sticker(el) { const ch = curChat(); const m = sendMsg(ch, { type: 'sticker', text: el.dataset.e }, { useReply: true }); scheduleReply(ch, m); },
  sendgif(el) { const ch = curChat(); const m = sendMsg(ch, { type: 'gif', gif: GIFS[+el.dataset.i] }, { useReply: true }); scheduleReply(ch, m); },
  attach(el) { attachMenu(el); },
  aiwrite(el) { aiWriteMenu(el); },
  sendormic() { const ta = $('#input'); if (ta && ta.value.trim()) sendText(); else startRecording(); },
  'rec-cancel'() { stopRecording(false); },
  'rec-send'() { stopRecording(true); },
  smart(el) { const ch = curChat(); const m = sendMsg(ch, { type: 'text', text: el.dataset.text }, { useReply: true }); scheduleReply(ch, m); },
  cancelreply() { ui.replyTo = null; if (ui.editing) { ui.editing = null; const ta = $('#input'); ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); } renderReplyBox(); renderSmart(); },
  msgmenu(el, e) { e.stopPropagation(); msgMenu(el.dataset.mid, el); },
  reactinfo(el) {
    const m = msgOf(el);
    if (!m) return;
    modal({ title: 'Reactions', body: Object.entries(m.reactions).map(([e, who]) => who.map((w) => `<div class="set-row plain">${avatarHTML(w === 'me' ? S.me : contact(w), 36)}<div class="grow">${esc(senderName(w))}${w === 'me' ? '<div class="ci-sub">Click to remove</div>' : ''}</div><span class="big-emoji" ${w === 'me' ? `data-unreact="${e}"` : ''}>${e}</span></div>`).join('')).join(''),
      onMount: (root, close) => root.addEventListener('click', (ev) => { const u = ev.target.closest('[data-unreact]'); if (u) { react(curChat(), m, u.dataset.unreact); close(); } }) });
  },
  vote(el) { const m = msgOf(el); if (m) vote(curChat(), m, +el.dataset.opt); },
  pay(el) { const m = msgOf(el); if (m) payRequest(curChat(), m); },
  'pay-decline'(el) { const m = msgOf(el); if (m) { m.status = 'declined'; refreshMsg(curChat()); } },
  playvoice(el) { playVoice(el.dataset.mid); },
  viewmedia(el) { const m = msgOf(el); if (m) viewMedia(m); },
  opendoc(el) { const m = msgOf(el); if (m) openDocViewer(m, curChat()); },
  going(el) { const m = msgOf(el); if (!m) return; m.going = m.going.includes('me') ? m.going.filter((x) => x !== 'me') : [...m.going, 'me']; refreshMsg(curChat()); },
  remind(el) { const m = msgOf(el); if (!m) return; m.remind = !m.remind; refreshMsg(curChat()); toast(m.remind ? `We'll remind you before “${m.title}”` : 'Reminder removed'); },
  'invoice-dl'(el) {
    const m = msgOf(el);
    if (!m) return;
    const rows = m.items.map((i) => `<tr><td>${i.qty} × ${esc(i.name)}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>Invoice ${esc(m.orderId)}</title><body style="font-family:sans-serif;max-width:480px;margin:40px auto"><h2>${esc(senderName(m.from))}</h2><p>Invoice ${esc(m.orderId)} · ${new Date(m.t).toLocaleString()}</p><table style="width:100%">${rows}<tr><td><b>Total</b></td><td style="text-align:right"><b>${money(m.total)}</b></td></tr></table><p style="color:green"><b>PAID</b> via WHATSMORE Pay (demo)</p></body>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `Invoice_${m.orderId}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  catalog() { const ch = curChat(); if (ch && isBiz(ch)) catalogModal(ch); },
  verify() { verifyModal(curChat()); },
  unblock() { const ch = curChat(); toggleBlock(contact(ch.contactId)); },
  paymodal() { payModal(curChat()); },
  aisummary() { aiSummaryModal(curChat()); },

  // drawer
  'drawer-close'() { ui.drawer = null; renderDrawer(); },
  'drawer-starred'() { openDrawer('starred'); },
  mute() { const ch = curChat(); ch.muted = !ch.muted; save(); renderDrawer(); refreshSidebar(); },
  disappear() { disappearModal(curChat()); },
  'lock-toggle'() { toggleLock(curChat()); },
  'toggle-readonly'() { const ch = curChat(); ch.readOnly = !ch.readOnly; ch.messages.push({ id: uid(), type: 'system', from: 'system', t: Date.now(), text: ch.readOnly ? 'You changed this group so only admins can send messages' : 'You changed this group so all members can send messages' }); save(); renderMain(); renderDrawer(); },
  member(el, e) { memberMenu(curChat(), el.dataset.id, el); },
  addmember() { addMemberModal(curChat()); },
  invitelink() { inviteLinkModal(curChat()); },
  memmore() { ui.memLimit += 100; $('#mem-list').innerHTML = memberListHTML(curChat()); },
  editdesc() { editDescModal(curChat()); },
  block() { const ch = curChat(); toggleBlock(contact(ch.contactId)); },
  report() { const ch = curChat(); reportModal(contact(ch.contactId)); },
  exitgroup() { exitGroup(curChat()); },
  deletechat() { deleteChat(curChat()); },

  // calls
  'call-mute'() { ui.call.muted = !ui.call.muted; renderCall(); },
  async 'call-cam'() { const c = ui.call; if (!c.video) { c.video = true; c.camOff = false; renderCall(); await getCam(c); } else { c.camOff = !c.camOff; if (!c.camOff && !c.stream) await getCam(c); renderCall(); } },
  'call-blur'() { ui.call.blur = !ui.call.blur; renderCall(); },
  'call-screen'() { toggleScreen(); },
  'call-copylink'() { copyText('https://whatsmore.app/call/' + ui.call.room); },
  'call-end'() { endCall(); },
  'lb-close'() { $('#lightbox')?.remove(); },
};
Object.assign(A, XA);

// ---------- event wiring
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href*="whatsmore.app/call/"]');
  if (link) { e.preventDefault(); startCall(null, true, { room: link.href.split('/call/')[1] }); return; }
  const glink = e.target.closest('a[href*="whatsmore.app/g/"]');
  if (glink) { e.preventDefault(); const code = glink.href.split('/g/')[1]; const g = S.chats.find((c) => c.invite && c.invite === code); if (g) openChat(g.id); else toast('This invite link was reset or is invalid'); return; }
  const prof = e.target.closest('a[href*="whatsmore.app/u/"]');
  if (prof) { e.preventDefault(); if (!connectFromText(prof.href)) toast('User not found'); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('contextmenu', (e) => {
  const bubble = e.target.closest('#msgs .msg-row');
  if (bubble && !e.target.closest('a, video')) { e.preventDefault(); msgMenu(bubble.dataset.mid, { x: e.clientX, y: e.clientY }); return; }
  const item = e.target.closest('#chat-list .chat-item[data-chat]');
  if (item && item.dataset.act === 'open') { e.preventDefault(); chatItemMenu(item.dataset.chat, { x: e.clientX, y: e.clientY }); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  switch (t.id) {
    case 'input':
      ui.draft[ui.active] = t.value; autosize(t); updateSendBtn();
      if (t.value.trim()) $('#smart') && ($('#smart').innerHTML = ''); else renderSmart();
      break;
    case 'chat-search': ui.search = t.value; $('#chat-list').innerHTML = chatListHTML(); break;
    case 'nc-search': ui.ncQuery = t.value; $('#nc-list').innerHTML = newChatListHTML(); break;
    case 'files-search': ui.filesQuery = t.value; $('#files-list').innerHTML = filesListHTML(); break;
    case 'ng-name': ui.ngName = t.value; break;
    case 'ng-search': ui.ngQuery = t.value; $('#ng-list').innerHTML = peoplePickerHTML(t.value, ui.ngPick); break;
    case 'mem-search': ui.memQuery = t.value; ui.memLimit = MEM_PAGE; $('#mem-list').innerHTML = memberListHTML(curChat()); break;
    case 'cs-input': ui.chatSearch = t.value; ui.searchIdx = 0; renderMessages({ keep: true }); updateSearchCount(true); break;
    case 'pf-un': { t.value = t.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); const [k, msg] = checkUsername(t.value); const s = $('#un-status'); s.className = 'un-status ' + k; s.textContent = msg; break; }
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.pick) { t.checked ? ui.ngPick.add(t.dataset.pick) : ui.ngPick.delete(t.dataset.pick); const p = $('#ng-picked'); if (p) p.innerHTML = ngPickedHTML(); return; }
  if (t.dataset.setting) {
    const path = t.dataset.setting;
    const v = t.type === 'checkbox' ? t.checked : t.value;
    setPath(S.settings, path, v);
    save();
    if (path === 'theme') applyTheme();
    if (path === 'autoTranslate' && ui.active) renderMessages({ keep: true });
    if (path === 'security.passkeys' && v) toast('Passkey created for this device (demo)');
    if (path === 'security.twoStep') toast(v ? 'Two-step verification on' : 'Two-step verification off');
    if (path.startsWith('security')) renderSidebar();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.id === 'input' && e.key === 'Enter' && !e.shiftKey && S.settings.enterSend && !e.isComposing) { e.preventDefault(); sendText(); return; }
  if (e.target.id === 'cs-input' && e.key === 'Enter') { e.preventDefault(); A[e.shiftKey ? 'cs-next' : 'cs-prev'](); return; }
  if (e.target.matches?.('[role=button][data-act]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
  if (e.key === 'Escape') {
    if ($('#menu')) return closeMenu();
    if ($('#studio')) return;
    if ($('#lightbox')) return A['lb-close']();
    const modals = $$('.modal-backdrop');
    if (modals.length) return modals[modals.length - 1]._close();
    if (ui.story) return closeStory();
    if (ui.call) return;
    if (ui.emojiOpen) return A.emoji();
    if (ui.replyTo || ui.editing) return A.cancelreply();
    if (ui.chatSearch !== null) return A['cs-close']();
    if (ui.drawer) return A['drawer-close']();
    if (ui.page) return A.back();
  }
  if (ui.story && !e.target.matches('input')) { if (e.key === 'ArrowRight') storyNext(); if (e.key === 'ArrowLeft') storyPrev(); }
});

document.addEventListener('paste', async (e) => {
  if (e.target.id !== 'input') return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  const ch = curChat();
  try { const src = await readImage(file); const m = sendMsg(ch, { type: 'image', src, size: file.size }); scheduleReply(ch, m); } catch (err) { toast('Could not paste image'); }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
window.addEventListener('resize', () => closeMenu());

// ---------- start
load();
migrate();
applyTheme();
renderRail();
renderSidebar();
renderMain();
setInterval(runScheduled, 2000);
setInterval(sweepExpired, 3000);
runScheduled();
// A little life: a new message arrives shortly after opening the demo
setTimeout(() => { const ch = chatById('ch_ananya'); if (ch) simulateIncoming(ch, 'c_ananya', 'btw did you see the new WHATSMORE logo drafts? 😍', 0); }, 20000);
try {
  if (!sessionStorage.getItem('wm-welcome')) {
    sessionStorage.setItem('wm-welcome', '1');
    setTimeout(() => toast('👋 Welcome to the WHATSMORE demo — everything runs locally in your browser.', null, { ms: 5000 }), 600);
  }
} catch (e) { /* storage unavailable */ }
