// Settings tab: profile, security, privacy, chats, payments, storage plans, about
'use strict';
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

const toggleRow = (path, label, sub = '') => `<label class="set-row"><div><div class="ci-name">${label}</div>${sub ? `<div class="ci-sub">${sub}</div>` : ''}</div><input type="checkbox" class="switch" data-setting="${path}" ${getPath(S.settings, path) ? 'checked' : ''}></label>`;
const selectRow = (path, label, opts, sub = '') => `<label class="set-row"><div><div class="ci-name">${label}</div>${sub ? `<div class="ci-sub">${sub}</div>` : ''}</div><select data-setting="${path}">${opts.map(([v, l]) => `<option value="${v}" ${getPath(S.settings, path) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const settingRow = (page, ic, title, sub) => `<div class="list-row action" data-act="page" data-page="${page}"><span class="action-ic plain">${icon(ic, 22)}</span><div class="grow"><div class="ci-name">${title}</div>${sub ? `<div class="ci-sub">${esc(sub)}</div>` : ''}</div>${icon('chevright', 20, 'muted')}</div>`;

function tabSettings() {
  return `<header class="side-head"><h2>Settings</h2></header>
  <div class="side-scroll">
    <div class="profile-card" data-act="page" data-page="set-profile">${avatarHTML(S.me, 64)}<div class="grow"><div class="pc-name">${esc(S.me.name)}</div><div class="ci-sub">@${esc(S.me.username)} · ${esc(S.me.about)}</div></div><button class="icon-btn accent" data-act="myqr" title="My QR code" aria-label="My QR code">${icon('qr')}</button></div>
    ${settingRow('set-security', 'shield', 'Account & security', 'Two-step verification, passkeys, active sessions')}
    ${settingRow('set-devices', 'devices', 'Linked devices', `${S.devices.filter((d) => !d.primary).length} of 4 linked · desktop, tablet & web`)}
    ${settingRow('set-profiles', 'person', 'Profiles', 'Personal, Business, Creator, Family — one app')}
    ${settingRow('set-privacy', 'lock', 'Privacy', 'Last seen, username discovery, blocked contacts')}
    ${settingRow('set-ai', 'sparkle', 'AI & memory', S.settings.aiMemory ? 'AI memory on · you control what AI can use' : 'AI memory off')}
    ${settingRow('set-notify', 'megaphone', 'Notifications', 'Messages, calls, payments, business, security…')}
    ${settingRow('set-chats', 'chat', 'Chats', 'Theme, enter to send, translation')}
    ${settingRow('set-payments', 'rupee', 'Payments', money(S.wallet) + ' demo balance · transaction history')}
    ${settingRow('set-storage', 'cloud', 'Storage & plans', PLANS[S.settings.plan].name + ' plan')}
    ${settingRow('set-starred', 'star', 'Starred messages', '')}
    <div class="list-row action" data-act="svc" data-mod="wellbeing"><span class="action-ic plain">${icon('timer', 22)}</span><div class="grow"><div class="ci-name">Digital wellbeing</div><div class="ci-sub">Screen time, focus mode, quiet hours</div></div>${icon('chevright', 20, 'muted')}</div>
    <div class="list-row action" data-act="importchats"><span class="action-ic plain">${icon('importin', 22)}</span><div class="grow"><div class="ci-name">Import chats</div><div class="ci-sub">Bring your exported chat history from other apps</div></div>${icon('chevright', 20, 'muted')}</div>
    ${settingRow('set-about', 'info', 'About WHATSMORE', 'More Than Chat.')}
    <div class="list-row action danger" data-act="resetdemo"><span class="action-ic plain">${icon('logout', 22)}</span><div class="ci-name">Reset demo data</div></div>
  </div>`;
}

function settingsPage(p) {
  const st = S.settings;
  switch (p) {
    case 'set-profile': return pageHead('Profile') + `<div class="side-scroll"><div class="form-pad">
      <div class="center">${avatarHTML(S.me, 140)}</div>
      <div class="swatches">${COLORS.map((c) => `<button class="swatch ${S.me.color === c ? 'on' : ''}" style="background:${c}" data-act="mecolor" data-c="${c}" aria-label="Avatar colour ${c}"></button>`).join('')}</div>
      <label class="field"><span>Your name</span><input id="pf-name" maxlength="25" value="${esc(S.me.name)}"></label>
      <label class="field"><span>Username</span><div class="un-input"><b>@</b><input id="pf-un" maxlength="24" value="${esc(S.me.username)}" autocapitalize="off" spellcheck="false"></div><small id="un-status" class="un-status ok">✓ @${esc(S.me.username)} is yours</small></label>
      <label class="field"><span>About</span><input id="pf-about" maxlength="80" value="${esc(S.me.about)}"></label>
      <div class="hint-box">${icon('lock', 16)}<span>Your phone number is never shown. People find you by <b>@username</b> or your QR code, and you approve chat requests from people outside your contacts.</span></div>
      <div class="btn-row"><button class="btn" data-act="myqr">${icon('qr', 18)} My QR</button><button class="btn primary" data-act="saveprofile">Save</button></div>
    </div></div>`;

    case 'set-security': {
      const sec = st.security;
      const score = [sec.twoStep, sec.passkeys, sec.biometric, sec.deviceAlerts, st.lockPin].filter(Boolean).length;
      return pageHead('Account & security') + `<div class="side-scroll">
      <div class="dash"><div class="dash-score"><svg viewBox="0 0 36 36" width="64" height="64"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--track)" stroke-width="3"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="${score * 20} 100" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg><b>${score}/5</b></div>
        <div><div class="ci-name">Privacy dashboard</div><div class="ci-sub">${score >= 4 ? 'Your account is well protected 💪' : 'Turn on more protections below to secure your account.'}</div></div></div>
      <div class="list-label">Protection</div>
      ${toggleRow('security.twoStep', 'Two-step verification', 'Require a PIN when registering on a new device')}
      ${toggleRow('security.passkeys', 'Passkeys', 'Sign in with your fingerprint, face or screen lock')}
      ${toggleRow('security.biometric', 'Biometric app lock', 'Unlock WHATSMORE with Face ID / fingerprint')}
      ${toggleRow('security.deviceAlerts', 'New device alerts', 'Get notified when your account is used on a new device')}
      <div class="set-row" data-act="setpin"><div><div class="ci-name">Chat lock PIN</div><div class="ci-sub">${st.lockPin ? 'PIN is set · tap to change' : 'Not set · tap to create'}</div></div>${icon('chevright', 20, 'muted')}</div>
      <div class="list-label">Active sessions</div>
      ${st.sessions.map((s) => `<div class="set-row"><span class="action-ic plain">${icon('devices', 22)}</span><div class="grow"><div class="ci-name">${esc(s.name)}</div><div class="ci-sub">${esc(s.where)} · ${s.current ? '<span class="green">This device</span>' : 'Active ' + listTime(s.t)}</div></div>${s.current ? '' : `<button class="btn sm danger" data-act="logoutsession" data-s="${s.id}">Log out</button>`}</div>`).join('')}
      ${st.sessions.length > 1 ? '<div class="pad"><button class="btn danger block" data-act="logoutall">Log out of all other sessions</button></div>' : ''}
      <div class="hint-box">${icon('shield', 16)}<span>Private chats, calls, groups and backups are end-to-end encrypted. WHATSMORE is designed with Privacy by Design and independent security audits.</span></div>
    </div>`;
    }

    case 'set-privacy': {
      const vis = [['everyone', 'Everyone'], ['contacts', 'My contacts'], ['nobody', 'Nobody']];
      const blocked = S.contacts.filter((c) => c.blocked);
      return pageHead('Privacy') + `<div class="side-scroll">
      <div class="list-label">Who can see my personal info</div>
      ${selectRow('privacy.lastSeen', 'Last seen & online', vis)}
      ${selectRow('privacy.photo', 'Profile photo', vis)}
      ${selectRow('privacy.about', 'About', vis)}
      ${selectRow('privacy.status', 'Status', PRIVACY_OPTS.slice(0, 4))}
      ${toggleRow('privacy.readReceipts', 'Read receipts', "If turned off, you won't send or receive blue ticks.")}
      <div class="list-label">Username</div>
      ${selectRow('privacy.findByUsername', 'Who can find me by @username', vis)}
      ${toggleRow('privacy.chatRequests', 'Allow chat requests', 'People outside your contacts can request to chat')}
      <div class="list-label">Blocked contacts (${blocked.length})</div>
      ${blocked.length ? blocked.map((c) => `<div class="set-row">${avatarHTML(c, 36)}<div class="grow"><div class="ci-name">${esc(c.name)}</div><div class="ci-sub">@${esc(c.username)}</div></div><button class="btn sm" data-act="unblockc" data-c="${c.id}">Unblock</button></div>`).join('') : '<div class="empty-list small">No blocked contacts</div>'}
    </div>`;
    }

    case 'set-chats': return pageHead('Chats') + `<div class="side-scroll">
      <div class="list-label">Display</div>
      ${selectRow('theme', 'Theme', [['light', 'Light'], ['dark', 'Dark'], ['system', 'System default']])}
      <div class="list-label">Chat settings</div>
      ${toggleRow('enterSend', 'Enter is send', 'Press Enter to send. Shift + Enter adds a new line.')}
      ${toggleRow('autoTranslate', 'Auto-translate chats', 'Show English translations under messages in other languages')}
      ${selectRow('translateTo', 'My language', LANG_LIST)}
      <div class="hint-box">${icon('translate', 16)}<span>Real-time translation lets everyone read the chat in their own language. Demo translations are pre-generated; production would use an on-device or encrypted translation model.</span></div>
    </div>`;

    case 'set-payments': return pageHead('Payments') + `<div class="side-scroll">
      <div class="wallet"><div class="ci-sub">Demo wallet balance</div><div class="wallet-amt">${money(S.wallet)}</div><div class="ci-sub">@${esc(S.me.username)}@whatsmore</div></div>
      <div class="list-label">Transaction history</div>
      ${S.payments.length ? S.payments.slice().sort((a, b) => b.t - a.t).map((p) => `<div class="set-row"><span class="pay-ic ${p.dir}">${icon(p.dir === 'in' ? 'callin' : 'callout', 18)}</span><div class="grow"><div class="ci-name">${p.dir === 'in' ? 'Received from' : 'Paid to'} ${esc(p.with)}</div><div class="ci-sub">${esc(p.note || '')} · ${new Date(p.t).toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${fmtTime(p.t)}</div></div><b class="${p.dir === 'in' ? 'green' : ''}">${p.dir === 'in' ? '+' : '−'}${money(p.amount)}</b></div>`).join('') : '<div class="empty-list small">No transactions yet</div>'}
      <div class="hint-box">${icon('info', 16)}<span>Payments in this demo are simulated — no real money moves. A production launch would use licensed payment partners and comply with local regulations (e.g. RBI / NPCI for UPI in India).</span></div>
    </div>`;

    case 'set-storage': {
      const used = storageUsed();
      const byCat = {};
      allFiles().forEach(({ m, cat }) => { byCat[cat] = (byCat[cat] || 0) + 1; });
      return pageHead('Storage & plans') + `<div class="side-scroll">
      <div class="storage pad"><div class="storage-top"><span>Used</span><span>${fmtSize(used)} of ${PLANS[st.plan].quota}</span></div><div class="meter"><div style="width:${Math.max(2, (used / PLANS[st.plan].bytes) * 100)}%"></div></div>
      <div class="cat-counts">${FILECATS.slice(1).map(([k, l]) => `<span>${l}: <b>${byCat[k] || 0}</b></span>`).join('')}</div></div>
      <div class="list-label">Plans</div>
      <div class="plans">${Object.entries(PLANS).map(([k, p]) => `<div class="plan ${st.plan === k ? 'on' : ''}"><div class="plan-name">${p.name}</div><div class="plan-q">${p.quota}</div><div class="ci-sub">${p.price}</div>${p.perk ? `<div class="plan-perk">${p.perk}</div>` : ''}${st.plan === k ? '<span class="pill">Current</span>' : `<button class="btn sm" data-act="chooseplan" data-plan="${k}">Choose</button>`}</div>`).join('')}</div>
    </div>`;
    }

    case 'set-starred': return pageHead('Starred messages') + `<div class="side-scroll">${starredList(allStarred())}</div>`;

    case 'set-about': return pageHead('About') + `<div class="side-scroll"><div class="about">
      <div class="logo-big">${logoSVG(72)}</div><h2>WHATSMORE</h2><p class="muted">More Than Chat. · Demo v1.0</p>
      <ol class="feat-list">${['Private chat 💬', 'Voice & video calls 📞', 'Groups & communities 👥', 'Stories & status 📸', 'Username-based connection 👤', 'End-to-end encryption 🔐', 'AI assistant & translation 🤖', 'Cloud & file sharing ☁️', 'Payments 💳', 'Business accounts 💼', 'Linked devices 💻', 'Any file type · document correction · digital signature ✍️', 'Super-app services: Pay, Market, Citizen, Learn, Family, SOS, News, My Area, Creator 🌍'].map((f) => `<li>${f}</li>`).join('')}</ol>
      <p class="muted small">CHAT + CALLS + GROUPS + STORIES + USERNAME + SECURITY + AI + CLOUD + PAYMENTS + BUSINESS</p>
    </div></div>`;
  }
  return extraSettingsPage(p);
}

function logoSVG(size = 48) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#00a884"/><path d="M17 22l6.5 22L32 28l8.5 16L47 22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function checkUsername(v) {
  if (v === S.me.username) return ['ok', `✓ @${v} is yours`];
  if (!/^[a-z0-9._]{3,24}$/.test(v)) return ['bad', 'Use 3–24 lowercase letters, numbers, dots or underscores'];
  if (allUsernames().includes(v)) return ['bad', `✗ @${v} is already taken`];
  return ['ok', `✓ @${v} is available`];
}
function saveProfile() {
  const name = $('#pf-name').value.trim(), un = $('#pf-un').value.trim().toLowerCase(), about = $('#pf-about').value.trim();
  if (!name) return toast('Name cannot be empty');
  const [ok, msg] = checkUsername(un);
  if (ok !== 'ok') return toast(msg);
  Object.assign(S.me, { name, username: un, about: about || 'Hey there! I am using WHATSMORE.' });
  save(); renderRail(); toast('Profile saved');
  renderSidebar();
}
