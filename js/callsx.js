// Core feature §2 Voice & Video Calls gaps: camera switching, virtual backgrounds, HD audio with
// noise cancellation / echo reduction (real browser constraints), HD video, call waiting (hold & swap)
// and adding people to a 1:1 call to make it a group call.
'use strict';
const CALL_FX = [
  ['none', 'None', '🚫'], ['blur', 'Blur', '💧'], ['office', 'Office', '🏢'], ['beach', 'Beach', '🏖️'],
  ['library', 'Library', '📚'], ['space', 'Space', '🌌'], ['sunset', 'Sunset', '🌅'], ['brand', 'WHATSMORE', '💚'],
];
const fxOf = (call) => call.fx || (call.blur ? 'blur' : 'none');
function selfViewFxClass(call) {
  const fx = fxOf(call);
  return `${fx !== 'none' && fx !== 'blur' ? 'vbg vbg-' + fx : ''} ${call.facing === 'environment' ? 'rear' : ''}`;
}
function selfViewLabel(call) {
  const fx = fxOf(call), bits = [];
  if (fx === 'blur') bits.push('blur on');
  else if (fx !== 'none') bits.push(CALL_FX.find((f) => f[0] === fx)[1] + ' background');
  if (call.facing === 'environment') bits.push('rear camera');
  if (call.res) bits.push(call.res);
  return bits.length ? ' · ' + bits.join(' · ') : '';
}

function callXButtonsHTML(call) {
  return `${call.video ? `<button class="cbtn" data-act="call-flip" title="Switch camera" aria-label="Switch camera">${icon('flipcam')}</button>
    <button class="cbtn ${fxOf(call) !== 'none' ? 'on' : ''}" data-act="call-fx" title="Background effects" aria-label="Background effects">${icon('blur')}</button>` : ''}
    <button class="cbtn ${call.sheet === 'quality' ? 'on' : ''}" data-act="call-quality" title="Audio & video quality" aria-label="Audio and video quality">${icon('tune')}</button>
    ${call.room ? '' : `<button class="cbtn" data-act="call-add" title="Add people" aria-label="Add people to call">${icon('personadd')}</button>`}`;
}

function callXStageHTML(call) {
  let h = '';
  if (call.held) h += `<div class="held-bar">${icon('pause', 16)}<span class="grow">On hold · ${esc(chatTitle(call.held.ch))}</span><button class="btn sm" data-act="call-swap">Swap</button></div>`;
  if (call.cw) {
    const c = call.cw;
    h += `<div class="cw-card" role="alertdialog" aria-label="Incoming call">${chatAvatar(c, 44)}<div class="grow"><div class="ci-name">${esc(chatTitle(c))}</div><div class="ci-sub">Call waiting · WHATSMORE voice call</div></div>
      <div class="cw-actions"><button class="btn sm danger" data-act="call-cw" data-m="decline">Decline</button><button class="btn sm" data-act="call-cw" data-m="message">Message</button><button class="btn sm" data-act="call-cw" data-m="end">End & answer</button><button class="btn sm primary" data-act="call-cw" data-m="hold">Hold & answer</button></div></div>`;
  }
  if (call.sheet === 'fx') h += `<div class="call-panel fx-panel" role="dialog" aria-label="Background effects"><div class="row-between"><b>Background effects</b><button class="icon-btn sm light" data-act="call-fx" aria-label="Close">${icon('close', 18)}</button></div>
    <div class="fx-grid">${CALL_FX.map(([id, name, e]) => `<button class="fx-tile vbg-${id} ${fxOf(call) === id ? 'on' : ''}" data-act="call-setfx" data-fx="${id}"><span>${e}</span><b>${name}</b></button>`).join('')}</div>
    <p class="cp-note">Demo: virtual backgrounds use an approximate portrait cut-out. The production app would use on-device person segmentation, so your camera feed never leaves your phone.</p></div>`;
  if (call.sheet === 'quality') {
    const q = call.q;
    const row = (k, label, sub) => `<label class="cq-row"><div class="grow"><div>${label}</div><div class="cp-sub">${sub}</div></div><input type="checkbox" class="switch" data-callq="${k}" ${q[k] ? 'checked' : ''}></label>`;
    h += `<div class="call-panel" role="dialog" aria-label="Audio and video quality"><div class="row-between"><b>Audio & video quality</b><button class="icon-btn sm light" data-act="call-quality" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="cp-label">Your microphone</div>
      <div class="mic-meter"><div id="mic-level"></div></div>
      <div class="cp-sub" id="mic-state">${call.micErr ? 'Microphone unavailable — allow access to test these settings' : call.mic ? (call.muted ? 'You are muted' : 'Speak to see your level') : 'Starting microphone…'}</div>
      <div class="cp-label">Audio</div>
      ${row('hdAudio', 'HD audio', '48 kHz wideband voice')}
      ${row('noise', 'Noise cancellation', 'Removes fans, traffic and keyboard noise')}
      ${row('echo', 'Echo reduction', 'Stops your speaker feeding back into the mic')}
      ${row('agc', 'Auto volume', 'Keeps your voice at a steady level')}
      ${call.video ? `<div class="cp-label">Video</div>${row('hdVideo', 'HD video', '720p when your connection allows')}` : ''}
      <div class="cp-label">Browser confirms</div><div class="cp-sub" id="cq-confirm">${qualityConfirmHTML(call)}</div></div>`;
  }
  return h;
}
function qualityConfirmHTML(call) {
  const a = call.mic?.getAudioTracks()[0]?.getSettings?.() || {}, v = call.stream?.getVideoTracks()[0]?.getSettings?.() || {};
  const yn = (x) => (x === undefined ? 'n/a' : x ? 'on' : 'off');
  return [call.mic ? `Noise suppression ${yn(a.noiseSuppression)} · echo cancellation ${yn(a.echoCancellation)} · auto gain ${yn(a.autoGainControl)}${a.sampleRate ? ` · ${(a.sampleRate / 1000).toFixed(1)} kHz` : ''}` : 'Microphone not started',
    call.video && v.width ? `Camera ${v.width}×${v.height}${v.frameRate ? ' @ ' + Math.round(v.frameRate) + ' fps' : ''}` : ''].filter(Boolean).join('<br>');
}

// ---------- camera: front/back switching and HD constraints
async function listCams() { try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (e) { return []; } }
getCam = async function (call) {
  call.q ||= defaultQuality();
  const video = { width: { ideal: call.q.hdVideo ? 1280 : 640 }, height: { ideal: call.q.hdVideo ? 720 : 360 } };
  if (call.camId) video.deviceId = { exact: call.camId }; else video.facingMode = call.facing || 'user';
  call.stream?.getTracks().forEach((t) => t.stop());
  try { call.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); call.camErr = false; }
  catch (e) { call.stream = null; call.camErr = true; }
  updateRes(call);
  if (ui.call === call || ui.call?.held === call) renderCall(); else call.stream?.getTracks().forEach((t) => t.stop());
};
function updateRes(call) { const s = call.stream?.getVideoTracks()[0]?.getSettings?.(); call.res = s?.height ? (s.height >= 720 ? 'HD ' : '') + s.height + 'p' : ''; }
async function flipCamera() {
  const call = ui.call;
  if (!call?.video) return;
  if (call.camErr) return toast('Camera unavailable — allow camera access first');
  const cams = await listCams();
  if (cams.length > 1) {
    const cur = call.stream?.getVideoTracks()[0]?.getSettings?.().deviceId;
    const i = cams.findIndex((c) => c.deviceId === cur);
    const next = cams[(i + 1) % cams.length];
    call.camId = next.deviceId;
    call.facing = /back|rear|environment/i.test(next.label) ? 'environment' : 'user';
    await getCam(call);
    toast(`Switched to ${next.label || (call.facing === 'environment' ? 'rear camera' : 'front camera')}`);
  } else if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    call.facing = call.facing === 'environment' ? 'user' : 'environment';
    call.camId = null;
    await getCam(call);
    toast(call.facing === 'environment' ? 'Rear camera' : 'Front camera');
  } else toast('Only one camera found on this device · on phones this switches front ↔ rear');
}

// ---------- microphone: HD audio, noise cancellation, echo reduction (real getUserMedia constraints)
const defaultQuality = () => ({ hdAudio: true, noise: true, echo: true, agc: true, hdVideo: true });
const audioConstraints = (q) => ({ noiseSuppression: q.noise, echoCancellation: q.echo, autoGainControl: q.agc, sampleRate: q.hdAudio ? 48000 : 16000, channelCount: 1 });
async function startMic(call) {
  if (call.mic || call.micErr) return;
  try {
    call.mic = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(call.q) });
    if (ui.call !== call && ui.call?.held !== call) return stopMic(call);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      call.ac = new AC();
      const an = call.ac.createAnalyser(); an.fftSize = 512;
      call.ac.createMediaStreamSource(call.mic).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!call.mic) return;
        an.getByteTimeDomainData(buf);
        let peak = 0; for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
        const bar = $('#mic-level'); if (bar && ui.call === call) bar.style.width = (call.muted ? 0 : Math.min(100, peak * 1.6)) + '%';
        call.raf = requestAnimationFrame(tick);
      };
      tick();
    }
  } catch (e) { call.micErr = true; }
  if (ui.call === call) renderCall();
}
function stopMic(call) {
  cancelAnimationFrame(call.raf);
  call.mic?.getTracks().forEach((t) => t.stop()); call.mic = null;
  try { call.ac?.close(); } catch (e) { /* ignore */ } call.ac = null;
}
async function applyQuality(call, key) {
  const q = call.q;
  if (key === 'hdVideo') {
    const vt = call.stream?.getVideoTracks()[0];
    if (vt) { try { await vt.applyConstraints({ width: { ideal: q.hdVideo ? 1280 : 640 }, height: { ideal: q.hdVideo ? 720 : 360 } }); } catch (e) { /* keep current */ } updateRes(call); }
  } else if (call.mic) {
    const at = call.mic.getAudioTracks()[0];
    try { await at.applyConstraints(audioConstraints(q)); } catch (e) { /* some browsers need a restart */ }
    const s = at.getSettings?.() || {};
    // Browsers that can't change these on a live track: restart the mic with the new settings
    if ((key === 'noise' && s.noiseSuppression !== undefined && s.noiseSuppression !== q.noise) || (key === 'echo' && s.echoCancellation !== undefined && s.echoCancellation !== q.echo)) { stopMic(call); call.micErr = false; await startMic(call); }
  }
  const names = { hdAudio: 'HD audio', noise: 'Noise cancellation', echo: 'Echo reduction', agc: 'Auto volume', hdVideo: 'HD video' };
  toast(`${names[key]} ${q[key] ? 'on' : 'off'}`);
  if (ui.call === call) renderCall();
}

// ---------- call waiting: someone calls while you're on a call
function scheduleCallWaiting(call) {
  if (call.room || ui.cwDone) return;
  call.cwT = setTimeout(() => {
    if (ui.call !== call || call.state !== 'connected' || call.cw) return;
    const busy = new Set([call.ch.id, call.held?.ch.id]);
    const pickC = S.chats.filter((c) => c.type === 'direct' && !c.secret && !busy.has(c.id) && !contact(c.contactId)?.blocked && !contact(c.contactId)?.business);
    const c = pickC.find((x) => /ananya/i.test(chatTitle(x))) || pickC[0];
    if (!c) return;
    ui.cwDone = true;
    call.cw = c;
    renderCall();
    try { navigator.vibrate?.([200, 100, 200]); } catch (e) { /* ignore */ }
    call.cwMiss = setTimeout(() => { if (call.cw === c) { call.cw = null; logIncomingMissed(c); if (ui.call === call) renderCall(); toast(`Missed call from ${chatTitle(c)}`); } }, 20000);
  }, 12000);
}
function logIncomingMissed(c) {
  S.calls.push({ id: uid(), chatId: c.id, dir: 'in', video: false, t: Date.now(), dur: 0, missed: true });
  save(); if (ui.tab === 'calls') renderSidebar();
}
function answerIncoming(c, held) {
  const nc = { ch: c, video: false, dir: 'in', state: 'connected', start: Date.now(), muted: false, camOff: false, blur: false, stream: null, screen: null, room: null, joined: [], held, q: defaultQuality() };
  ui.call = nc;
  nc.timer = setInterval(() => { const s = $('#call-status'); if (s && ui.call?.start) s.textContent = fmtDur((Date.now() - ui.call.start) / 1000); }, 1000);
  renderCall();
}

// ---------- add people to a call (1:1 → group call, no participant limit)
function addToCallModal() {
  const call = ui.call;
  const picked = new Set();
  const exclude = callPeople(call);
  modal({
    title: 'Add people to this call',
    body: `<div class="search modal-search">${icon('search', 18)}<input id="ac-q" placeholder="Search name or @username" autocomplete="off" autofocus></div><div class="muted small" id="ac-count">No limit on participants</div><div class="pick-list" id="ac-list"></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Call', primary: true, onClick: () => {
      if (!picked.size) { toast('Select at least one person'); return false; }
      const ids = [...picked];
      ids.forEach((id) => ensureContact(id));
      toast(`Ringing ${namesSummary(ids, 3)}…`);
      setTimeout(() => {
        if (ui.call !== call) return;
        call.added = [...(call.added || []), ...ids];
        renderCall();
        toast(`${namesSummary(ids, 3)} joined · this is now a group call`);
      }, 2500);
    } }],
    onMount: (root) => {
      const list = () => { $('#ac-list', root).innerHTML = peoplePickerHTML($('#ac-q', root).value, picked, exclude, 'data-ac'); };
      list();
      $('#ac-q', root).addEventListener('input', list);
      root.addEventListener('change', (e) => { const id = e.target.dataset.ac; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); $('#ac-count', root).textContent = picked.size ? `${picked.size.toLocaleString()} selected` : 'No limit on participants'; });
    },
  });
}

Object.assign(XA, {
  'call-flip'() { flipCamera(); },
  'call-fx'() { const c = ui.call; c.sheet = c.sheet === 'fx' ? null : 'fx'; c.panel = false; renderCall(); },
  'call-setfx'(el) { const c = ui.call; c.fx = el.dataset.fx; c.blur = c.fx === 'blur'; renderCall(); },
  'call-quality'() {
    const c = ui.call; c.q ||= defaultQuality();
    c.sheet = c.sheet === 'quality' ? null : 'quality'; c.panel = false;
    renderCall();
    if (c.sheet === 'quality') startMic(c);
  },
  'call-add'() { addToCallModal(); },
  'call-swap'() {
    const a = ui.call, h = a?.held;
    if (!h) return;
    a.held = null; h.held = a; a.sheet = null;
    ui.call = h; renderCall();
    toast(`${chatTitle(a.ch)} is on hold`);
  },
  'call-cw'(el) {
    const call = ui.call, c = call?.cw;
    if (!c) return;
    clearTimeout(call.cwMiss); call.cw = null;
    const m = el.dataset.m;
    if (m === 'decline') { logIncomingMissed(c); renderCall(); return toast('Call declined'); }
    if (m === 'message') {
      logIncomingMissed(c);
      sendMsg(c, { type: 'text', text: "Sorry, I'm on another call. I'll call you back soon 🙏" });
      renderCall(); return toast(`Message sent to ${chatTitle(c)}`);
    }
    if (m === 'end') { endCall(); answerIncoming(c, null); return toast(`Connected to ${chatTitle(c)}`); }
    // hold & answer
    if (call.held) { toast(`${chatTitle(call.held.ch)} was on hold · ended`); endHeld(call); }
    call.sheet = null; call.panel = false;
    answerIncoming(c, call);
    toast(`${chatTitle(call.ch)} is on hold`);
  },
});
function endHeld(call) {
  const h = call.held; if (!h) return;
  call.held = null;
  const cur = ui.call; ui.call = h; endCall(); ui.call = cur;
}
document.addEventListener('change', (e) => {
  const k = e.target.dataset?.callq;
  if (!k || !ui.call) return;
  ui.call.q[k] = e.target.checked;
  applyQuality(ui.call, k);
});

// Lifecycle: keep mute in sync with the mic track, start call waiting, release devices, resume held calls
const _renderCallX = renderCall;
renderCall = function () {
  _renderCallX();
  const c = ui.call;
  c?.mic?.getAudioTracks().forEach((t) => { t.enabled = !c.muted; });
  const st = $('#mic-state'); if (st && c?.mic) st.textContent = c.muted ? 'You are muted' : 'Speak to see your level';
  const cf = $('#cq-confirm'); if (cf && c) cf.innerHTML = qualityConfirmHTML(c);
};
const _startCallX = startCall;
startCall = async function (ch, video, opts = {}) {
  await _startCallX(ch, video, opts);
  const call = ui.call;
  if (!call || call.room) return;
  call.q ||= defaultQuality();
  const wait = setInterval(() => {
    if (ui.call !== call) return clearInterval(wait);
    if (call.state === 'connected') { clearInterval(wait); scheduleCallWaiting(call); }
  }, 500);
};
const _endCallX = endCall;
endCall = function () {
  const call = ui.call;
  if (!call) return;
  clearTimeout(call.cwT); clearTimeout(call.cwMiss);
  if (call.cw) logIncomingMissed(call.cw);
  stopMic(call);
  const held = call.held;
  _endCallX();
  if (held && !ui.call) {
    held.held = null;
    ui.call = held;
    renderCall();
    toast(`Back on the call with ${chatTitle(held.ch)}`);
  }
};
