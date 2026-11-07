// What WHATSMORE users see of the admin side: suspension notices, announcements from the
// Command Center, verified badges on their own profile, and badge (verification) requests.
'use strict';
const MOD = { ann: [], channel: null };
const ANN_LEVEL = { info: ['ℹ️', 'ann-info'], warning: ['⚠️', 'ann-warn'], critical: ['🚨', 'ann-crit'] };

// ---------- suspension: shown in live chats; sending is blocked by the database itself
const suspendedText = () => `Your account is suspended until ${new Date(CL.suspended.until).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${CL.suspended.reason ? ' · ' + CL.suspended.reason : ''}. You can read chats but can't send messages, post statuses or start chats.`;
const _extraBarsMod = extraBarsHTML;
extraBarsHTML = function (ch) {
  const h = _extraBarsMod(ch);
  return ch.cloud && CL.suspended && CL.suspended.until > Date.now() ? `<div class="bar suspendbar">${icon('block', 18)}<span class="grow">${esc(suspendedText())}</span></div>` + h : h;
};
const _sendMsgMod = sendMsg;
sendMsg = function (ch, partial, opts) {
  if (ch?.cloud && CL.suspended && CL.suspended.until > Date.now() && cloudOn()) { toast('🚫 ' + suspendedText(), null, { ms: 6000 }); return null; }
  return _sendMsgMod(ch, partial, opts);
};
// sendText and other callers expect a message back; guard the bot hook against null
const _scheduleReplyMod = scheduleReply;
scheduleReply = function (ch, trig) { if (trig) return _scheduleReplyMod(ch, trig); };

// ---------- announcements from the Command Center
async function loadAnnouncements() {
  if (!cloudOn()) { MOD.ann = []; renderAnnouncements(); return; }
  const { data } = await sb.from('announcements').select('id, title, body, level, created_at').eq('active', true).order('created_at', { ascending: false }).limit(5);
  MOD.ann = data || [];
  renderAnnouncements();
}
function renderAnnouncements() {
  let el = document.getElementById('announce');
  const dismissed = (S.dismissedAnn ||= {});
  const show = MOD.ann.filter((a) => !dismissed[a.id]);
  if (!show.length) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'announce'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Announcements'); document.body.prepend(el); }
  el.innerHTML = show.slice(0, 2).map((a) => { const [e, cls] = ANN_LEVEL[a.level] || ANN_LEVEL.info; return `<div class="ann ${cls}"><span>${e}</span><div class="grow"><b>${esc(a.title)}</b> ${esc(a.body)}</div><button class="icon-btn sm" data-act="dismissann" data-id="${a.id}" aria-label="Dismiss announcement">${icon('close', 16)}</button></div>`; }).join('');
}
XA.dismissann = (el) => { (S.dismissedAnn ||= {})[el.dataset.id] = Date.now(); save(); renderAnnouncements(); };
function subscribeModeration() {
  if (MOD.channel) sb.removeChannel(MOD.channel);
  MOD.channel = sb.channel('wm-mod-' + CL.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncements())
    .subscribe();
}
// Your suspension and badge are private to you: checked on sync, on return to the window,
// every 2 minutes, and straight away whenever the database refuses something you send.
async function checkModeration(afterRefusal = false) {
  if (!cloudOn()) return;
  const { data } = await sb.rpc('my_moderation');
  if (!data) return;
  const was = !!CL.suspended, badgeWas = S.me.badge || null;
  CL.suspended = data.suspended_until && Date.parse(data.suspended_until) > Date.now() ? { until: Date.parse(data.suspended_until), reason: data.suspend_reason || '' } : null;
  S.me.badge = data.badge || null; save();
  if (CL.suspended && (!was || afterRefusal)) toast('🚫 ' + suspendedText(), null, { ms: 8000 });
  else if (!CL.suspended && was) toast('✅ Your account is no longer suspended');
  else if (afterRefusal) toast('Not sent — please try again');
  if (S.me.badge && S.me.badge !== badgeWas) toast(`✅ You're now ${BADGE_LABELS[S.me.badge]}`);
  if (ui.active?.startsWith('sb_')) renderBars();
  if (was !== !!CL.suspended || badgeWas !== S.me.badge) renderSidebar();
}
setInterval(() => { if (document.visibilityState === 'visible') checkModeration(); }, 120000);
window.addEventListener('focus', () => checkModeration());
const _cloudSyncMod = cloudSync;
cloudSync = async function () {
  const r = await _cloudSyncMod();
  if (cloudOn() && !MOD.channel) { subscribeModeration(); loadAnnouncements(); }
  checkModeration();
  return r;
};
const _cloudSignedOutMod = cloudSignedOut;
cloudSignedOut = function () {
  if (MOD.channel) { sb.removeChannel(MOD.channel); MOD.channel = null; }
  MOD.ann = []; renderAnnouncements(); CL.suspended = null;
  _cloudSignedOutMod();
};

// ---------- my badge and badge requests (Settings → Profile)
async function verificationModal() {
  if (!cloudOn()) return openAccountFlow('acct-signin');
  const { data: mine } = await sb.from('verification_requests').select('badge, status, created_at').order('created_at', { ascending: false }).limit(1);
  const last = mine?.[0];
  if (last?.status === 'pending') return toast(`Your request for “${BADGE_LABELS[last.badge]}” is being reviewed`);
  modal({
    title: 'Request a badge',
    body: `${S.me.badge ? `<p>You currently have <b>${BADGE_LABELS[S.me.badge]}</b>.</p>` : ''}${last?.status === 'rejected' ? `<p class="muted small">Your last request (${BADGE_LABELS[last.badge]}) wasn't approved. You can apply again with more detail.</p>` : ''}
      <label class="field"><span>Badge</span><select id="vr-b">${Object.entries(BADGE_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="field"><span>Tell us who you are (business registration, official role, website…)</span><textarea id="vr-n" rows="3" maxlength="500"></textarea></label>
      ${note('WHATSMORE checks every request against documented criteria. Nobody can simply claim an official badge.', 'verified')}`,
    actions: [{ label: 'Cancel' }, { label: 'Send request', primary: true, onClick: (root) => {
      const n = $('#vr-n', root).value.trim();
      if (n.length < 10) { toast('Add a few details so the team can check'); return false; }
      sb.from('verification_requests').insert({ badge: $('#vr-b', root).value, note: n }).then(({ error }) => toast(error ? 'Not sent: ' + error.message : 'Request sent — you\'ll see the badge once it\'s approved'));
    } }],
  });
}
XA.requestbadge = () => verificationModal();
const _settingsPageMod = settingsPage;
settingsPage = function (p) {
  const h = _settingsPageMod(p);
  if (p !== 'set-profile' || !cloudOn()) return h;
  const row = `<div class="list-row action" data-act="requestbadge"><span class="action-ic plain">${icon('verified', 22)}</span><div class="grow"><div class="ci-name">${S.me.badge ? BADGE_LABELS[S.me.badge] + ' ✓' : 'Request a badge'}</div><div class="ci-sub">${S.me.badge ? 'Shown next to your name · request a different badge' : 'Verified, Business, Creator, Official or Government'}</div></div>${icon('chevright', 20, 'muted')}</div>`;
  return h.replace('<div class="btn-row">', row + '<div class="btn-row">');
};
