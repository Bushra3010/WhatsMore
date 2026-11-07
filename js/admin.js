// WHATSMORE Command Center: the web admin panel.
// Admins sign in with their WHATSMORE account. Every read and change goes through admin_* database
// functions that refuse anyone who is not on the admins list, and every change is written to the audit log.
'use strict';
const SB_URL = 'https://nkmqdkkjdrvsconphnae.supabase.co';
const SB_KEY = 'sb_publishable_vr2jTPISjmK4FBkmGNOQ8A_Ay5tx6se';
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wm-admin-auth' } });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const when = (t) => (t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const ago = (t) => { if (!t) return 'never'; const s = (Date.now() - Date.parse(t)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
const bytes = (b) => { b = Number(b || 0); return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB'; };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
// 'YYYY-MM-DD' from the server is a calendar day in the admin's zone: read it as local, not UTC
const dayOf = (s) => new Date(s + 'T00:00:00');
const BADGES = { verified: 'Verified', business: 'Business verified', creator: 'Creator verified', official: 'Official', government: 'Government' };
const LOGO = '<svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#1a73e8"/></linearGradient><linearGradient id="lt" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="46"><stop offset=".333" stop-color="#ff9933"/><stop offset=".333" stop-color="#fff"/><stop offset=".667" stop-color="#fff"/><stop offset=".667" stop-color="#1ea31a"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="url(#lb)"/><path d="M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23" fill="none" stroke="url(#lt)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SECTIONS = [['dashboard', 'Dashboard'], ['users', 'Users'], ['reports', 'Reports'], ['verification', 'Verification'], ['content', 'Statuses'], ['announcements', 'Announcements'], ['audit', 'Audit log'], ['admins', 'Admins']];
const AD = { me: null, section: location.hash.slice(1) || 'dashboard', stats: null, q: '', reportTab: 'open', refreshT: 0 };
const app = $('#app');

function toast(t) { $('#toast')?.remove(); const el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 3500); }
function dialog({ title, body, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'backdrop';
    el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div>${body}</div><div class="btns"><button class="btn" data-x="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="1">${esc(ok)}</button></div></div>`;
    document.body.append(el);
    el.querySelector('input, textarea, select')?.focus();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]');
      if (e.target === el || b) { const vals = Object.fromEntries($$('[name]', el).map((i) => [i.name, i.value])); el.remove(); resolve(b?.dataset.x === '1' ? vals : null); }
    });
  });
}
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) { toast(error.message); throw error; }
  return data;
}

// ---------- sign-in
function renderLogin(msg = '') {
  app.innerHTML = `<div class="login"><form class="login-card" id="login" autocomplete="on">
    <div class="brand-row">${LOGO}<div><b>WHATSMORE</b><div class="muted small">Command Center</div></div></div>
    <h1>Admin sign-in</h1><p class="muted small">Use your WHATSMORE account. Only accounts on the admin list can open the Command Center.</p>
    <label class="field">Email<input name="email" type="email" required autocomplete="username"></label>
    <label class="field">Password<input name="password" type="password" required autocomplete="current-password"></label>
    <div class="err" id="login-err">${esc(msg)}</div>
    <button class="btn primary" type="submit">Sign in</button>
    <a class="small" href="./">← Back to WHATSMORE</a></form></div>`;
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#login-err').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) { $('#login-err').textContent = error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message; return; }
    boot();
  });
}
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return renderLogin();
  const { data: me, error } = await sb.rpc('admin_me');
  if (error || !me) {
    await sb.auth.signOut();
    return renderLogin('This account is not an admin. Ask the owner to add you on the Admins page.');
  }
  AD.me = me;
  renderShell();
  show(AD.section);
}

// ---------- layout
function renderShell() {
  app.innerHTML = `<div class="shell"><nav class="nav" aria-label="Command Center">
      <div class="brand-row">${LOGO}<div>WHATSMORE<div class="muted small">Command Center</div></div></div>
      ${SECTIONS.filter(([k]) => k !== 'admins' || AD.me.role === 'owner').map(([k, l]) => `<button data-sec="${k}" aria-current="${k === AD.section}">${l}<span class="count" id="count-${k}" hidden></span></button>`).join('')}
      <div class="grow"></div>
      <div class="who">${esc(AD.me.name || '')} · @${esc(AD.me.username || '')}<br>${AD.me.role === 'owner' ? 'Owner' : 'Moderator'} · <a href="#" id="signout">Sign out</a></div>
    </nav><main class="main" id="main"></main></div>`;
  $$('[data-sec]').forEach((b) => b.addEventListener('click', () => show(b.dataset.sec)));
  $('#signout').addEventListener('click', async (e) => { e.preventDefault(); await sb.auth.signOut(); AD.me = null; renderLogin('Signed out.'); });
  updateCounts();
}
async function updateCounts() {
  try {
    AD.stats = await rpc('admin_stats', { tz: TZ });
    const set = (k, n) => { const el = $('#count-' + k); if (el) { el.hidden = !n; el.textContent = n; } };
    set('reports', AD.stats.reports_open); set('verification', AD.stats.verifications_pending);
  } catch (e) { /* toast already shown */ }
}
function show(sec) {
  if (!SECTIONS.some(([k]) => k === sec) || (sec === 'admins' && AD.me.role !== 'owner')) sec = 'dashboard';
  AD.section = sec; history.replaceState(null, '', '#' + sec);
  $$('[data-sec]').forEach((b) => { b.classList.toggle('on', b.dataset.sec === sec); b.setAttribute('aria-current', b.dataset.sec === sec); });
  clearInterval(AD.refreshT);
  ({ dashboard, users, reports, verification, content, announcements, audit, admins })[sec]();
}
const head = (title, tools = '') => `<div class="topbar"><h2>${title}</h2><div class="tools">${tools}<button class="btn sm" id="refresh">Refresh</button></div></div>`;
const bindRefresh = (fn) => $('#refresh')?.addEventListener('click', fn);

// ---------- dashboard
function barChart(rows, key, label) {
  const W = 560, H = 160, padL = 34, padB = 22, max = Math.max(1, ...rows.map((r) => r[key]));
  const step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step;
  const bw = (W - padL) / rows.length, gap = 2;
  const ticks = top >= 2 && top % 2 === 0 ? [0, top / 2, top] : [0, top]; // counts are whole numbers
  const svg = `<svg viewBox="0 0 ${W} ${H + padB}" role="img" aria-label="${esc(label)}, last 14 days">
    ${ticks.map((t) => { const y = H - (t / top) * H; return `<line class="gridline" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/><text class="axis" x="${padL - 6}" y="${y + 3}" text-anchor="end">${num(t)}</text>`; }).join('')}
    ${rows.map((r, i) => { const h = Math.max(r[key] ? 2 : 0, (r[key] / top) * H), x = padL + i * bw + gap / 2, y = H - h, w = Math.max(2, bw - gap - 4);
      const path = h ? `M${x},${H} L${x},${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, w / 2)},${y} L${x + w - Math.min(4, w / 2)},${y} Q${x + w},${y} ${x + w},${y + Math.min(4, h)} L${x + w},${H} Z` : '';
      const d = dayOf(r.day);
      return `<g data-tip="${esc(d.toLocaleDateString([], { day: 'numeric', month: 'short' }))}: ${num(r[key])}">${path ? `<path class="bar" d="${path}"/>` : ''}<rect class="hit" x="${padL + i * bw}" y="0" width="${bw}" height="${H}"/>
        ${i % 2 === rows.length % 2 ? '' : `<text class="axis" x="${x + w / 2}" y="${H + 15}" text-anchor="middle">${d.getDate()}</text>`}</g>`; }).join('')}
  </svg>`;
  return `<div class="chart">${svg}</div><details class="table-view"><summary>Show as table</summary><table><thead><tr><th>Day</th><th class="num">${esc(label)}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(dayOf(r.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td class="num">${num(r[key])}</td></tr>`).join('')}</tbody></table></details>`;
}
function bindTips(root) {
  $$('.chart', root).forEach((c) => {
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; c.append(tip);
    $$('g[data-tip]', c).forEach((g) => {
      g.addEventListener('mouseenter', () => { const r = g.querySelector('.hit').getBoundingClientRect(), cr = c.getBoundingClientRect(); tip.textContent = g.dataset.tip; tip.style.left = (r.left - cr.left + r.width / 2) + 'px'; tip.style.top = (g.querySelector('.bar')?.getBoundingClientRect().top - cr.top || 150) + 'px'; tip.hidden = false; g.querySelector('.bar')?.classList.add('hover'); });
      g.addEventListener('mouseleave', () => { tip.hidden = true; g.querySelector('.bar')?.classList.remove('hover'); });
    });
  });
}
async function dashboard() {
  const main = $('#main');
  main.innerHTML = head('Dashboard') + '<div class="empty">Loading…</div>';
  bindRefresh(dashboard);
  let s; try { s = AD.stats = await rpc('admin_stats', { tz: TZ }); } catch (e) { return; }
  updateCountsFrom(s);
  const kpi = (l, v, sub = '', alert = false) => `<div class="kpi ${alert ? 'alert' : ''}"><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const kinds = Object.entries(s.by_kind || {}).sort((a, b) => b[1] - a[1]); const kmax = Math.max(1, ...kinds.map((k) => k[1]));
  const KIND = { text: 'Text', image: 'Photos', video: 'Videos', voice: 'Voice notes', doc: 'Documents', rich: 'Polls, events & more', deleted: 'Deleted' };
  main.innerHTML = head('Dashboard', `<span class="muted small">Live data · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`) + `
    <div class="kpis">
      ${kpi('Total users', num(s.users), `+${num(s.users_today)} today · +${num(s.users_7d)} in 7 days`)}
      ${kpi('Active today', num(s.active_24h), `${num(s.signed_in_24h)} signed in`)}
      ${kpi('Messages today', num(s.messages_today), `${num(s.messages)} in total`)}
      ${kpi('Chats', num(s.direct_chats + s.groups), `${num(s.direct_chats)} 1:1 · ${num(s.groups)} groups`)}
      ${kpi('Live statuses', num(s.statuses_live), 'Expire after 24 h')}
      ${kpi('Files stored', num(s.files), bytes(s.storage_bytes))}
      ${kpi('Open reports', num(s.reports_open), s.reports_open ? 'Needs review' : 'All clear', s.reports_open > 0)}
      ${kpi('Verification requests', num(s.verifications_pending), `${num(s.verified)} verified accounts`)}
      ${kpi('Suspended accounts', num(s.suspended))}
    </div>
    <div class="grid2">
      <div class="card"><h3>New sign-ups per day</h3><p class="sub">Last 14 days · ${esc(s.tz)} time</p>${barChart(s.daily || [], 'signups', 'Sign-ups')}</div>
      <div class="card"><h3>Messages per day</h3><p class="sub">Last 14 days · all chats</p>${barChart(s.daily || [], 'messages', 'Messages')}</div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Messages by type</h3><p class="sub">All time</p>${kinds.length ? kinds.map(([k, n]) => `<div class="hbar"><span>${esc(KIND[k] || k)}</span><div class="track"><div class="fill" style="width:${(n / kmax) * 100}%"></div></div><b>${num(n)}</b></div>`).join('') : '<div class="empty">No messages yet</div>'}</div>
      <div class="card attn"><h3>Needs attention</h3><p class="sub">Open queues</p>
        <div class="hbar"><span>Reports</span><span>${s.reports_open ? `<span class="pill bad">${num(s.reports_open)} open</span>` : '<span class="pill good">✓ None open</span>'}</span><button class="btn sm" data-go="reports">Review</button></div>
        <div class="hbar"><span>Verification</span><span>${s.verifications_pending ? `<span class="pill warn">${num(s.verifications_pending)} pending</span>` : '<span class="pill good">✓ None pending</span>'}</span><button class="btn sm" data-go="verification">Review</button></div>
        <p class="muted small">Calls go directly between people's browsers and are not stored, so the Command Center does not count them.</p></div>
    </div>`;
  bindRefresh(dashboard); bindTips(main);
  $$('[data-go]', main).forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  AD.refreshT = setInterval(() => { if (AD.section === 'dashboard' && document.visibilityState === 'visible') dashboard(); }, 60000);
}
function updateCountsFrom(s) { const set = (k, n) => { const el = $('#count-' + k); if (el) { el.hidden = !n; el.textContent = n; } }; set('reports', s.reports_open); set('verification', s.verifications_pending); }

// ---------- users
async function users() {
  const main = $('#main');
  main.innerHTML = head('Users', `<input class="search" id="uq" placeholder="Search name, @username or email" value="${esc(AD.q)}" style="width:260px">`) + '<div class="card"><div class="empty">Loading…</div></div>';
  bindRefresh(users);
  let t; $('#uq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { AD.q = e.target.value.trim(); loadUsers(); }, 300); });
  loadUsers();
}
async function loadUsers() {
  let list; try { list = await rpc('admin_users', { q: AD.q, lim: 100, off: 0 }); } catch (e) { return; }
  const card = $('#main .card');
  if (!list.length) { card.innerHTML = `<div class="empty">${AD.q ? 'No users match “' + esc(AD.q) + '”.' : 'No users yet.'}</div>`; return; }
  card.innerHTML = `<div class="table-wrap"><table><thead><tr><th>User</th><th>Joined</th><th>Last sign-in</th><th class="num">Messages</th><th class="num">Chats</th><th>Status</th><th>Badge</th><th>Actions</th></tr></thead><tbody>
    ${list.map((u) => { const susp = u.suspended_until && Date.parse(u.suspended_until) > Date.now();
      return `<tr data-u="${u.id}"><td class="user-cell"><b>${esc(u.name || '—')}${u.admin_role ? ` <span class="pill badge">${u.admin_role === 'owner' ? 'Owner' : 'Moderator'}</span>` : ''}</b><span>@${esc(u.username || '—')} · ${esc(u.email || '')}</span></td>
        <td class="nw">${when(u.created_at)}</td><td class="nw">${ago(u.last_sign_in_at)}</td><td class="num">${num(u.messages)}</td><td class="num">${num(u.chats)}</td>
        <td>${susp ? `<span class="pill bad" title="${esc(u.suspend_reason || '')}">Suspended until ${when(u.suspended_until)}</span>` : '<span class="pill good">Active</span>'}${u.open_reports ? ` <span class="pill warn">${u.open_reports} report${u.open_reports > 1 ? 's' : ''}</span>` : ''}</td>
        <td><select data-badge aria-label="Badge for @${esc(u.username || '')}"><option value="">None</option>${Object.entries(BADGES).map(([k, l]) => `<option value="${k}" ${u.badge === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><div class="row-actions">${u.admin_role ? '' : susp ? '<button class="btn sm" data-act="unsuspend">Unsuspend</button>' : '<button class="btn sm danger" data-act="suspend">Suspend</button>'}${AD.me.role === 'owner' && !u.admin_role ? '<button class="btn sm danger" data-act="delete">Delete</button>' : ''}</div></td></tr>`; }).join('')}
    </tbody></table></div><p class="muted small">Showing the newest ${list.length} accounts. Badges show next to the person's name in WHATSMORE.</p>`;
  $$('tr[data-u]', card).forEach((tr) => {
    const u = list.find((x) => x.id === tr.dataset.u);
    tr.querySelector('[data-badge]').addEventListener('change', async (e) => { try { await rpc('admin_set_badge', { u: u.id, b: e.target.value }); toast(e.target.value ? `@${u.username} is now ${BADGES[e.target.value]}` : `Badge removed from @${u.username}`); } catch (err) { e.target.value = u.badge || ''; } });
    tr.querySelector('[data-act="suspend"]')?.addEventListener('click', async () => {
      const v = await dialog({ title: `Suspend @${u.username}?`, body: '<p class="muted">They can still sign in and read, but cannot send messages, post statuses or start chats.</p><label class="field">For<select name="days"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option><option value="3650">Indefinitely</option></select></label><label class="field">Reason (shown to them)<input name="reason" maxlength="300" placeholder="e.g. Spam reported by several people"></label>', ok: 'Suspend', danger: true });
      if (!v) return;
      try { await rpc('admin_suspend', { u: u.id, days: +v.days, reason: v.reason || 'Breaking WHATSMORE rules' }); toast(`@${u.username} suspended`); loadUsers(); } catch (e) { /* toast shown */ }
    });
    tr.querySelector('[data-act="unsuspend"]')?.addEventListener('click', async () => { try { await rpc('admin_suspend', { u: u.id, days: 0, reason: '' }); toast(`@${u.username} can send again`); loadUsers(); } catch (e) { /* shown */ } });
    tr.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      const v = await dialog({ title: `Delete @${u.username}?`, body: `<p class="muted">This permanently deletes their account, profile, messages, statuses and memberships. It cannot be undone.</p><label class="field">Type <b>${esc(u.username)}</b> to confirm<input name="confirm" autocomplete="off"></label><label class="field">Reason (for the audit log)<input name="reason" maxlength="200"></label>`, ok: 'Delete account', danger: true });
      if (!v) return;
      if (v.confirm.trim().toLowerCase() !== String(u.username).toLowerCase()) return toast('Username did not match — nothing deleted');
      try { await rpc('admin_delete_user', { u: u.id, reason: v.reason || '' }); toast(`@${u.username} deleted`); loadUsers(); } catch (e) { /* shown */ }
    });
  });
}

// ---------- reports
async function reports() {
  const main = $('#main');
  main.innerHTML = head('Reports', `<div class="seg" role="tablist">${[['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([k, l]) => `<button data-rt="${k}" class="${AD.reportTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`) + '<div id="rlist"><div class="empty">Loading…</div></div>';
  bindRefresh(reports);
  $$('[data-rt]').forEach((b) => b.addEventListener('click', () => { AD.reportTab = b.dataset.rt; reports(); }));
  let list; try { list = await rpc('admin_reports', { st: AD.reportTab }); } catch (e) { return; }
  updateCounts();
  const box = $('#rlist');
  if (!list.length) { box.innerHTML = `<div class="card empty">${AD.reportTab === 'open' ? '✓ No open reports.' : 'Nothing here.'}</div>`; return; }
  box.innerHTML = list.map((r) => {
    const content = r.target_message ? (r.message_deleted_at ? '<div class="quote gone">Message already removed</div>' : `<div class="quote">${esc(r.message_body || r.message_caption || (r.message_file ? '📎 ' + r.message_file : '[' + (r.message_kind || 'message') + ']'))}</div>`) : '';
    const who = r.target_username ? `@${esc(r.target_username)}${r.target_name ? ' (' + esc(r.target_name) + ')' : ''}` : esc(r.target_label || '—');
    const suspended = r.target_suspended_until && Date.parse(r.target_suspended_until) > Date.now();
    return `<div class="card report" data-r="${r.id}"><div class="head"><span class="pill bad">${esc(r.category)}</span><span class="pill">${esc(r.target_kind)}</span>
        ${r.status !== 'open' ? `<span class="pill ${r.status === 'actioned' ? 'good' : ''}">${r.status === 'actioned' ? 'Actioned' : 'Dismissed'}</span>` : ''}${suspended ? '<span class="pill warn">Suspended</span>' : ''}
        <span class="muted small">${when(r.created_at)} · reported by @${esc(r.reporter_username || 'deleted user')}</span></div>
      <div><b>Reported:</b> ${who}</div>${content}${r.details ? `<div class="muted">“${esc(r.details)}”</div>` : ''}
      ${r.status === 'open' ? `<div class="actions-row"><input placeholder="Note (optional)" data-note maxlength="300" aria-label="Note">
        <button class="btn sm" data-do="dismiss">Dismiss</button>
        ${r.target_message && !r.message_deleted_at ? '<button class="btn sm danger" data-do="remove">Remove message</button>' : ''}
        ${(r.target_user || r.message_sender) && !suspended ? '<button class="btn sm danger" data-do="suspend">Suspend 7 days</button>' : ''}
        ${r.target_message && !r.message_deleted_at && (r.target_user || r.message_sender) ? '<button class="btn sm danger" data-do="both">Remove + suspend</button>' : ''}</div>`
        : `<div class="muted small">${r.resolution ? '“' + esc(r.resolution) + '” · ' : ''}${when(r.resolved_at)}</div>`}</div>`;
  }).join('');
  $$('[data-do]', box).forEach((b) => b.addEventListener('click', async () => {
    const card = b.closest('[data-r]'), note = card.querySelector('[data-note]').value.trim(), d = b.dataset.do;
    try {
      await rpc('admin_resolve_report', { rid: card.dataset.r, outcome: d === 'dismiss' ? 'dismissed' : 'actioned', note, remove_message: d === 'remove' || d === 'both', suspend_days: d === 'suspend' || d === 'both' ? 7 : 0 });
      toast({ dismiss: 'Report dismissed', remove: 'Message removed for everyone', suspend: 'Account suspended for 7 days', both: 'Message removed and account suspended' }[d]);
      reports();
    } catch (e) { /* shown */ }
  }));
}

// ---------- verification
async function verification() {
  const main = $('#main');
  main.innerHTML = head('Verification requests') + '<div class="notice">Approve only after checking documents: Business (registered business), Creator (identity and audience), Official (registered organisation), Government (authorised department). A badge can be removed any time from Users.</div><div id="vlist"><div class="empty">Loading…</div></div>';
  bindRefresh(verification);
  let list; try { list = await rpc('admin_verifications', { st: 'all' }); } catch (e) { return; }
  updateCounts();
  const box = $('#vlist');
  if (!list.length) { box.innerHTML = '<div class="card empty">No verification requests yet. People request a badge from Settings → Profile in WHATSMORE.</div>'; return; }
  box.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>Account</th><th>Requested</th><th>Note</th><th>When</th><th>Decision</th></tr></thead><tbody>
    ${list.map((v) => `<tr data-v="${v.id}"><td class="user-cell"><b>${esc(v.name || '—')}</b><span>@${esc(v.username || '')}${v.current_badge ? ' · now ' + esc(BADGES[v.current_badge]) : ''}</span></td><td><span class="pill badge">${esc(BADGES[v.badge])}</span></td><td>${esc(v.note || '—')}</td><td class="nw">${when(v.created_at)}</td>
      <td>${v.status === 'pending' ? '<div class="row-actions"><button class="btn sm primary" data-ok="1">Approve</button><button class="btn sm" data-ok="0">Reject</button></div>' : `<span class="pill ${v.status === 'approved' ? 'good' : ''}">${v.status === 'approved' ? 'Approved' : 'Rejected'}</span> <span class="muted small">${when(v.decided_at)}</span>`}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $$('[data-ok]', box).forEach((b) => b.addEventListener('click', async () => {
    try { await rpc('admin_decide_verification', { vid: b.closest('[data-v]').dataset.v, approve: b.dataset.ok === '1' }); toast(b.dataset.ok === '1' ? 'Approved — badge added' : 'Request rejected'); verification(); } catch (e) { /* shown */ }
  }));
}

// ---------- statuses (content)
async function content() {
  const main = $('#main');
  main.innerHTML = head('Live statuses') + '<div class="notice">Statuses disappear after 24 hours. Remove one here if it breaks the rules — it disappears for everyone straight away.</div><div class="card" id="slist"><div class="empty">Loading…</div></div>';
  bindRefresh(content);
  let list; try { list = await rpc('admin_recent_statuses'); } catch (e) { return; }
  const box = $('#slist');
  if (!list.length) { box.innerHTML = '<div class="empty">No live statuses right now.</div>'; return; }
  const AUD = { everyone: 'Everyone', contacts: 'Contacts', close: 'Close friends', private: 'Only them' };
  box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Posted by</th><th>Status</th><th>Audience</th><th>Posted</th><th></th></tr></thead><tbody>
    ${list.map((s) => `<tr data-s="${s.id}"><td class="user-cell"><b>${esc(s.name || '—')}</b><span>@${esc(s.username || '')}</span></td><td>${s.kind === 'text' ? esc(s.body) : `<span class="pill">${s.kind === 'voice' ? 'Voice' : 'Photo'}</span> ${esc(s.caption || '')}`}</td><td>${AUD[s.audience] || s.audience}</td><td class="nw">${ago(s.created_at)}</td><td><button class="btn sm danger" data-rm>Remove</button></td></tr>`).join('')}
    </tbody></table></div>`;
  $$('[data-rm]', box).forEach((b) => b.addEventListener('click', async () => {
    const v = await dialog({ title: 'Remove this status?', body: '<label class="field">Reason (for the audit log)<input name="reason" maxlength="200"></label>', ok: 'Remove', danger: true });
    if (!v) return;
    try { const path = await rpc('admin_remove_status', { sid: b.closest('[data-s]').dataset.s, reason: v.reason || '' }); if (path) await sb.storage.from('status-media').remove([path]).catch(() => {}); toast('Status removed'); content(); } catch (e) { /* shown */ }
  }));
}

// ---------- announcements
async function announcements() {
  const main = $('#main');
  main.innerHTML = head('Announcements') + `<div class="card"><h3>New announcement</h3><p class="sub">Shown as a banner to everyone signed in to WHATSMORE, straight away.</p>
      <form id="ann" class="report"><label class="field">Title<input name="title" maxlength="80" required></label><label class="field">Message<textarea name="body" rows="3" maxlength="600" required></textarea></label>
      <label class="field">Type<select name="level"><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
      <div class="actions-row"><button class="btn primary" type="submit">Publish</button></div></form></div><div class="card" id="alist"><div class="empty">Loading…</div></div>`;
  bindRefresh(announcements);
  $('#ann').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await rpc('admin_announce', { t: f.get('title').trim(), b: f.get('body').trim(), lvl: f.get('level') }); toast('Announcement published'); announcements(); } catch (err) { /* shown */ }
  });
  let list; try { list = await rpc('admin_announcements'); } catch (e) { return; }
  const box = $('#alist');
  box.innerHTML = list.length ? `<h3>Published</h3><div class="table-wrap"><table><tbody>${list.map((a) => `<tr data-a="${a.id}"><td><span class="pill ${a.level === 'critical' ? 'bad' : a.level === 'warning' ? 'warn' : 'badge'}">${a.level === 'critical' ? 'Critical' : a.level === 'warning' ? 'Warning' : 'Info'}</span></td><td><b>${esc(a.title)}</b><div class="muted small">${esc(a.body)}</div></td><td class="nw">${when(a.created_at)}</td><td>${a.active ? '<span class="pill good">Showing</span> <button class="btn sm" data-end>End</button>' : '<span class="pill">Ended</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No announcements yet.</div>';
  $$('[data-end]', box).forEach((b) => b.addEventListener('click', async () => { try { await rpc('admin_end_announcement', { aid: b.closest('[data-a]').dataset.a }); toast('Announcement ended'); announcements(); } catch (e) { /* shown */ } }));
}

// ---------- audit log
async function audit() {
  const main = $('#main');
  main.innerHTML = head('Audit log') + '<div class="notice">Every admin action is recorded here and cannot be edited.</div><div class="card" id="aud"><div class="empty">Loading…</div></div>';
  bindRefresh(audit);
  let list; try { list = await rpc('admin_audit_log', { lim: 200 }); } catch (e) { return; }
  const LABEL = { 'badge.set': 'Gave a badge', 'badge.remove': 'Removed a badge', 'user.suspend': 'Suspended', 'user.unsuspend': 'Unsuspended', 'user.delete': 'Deleted account', 'report.actioned': 'Actioned report', 'report.dismissed': 'Dismissed report', 'message.remove': 'Removed message', 'verification.approve': 'Approved verification', 'verification.reject': 'Rejected verification', 'announcement.publish': 'Published announcement', 'announcement.end': 'Ended announcement', 'status.remove': 'Removed status', 'admin.set': 'Set admin role', 'admin.remove': 'Removed admin' };
  $('#aud').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>${list.map((a) => `<tr><td class="nw">${when(a.created_at)}</td><td>@${esc(a.admin_username || '—')}</td><td>${esc(LABEL[a.action] || a.action)}</td><td>${a.target_username ? '@' + esc(a.target_username) : a.details?.who ? esc(a.details.who) + ' <span class="muted small">(deleted)</span>' : `<span class="muted small">${esc(String(a.target || '').slice(0, 8))}</span>`}</td><td class="muted small">${esc(Object.entries(a.details || {}).filter(([k, v]) => k !== 'who' && v !== null && v !== '' && v !== false && v !== 0).map(([k, v]) => k + ': ' + v).join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No admin actions yet.</div>';
}

// ---------- admins (owner only)
async function admins() {
  const main = $('#main');
  main.innerHTML = head('Admins') + `<div class="card"><h3>Add an admin</h3><p class="sub">Moderators handle reports, verification, statuses and announcements. Owners can also delete accounts and manage admins.</p>
    <form id="addadm" class="actions-row"><input name="u" placeholder="@username" required aria-label="Username"><select name="r" aria-label="Role"><option value="moderator">Moderator</option><option value="owner">Owner</option></select><button class="btn primary" type="submit">Add</button></form></div><div class="card" id="admlist"><div class="empty">Loading…</div></div>`;
  bindRefresh(admins);
  $('#addadm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = new FormData(e.target), un = f.get('u').trim().replace(/^@/, '').toLowerCase();
    try {
      const found = (await rpc('admin_users', { q: un, lim: 20, off: 0 })).find((u) => u.username === un);
      if (!found) return toast(`No account with @${un}`);
      await rpc('admin_set_admin', { u: found.id, r: f.get('r') }); toast(`@${un} is now ${f.get('r') === 'owner' ? 'an owner' : 'a moderator'}`); admins();
    } catch (err) { /* shown */ }
  });
  let list; try { list = await rpc('admin_list_admins'); } catch (e) { return; }
  $('#admlist').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Admin</th><th>Role</th><th>Since</th><th></th></tr></thead><tbody>${list.map((a) => `<tr data-a="${a.user_id}"><td class="user-cell"><b>${esc(a.name || '—')}</b><span>@${esc(a.username || '')} · ${esc(a.email || '')}</span></td><td><span class="pill badge">${a.role === 'owner' ? 'Owner' : 'Moderator'}</span></td><td class="nw">${when(a.added_at)}</td><td>${a.user_id === AD.me.user_id ? '<span class="muted small">You</span>' : '<button class="btn sm danger" data-rm>Remove</button>'}</td></tr>`).join('')}</tbody></table></div>`;
  $$('[data-rm]').forEach((b) => b.addEventListener('click', async () => { try { await rpc('admin_set_admin', { u: b.closest('[data-a]').dataset.a, r: '' }); toast('Admin removed'); admins(); } catch (e) { /* shown */ } }));
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && AD.me) { AD.me = null; renderLogin('Signed out.'); } });
boot();
