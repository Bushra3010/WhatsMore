// Real voice and video calls between WHATSMORE accounts (WebRTC).
// Audio/video flow directly between the browsers, encrypted end to end by WebRTC (DTLS-SRTP).
// Supabase Realtime only carries the call setup (ring, accept, offer/answer, network candidates)
// on each conversation's channel. Group calls connect every participant to every other one (mesh).
'use strict';
const RTC_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const RT = { call: null, incoming: null, tone: null };

function rtcSend(ch, payload) {
  const chn = CL.conv.get(ch.sbId);
  if (!chn) return false;
  chn.send({ type: 'broadcast', event: 'rtc', payload: { ...payload, from: CL.user.id, name: S.me.name } });
  return true;
}
async function rtcMedia(video, facing = 'user') {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false });
}
const rtcName = (uid) => senderName(cuid(uid));

// ---------- outgoing
async function startRealCall(ch, video) {
  if (RT.call || RT.incoming || ui.call) return toast('You are already in a call');
  if (!cloudOn()) return toast('Sign in to call');
  if (!CL.conv.get(ch.sbId)) { ensureConvChannels(); return toast('Connecting the call line — try again in a moment'); }
  let local;
  try { local = await rtcMedia(video); } catch (e) { return toast(video ? 'Allow camera and microphone access to video call' : 'Allow microphone access to call'); }
  RT.call = { id: crypto.randomUUID(), ch, video, local, peers: new Map(), state: 'ringing', outgoing: true, facing: 'user', declined: new Set() };
  rtcSend(ch, { type: 'ring', callId: RT.call.id, video });
  renderRtc();
  const call = RT.call;
  call.ringT = setTimeout(() => { if (RT.call === call && !call.peers.size) endRealCall(ch.type === 'direct' ? 'No answer' : 'No one answered'); }, 35000);
}

// ---------- incoming signals
async function onRtcSignal(convId, p) {
  const ch = chatById(chid(convId));
  if (!ch || !p?.from || p.from === CL.user?.id) return;
  if (p.to && p.to !== CL.user.id) return;
  const call = RT.call && RT.call.id === p.callId ? RT.call : null;
  switch (p.type) {
    case 'ring':
      if (RT.call || RT.incoming || ui.call) { rtcSend(ch, { type: 'busy', callId: p.callId, to: p.from }); return; }
      RT.incoming = { callId: p.callId, ch, video: !!p.video, from: p.from };
      RT.incoming.missT = setTimeout(() => { if (RT.incoming?.callId === p.callId) missIncoming(); }, 40000);
      startTone(); renderRtc();
      if (document.visibilityState !== 'visible') notify(ch, cuid(p.from), `📞 Incoming ${p.video ? 'video' : 'voice'} call`);
      return;
    case 'cancel':
      if (RT.incoming?.callId === p.callId && RT.incoming.from === p.from) missIncoming();
      return;
    case 'accept':
      if (call && !call.peers.has(p.from)) { clearTimeout(call.ringT); await makePeer(call, p.from, true); }
      return;
    case 'offer':
      if (call) {
        const peer = call.peers.get(p.from) || await makePeer(call, p.from, false);
        await peer.pc.setRemoteDescription(p.sdp);
        flushIce(peer);
        const ans = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(ans);
        rtcSend(ch, { type: 'answer', callId: call.id, to: p.from, sdp: { type: ans.type, sdp: ans.sdp } });
      }
      return;
    case 'answer':
      if (call) { const peer = call.peers.get(p.from); if (peer) { await peer.pc.setRemoteDescription(p.sdp); flushIce(peer); } }
      return;
    case 'ice':
      if (call) {
        const peer = call.peers.get(p.from);
        if (!peer) return;
        if (peer.pc.remoteDescription) peer.pc.addIceCandidate(p.candidate).catch(() => {});
        else peer.pendingIce.push(p.candidate);
      }
      return;
    case 'decline':
    case 'busy':
      if (call && call.outgoing) {
        call.declined.add(p.from);
        if (ch.type === 'direct') endRealCall(p.type === 'busy' ? `${rtcName(p.from)} is on another call` : `${rtcName(p.from)} declined`);
        else toast(`${rtcName(p.from)} ${p.type === 'busy' ? 'is busy' : 'declined'}`);
      }
      return;
    case 'leave':
      if (call) {
        dropPeer(call, p.from);
        toast(`${rtcName(p.from)} left the call`);
        if (!call.peers.size && (ch.type === 'direct' || call.state === 'connected')) endRealCall('Call ended');
        else renderRtc();
      }
      return;
  }
}

// ---------- peer connections (one per other participant)
async function makePeer(call, uid, initiator) {
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE });
  const peer = { uid, pc, stream: null, pendingIce: [] };
  call.peers.set(uid, peer);
  call.local.getTracks().forEach((t) => pc.addTrack(t, call.local));
  pc.onicecandidate = (e) => { if (e.candidate) rtcSend(call.ch, { type: 'ice', callId: call.id, to: uid, candidate: e.candidate.toJSON() }); };
  pc.ontrack = (e) => { peer.stream = e.streams[0]; if (RT.call === call) renderRtc(); };
  pc.onconnectionstatechange = () => {
    if (RT.call !== call) return;
    if (pc.connectionState === 'connected') {
      if (call.state !== 'connected') { call.state = 'connected'; call.start = call.start || Date.now(); stopTone(); }
      renderRtc();
    } else if (pc.connectionState === 'failed') {
      toast(`Couldn't connect to ${rtcName(uid)} — their network may block direct calls`);
      dropPeer(call, uid);
      if (!call.peers.size) endRealCall('Connection failed'); else renderRtc();
    }
  };
  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    rtcSend(call.ch, { type: 'offer', callId: call.id, to: uid, sdp: { type: offer.type, sdp: offer.sdp } });
  }
  if (call.state === 'ringing') call.state = 'connecting';
  renderRtc();
  return peer;
}
function flushIce(peer) { peer.pendingIce.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {})); }
function dropPeer(call, uid) { const p = call.peers.get(uid); if (p) { try { p.pc.close(); } catch (e) { /* closed */ } call.peers.delete(uid); } }

// ---------- answer / decline / end
async function acceptIncoming(withVideo) {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  let local;
  try { local = await rtcMedia(withVideo); } catch (e) { toast(withVideo ? 'Allow camera and microphone access to answer' : 'Allow microphone access to answer'); return; }
  RT.incoming = null;
  RT.call = { id: inc.callId, ch: inc.ch, video: withVideo, local, peers: new Map(), state: 'connecting', outgoing: false, facing: 'user', declined: new Set(), from: inc.from };
  rtcSend(inc.ch, { type: 'accept', callId: inc.callId });
  renderRtc();
}
function declineIncoming() {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  rtcSend(inc.ch, { type: 'decline', callId: inc.callId, to: inc.from });
  logRtc(inc.ch, 'in', inc.video, 0, true);
  RT.incoming = null; renderRtc();
}
function missIncoming() {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  logRtc(inc.ch, 'in', inc.video, 0, true);
  RT.incoming = null; renderRtc();
  toast(`📞 Missed ${inc.video ? 'video' : 'voice'} call from ${rtcName(inc.from)}`);
}
function endRealCall(reason) {
  const call = RT.call;
  if (!call) return;
  clearTimeout(call.ringT); clearInterval(call.timer); stopTone();
  rtcSend(call.ch, { type: call.peers.size || !call.outgoing ? 'leave' : 'cancel', callId: call.id });
  call.peers.forEach((p) => { try { p.pc.close(); } catch (e) { /* closed */ } });
  call.local.getTracks().forEach((t) => t.stop());
  const dur = call.start ? Math.round((Date.now() - call.start) / 1000) : 0;
  logRtc(call.ch, call.outgoing ? 'out' : 'in', call.video, dur, !dur);
  RT.call = null; renderRtc();
  toast(reason || (dur ? 'Call ended · ' + fmtDur(dur) : 'Call cancelled'));
}
function logRtc(ch, dir, video, dur, missed) {
  S.calls.push({ id: uid(), chatId: ch.id, dir, video, t: Date.now(), dur, missed });
  save();
  if (ui.tab === 'calls') renderSidebar();
}

// ---------- in-call controls
function rtcToggleMute() { const c = RT.call; if (!c) return; c.muted = !c.muted; c.local.getAudioTracks().forEach((t) => { t.enabled = !c.muted; }); renderRtc(); }
async function rtcToggleCam() {
  const c = RT.call; if (!c) return;
  if (!c.local.getVideoTracks().length) {
    // turn a voice call into video: add a camera track and renegotiate with everyone
    let cam; try { cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing } }); } catch (e) { return toast('Allow camera access to turn on video'); }
    const track = cam.getVideoTracks()[0];
    c.local.addTrack(track); c.video = true; c.camOff = false;
    for (const peer of c.peers.values()) {
      peer.pc.addTrack(track, c.local);
      const offer = await peer.pc.createOffer(); await peer.pc.setLocalDescription(offer);
      rtcSend(c.ch, { type: 'offer', callId: c.id, to: peer.uid, sdp: { type: offer.type, sdp: offer.sdp } });
    }
  } else { c.camOff = !c.camOff; c.local.getVideoTracks().forEach((t) => { t.enabled = !c.camOff; }); }
  renderRtc();
}
async function rtcFlip() {
  const c = RT.call; if (!c?.local.getVideoTracks().length) return;
  c.facing = c.facing === 'user' ? 'environment' : 'user';
  let cam; try { cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing } }); } catch (e) { return toast('Could not switch camera'); }
  const track = cam.getVideoTracks()[0], old = c.local.getVideoTracks()[0];
  for (const peer of c.peers.values()) { const s = peer.pc.getSenders().find((x) => x.track?.kind === 'video'); if (s) await s.replaceTrack(track); }
  c.local.removeTrack(old); old.stop(); c.local.addTrack(track);
  renderRtc();
}

// ---------- ringtone (best effort: browsers may block sound until the page has been used)
function startTone() {
  stopTone();
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 520; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.35); };
    beep(); RT.tone = { ac, t: setInterval(beep, 1400) };
  } catch (e) { /* no sound */ }
}
function stopTone() { if (RT.tone) { clearInterval(RT.tone.t); try { RT.tone.ac.close(); } catch (e) { /* closed */ } RT.tone = null; } }

// ---------- screen
function renderRtc() {
  let el = $('#rtc');
  if (!RT.call && !RT.incoming) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'rtc'; el.className = 'call rtc'; overlayRoot.appendChild(el); }
  if (RT.incoming) {
    const inc = RT.incoming;
    el.innerHTML = `<div class="call-top">${icon('lock', 14)} Encrypted peer-to-peer call</div>
      <div class="call-stage"><div class="call-hero">${avatarHTML(contact(cuid(inc.from)), 128)}<h2>${esc(rtcName(inc.from))}</h2>
      <div class="call-status">Incoming ${inc.video ? 'video' : 'voice'} call${inc.ch.type === 'group' ? ' · ' + esc(chatTitle(inc.ch)) : ''}…</div></div></div>
      <div class="call-controls"><button class="cbtn end" data-act="rtc-decline" title="Decline" aria-label="Decline">${icon('callend')}</button>
      ${inc.video ? `<button class="cbtn" data-act="rtc-accept" data-v="0" title="Answer with voice only" aria-label="Answer with voice only">${icon('call')}</button>` : ''}
      <button class="cbtn accept" data-act="rtc-accept" data-v="${inc.video ? 1 : 0}" title="Answer" aria-label="Answer">${icon(inc.video ? 'video' : 'call')}</button></div>`;
    return;
  }
  const c = RT.call;
  const label = { ringing: c.outgoing ? 'Ringing…' : 'Joining…', connecting: 'Connecting…', connected: c.start ? fmtDur((Date.now() - c.start) / 1000) : '0:00' }[c.state];
  const peers = [...c.peers.values()];
  const tiles = peers.map((p) => {
    const hasVid = p.stream?.getVideoTracks().some((t) => t.readyState === 'live');
    return `<div class="tile rtc-tile" data-peer="${p.uid}">${hasVid ? `<video autoplay playsinline data-remote="${p.uid}"></video>` : avatarHTML(contact(cuid(p.uid)), 84)}<audio autoplay data-audio="${p.uid}"></audio><span>${esc(rtcName(p.uid))}</span></div>`;
  }).join('');
  const hasLocalVid = c.local.getVideoTracks().length && !c.camOff;
  el.innerHTML = `<div class="call-top">${icon('lock', 14)} Encrypted peer-to-peer · ${esc(chatTitle(c.ch))}</div>
    <div class="call-stage">
      ${peers.length ? `<div class="call-grid-wrap"><div class="call-title"><span id="rtc-status">${label}</span></div><div class="call-grid rtc-grid n${Math.min(peers.length, 4)}">${tiles}</div></div>`
        : `<div class="call-hero">${chatAvatar(c.ch, 128)}<h2>${esc(chatTitle(c.ch))}</h2><div class="call-status" id="rtc-status">${label}</div><div class="call-kind">WHATSMORE ${c.video ? 'video' : 'voice'} call</div></div>`}
      ${c.local.getVideoTracks().length ? `<div class="self-view ${c.facing === 'environment' ? 'rear' : ''}">${hasLocalVid ? '<video id="rtc-self" autoplay playsinline muted></video>' : '<div class="self-off">Camera off</div>'}<span>You</span></div>` : ''}
    </div>
    <div class="call-controls">
      <button class="cbtn ${c.muted ? 'on' : ''}" data-act="rtc-mute" title="${c.muted ? 'Unmute' : 'Mute'}" aria-label="Mute">${icon(c.muted ? 'micoff' : 'mic')}</button>
      <button class="cbtn ${hasLocalVid ? '' : 'on'}" data-act="rtc-cam" title="Camera" aria-label="Camera">${icon(hasLocalVid ? 'video' : 'videooff')}</button>
      ${c.local.getVideoTracks().length ? `<button class="cbtn" data-act="rtc-flip" title="Switch camera" aria-label="Switch camera">${icon('flipcam')}</button>` : ''}
      <button class="cbtn end" data-act="rtc-end" title="End call" aria-label="End call">${icon('callend')}</button>
    </div>`;
  const self = $('#rtc-self'); if (self) self.srcObject = c.local;
  peers.forEach((p) => {
    if (!p.stream) return;
    const v = el.querySelector(`[data-remote="${p.uid}"]`); if (v) v.srcObject = p.stream;
    const a = el.querySelector(`[data-audio="${p.uid}"]`); if (a && !v) a.srcObject = p.stream;
  });
  clearInterval(c.timer);
  if (c.state === 'connected') c.timer = setInterval(() => { const s = $('#rtc-status'); if (s && RT.call === c && c.start) s.textContent = fmtDur((Date.now() - c.start) / 1000); }, 1000);
}
Object.assign(XA, {
  'rtc-accept'(el) { acceptIncoming(el.dataset.v === '1'); },
  'rtc-decline'() { declineIncoming(); },
  'rtc-end'() { endRealCall(); },
  'rtc-mute'() { rtcToggleMute(); },
  'rtc-cam'() { rtcToggleCam(); },
  'rtc-flip'() { rtcFlip(); },
});
// Calls in live chats are real; everything else keeps the demo call screen
const _startCallRtc = startCall;
startCall = async function (ch, video, opts = {}) {
  if (ch?.cloud && !opts.room) return startRealCall(ch, video);
  if (RT.call || RT.incoming) return toast('You are already in a call');
  return _startCallRtc(ch, video, opts);
};
window.addEventListener('beforeunload', () => { if (RT.call) endRealCall(); else if (RT.incoming) declineIncoming(); });
