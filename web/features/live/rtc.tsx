'use client';
// Real voice and video calls between WHATSMORE accounts (WebRTC), ported from js/rtc.js.
// Audio/video flow directly between the browsers, encrypted end to end by WebRTC (DTLS-SRTP).
// Supabase Realtime only carries the call setup (ring, accept, offer/answer, network candidates)
// on each conversation's channel. Group calls connect every participant to every other one (mesh).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { S, ui, save, refresh, useRender } from '@/lib/state';
import type { Chat } from '@/lib/types';
import { toast } from '@/lib/overlay';
import { chatById, chatTitle, contact, fmtDur, senderName, uid } from '@/lib/util';
import { notify } from '@/lib/actions';
import { overlays } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar } from '@/components/ui/Avatar';
import { startCallHooks } from '@/components/media/hooks';
import { CL, chid, cuid, cloudOn, ensureConvChannels, rtcSignalHooks } from './core';

const RTC_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
interface Peer { uid: string; pc: RTCPeerConnection; stream: MediaStream | null; pendingIce: any[] }
interface Call {
  id: string; ch: Chat; video: boolean; local: MediaStream; peers: Map<string, Peer>; state: 'ringing' | 'connecting' | 'connected';
  outgoing: boolean; facing: 'user' | 'environment'; declined: Set<string>; from?: string; ringT?: any; start?: number; muted?: boolean; camOff?: boolean;
}
interface Incoming { callId: string; ch: Chat; video: boolean; from: string; missT?: any }
export const RT: { call: Call | null; incoming: Incoming | null; tone: { ac: AudioContext; t: any } | null } = { call: null, incoming: null, tone: null };

function rtcSend(ch: Chat, payload: any) {
  const chn = CL.conv.get(ch.sbId!);
  if (!chn) return false;
  chn.send({ type: 'broadcast', event: 'rtc', payload: { ...payload, from: CL.user!.id, name: S.me.name } });
  return true;
}
function rtcMedia(video: boolean, facing = 'user') {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false });
}
const rtcName = (u: string) => senderName(cuid(u));
const demoCallOn = () => !!(ui as any).call;

// ---------- outgoing
async function startRealCall(ch: Chat, video: boolean) {
  if (RT.call || RT.incoming || demoCallOn()) return toast('You are already in a call');
  if (!cloudOn()) return toast('Sign in to call');
  if (!CL.conv.get(ch.sbId!)) { ensureConvChannels(); return toast('Connecting the call line — try again in a moment'); }
  let local: MediaStream;
  try { local = await rtcMedia(video); } catch { return toast(video ? 'Allow camera and microphone access to video call' : 'Allow microphone access to call'); }
  const call: Call = { id: crypto.randomUUID(), ch, video, local, peers: new Map(), state: 'ringing', outgoing: true, facing: 'user', declined: new Set() };
  RT.call = call;
  rtcSend(ch, { type: 'ring', callId: call.id, video });
  refresh();
  call.ringT = setTimeout(() => { if (RT.call === call && !call.peers.size) endRealCall(ch.type === 'direct' ? 'No answer' : 'No one answered'); }, 35000);
}

// ---------- incoming signals
async function onRtcSignal(convId: string, p: any) {
  const ch = chatById(chid(convId));
  if (!ch || !p?.from || p.from === CL.user?.id) return;
  if (p.to && p.to !== CL.user!.id) return;
  const call = RT.call && RT.call.id === p.callId ? RT.call : null;
  switch (p.type) {
    case 'ring': {
      if (RT.call || RT.incoming || demoCallOn()) { rtcSend(ch, { type: 'busy', callId: p.callId, to: p.from }); return; }
      const inc: Incoming = { callId: p.callId, ch, video: !!p.video, from: p.from };
      RT.incoming = inc;
      inc.missT = setTimeout(() => { if (RT.incoming && RT.incoming.callId === p.callId) missIncoming(); }, 40000);
      startTone(); refresh();
      if (document.visibilityState !== 'visible') notify(ch, cuid(p.from), `📞 Incoming ${p.video ? 'video' : 'voice'} call`);
      return;
    }
    case 'cancel':
      { const inc = RT.incoming as Incoming | null; if (inc && inc.callId === p.callId && inc.from === p.from) missIncoming(); }
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
        else refresh();
      }
      return;
  }
}
rtcSignalHooks.push((id, p) => { onRtcSignal(id, p); });

// ---------- peer connections (one per other participant)
async function makePeer(call: Call, u: string, initiator: boolean) {
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE });
  const peer: Peer = { uid: u, pc, stream: null, pendingIce: [] };
  call.peers.set(u, peer);
  call.local.getTracks().forEach((t) => pc.addTrack(t, call.local));
  pc.onicecandidate = (e) => { if (e.candidate) rtcSend(call.ch, { type: 'ice', callId: call.id, to: u, candidate: e.candidate.toJSON() }); };
  pc.ontrack = (e) => { peer.stream = e.streams[0]; if (RT.call === call) refresh(); };
  pc.onconnectionstatechange = () => {
    if (RT.call !== call) return;
    if (pc.connectionState === 'connected') {
      if (call.state !== 'connected') { call.state = 'connected'; call.start = call.start || Date.now(); stopTone(); }
      refresh();
    } else if (pc.connectionState === 'failed') {
      toast(`Couldn't connect to ${rtcName(u)} — their network may block direct calls`);
      dropPeer(call, u);
      if (!call.peers.size) endRealCall('Connection failed'); else refresh();
    }
  };
  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    rtcSend(call.ch, { type: 'offer', callId: call.id, to: u, sdp: { type: offer.type, sdp: offer.sdp } });
  }
  if (call.state === 'ringing') call.state = 'connecting';
  refresh();
  return peer;
}
function flushIce(peer: Peer) { peer.pendingIce.splice(0).forEach((c) => peer.pc.addIceCandidate(c).catch(() => {})); }
function dropPeer(call: Call, u: string) { const p = call.peers.get(u); if (p) { try { p.pc.close(); } catch { /* closed */ } call.peers.delete(u); } }

// ---------- answer / decline / end
async function acceptIncoming(withVideo: boolean) {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  let local: MediaStream;
  try { local = await rtcMedia(withVideo); } catch { toast(withVideo ? 'Allow camera and microphone access to answer' : 'Allow microphone access to answer'); return; }
  RT.incoming = null;
  RT.call = { id: inc.callId, ch: inc.ch, video: withVideo, local, peers: new Map(), state: 'connecting', outgoing: false, facing: 'user', declined: new Set(), from: inc.from };
  rtcSend(inc.ch, { type: 'accept', callId: inc.callId });
  refresh();
}
function declineIncoming() {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  rtcSend(inc.ch, { type: 'decline', callId: inc.callId, to: inc.from });
  logRtc(inc.ch, 'in', inc.video, 0, true);
  RT.incoming = null; refresh();
}
function missIncoming() {
  const inc = RT.incoming;
  if (!inc) return;
  clearTimeout(inc.missT); stopTone();
  logRtc(inc.ch, 'in', inc.video, 0, true);
  RT.incoming = null; refresh();
  toast(`📞 Missed ${inc.video ? 'video' : 'voice'} call from ${rtcName(inc.from)}`);
}
export function endRealCall(reason?: string) {
  const call = RT.call;
  if (!call) return;
  clearTimeout(call.ringT); stopTone();
  rtcSend(call.ch, { type: call.peers.size || !call.outgoing ? 'leave' : 'cancel', callId: call.id });
  call.peers.forEach((p) => { try { p.pc.close(); } catch { /* closed */ } });
  call.local.getTracks().forEach((t) => t.stop());
  const dur = call.start ? Math.round((Date.now() - call.start) / 1000) : 0;
  logRtc(call.ch, call.outgoing ? 'out' : 'in', call.video, dur, !dur);
  RT.call = null; refresh();
  toast(reason || (dur ? 'Call ended · ' + fmtDur(dur) : 'Call cancelled'));
}
function logRtc(ch: Chat, dir: string, video: boolean, dur: number, missed: boolean) {
  S.calls.push({ id: uid(), chatId: ch.id, dir, video, t: Date.now(), dur, missed });
  save();
}

// ---------- in-call controls
function rtcToggleMute() { const c = RT.call; if (!c) return; c.muted = !c.muted; c.local.getAudioTracks().forEach((t) => { t.enabled = !c.muted; }); refresh(); }
async function rtcToggleCam() {
  const c = RT.call; if (!c) return;
  if (!c.local.getVideoTracks().length) {
    // turn a voice call into video: add a camera track and renegotiate with everyone
    let cam: MediaStream; try { cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing } }); } catch { return toast('Allow camera access to turn on video'); }
    const track = cam.getVideoTracks()[0];
    c.local.addTrack(track); c.video = true; c.camOff = false;
    for (const peer of c.peers.values()) {
      peer.pc.addTrack(track, c.local);
      const offer = await peer.pc.createOffer(); await peer.pc.setLocalDescription(offer);
      rtcSend(c.ch, { type: 'offer', callId: c.id, to: peer.uid, sdp: { type: offer.type, sdp: offer.sdp } });
    }
  } else { c.camOff = !c.camOff; c.local.getVideoTracks().forEach((t) => { t.enabled = !c.camOff; }); }
  refresh();
}
async function rtcFlip() {
  const c = RT.call; if (!c?.local.getVideoTracks().length) return;
  c.facing = c.facing === 'user' ? 'environment' : 'user';
  let cam: MediaStream; try { cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing } }); } catch { return toast('Could not switch camera'); }
  const track = cam.getVideoTracks()[0], old = c.local.getVideoTracks()[0];
  for (const peer of c.peers.values()) { const s = peer.pc.getSenders().find((x) => x.track?.kind === 'video'); if (s) await s.replaceTrack(track); }
  c.local.removeTrack(old); old.stop(); c.local.addTrack(track);
  refresh();
}

// ---------- ringtone (best effort: browsers may block sound until the page has been used)
function startTone() {
  stopTone();
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac: AudioContext = new AC();
    const beep = () => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 520; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.35); };
    beep(); RT.tone = { ac, t: setInterval(beep, 1400) };
  } catch { /* no sound */ }
}
function stopTone() { if (RT.tone) { clearInterval(RT.tone.t); try { RT.tone.ac.close(); } catch { /* closed */ } RT.tone = null; } }

// Calls in live chats are real; everything else keeps the demo call screen
startCallHooks.push((ch, video, opts) => {
  if (ch?.cloud && !opts?.room) { startRealCall(ch, video); return true; }
  if (RT.call || RT.incoming) { toast('You are already in a call'); return true; }
  return false;
});

// ---------- screen
const bindStream = (s: MediaStream | null | undefined) => (el: HTMLMediaElement | null) => { if (el && s && el.srcObject !== s) el.srcObject = s; };
function Ticker({ start }: { start: number }) {
  const [secs, set] = useState(0);
  useEffect(() => { const tick = () => set(Math.max(0, (Date.now() - start) / 1000)); tick(); const t = setInterval(tick, 1000); return () => clearInterval(t); }, [start]);
  return <>{fmtDur(secs)}</>;
}
function RtcScreen() {
  useRender();
  useEffect(() => {
    const bye = () => { if (RT.call) endRealCall(); else if (RT.incoming) declineIncoming(); };
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, []);
  if (RT.incoming) {
    const inc = RT.incoming;
    return (
      <div id="rtc" className="call rtc">
        <div className="call-top"><Icon name="lock" size={14} /> Encrypted peer-to-peer call</div>
        <div className="call-stage"><div className="call-hero"><Avatar o={contact(cuid(inc.from)) as any} size={128} /><h2>{rtcName(inc.from)}</h2>
          <div className="call-status">Incoming {inc.video ? 'video' : 'voice'} call{inc.ch.type === 'group' ? ' · ' + chatTitle(inc.ch) : ''}…</div></div></div>
        <div className="call-controls">
          <button className="cbtn end" data-act="rtc-decline" title="Decline" aria-label="Decline" onClick={declineIncoming}><Icon name="callend" /></button>
          {inc.video ? <button className="cbtn" data-act="rtc-accept" data-v="0" title="Answer with voice only" aria-label="Answer with voice only" onClick={() => acceptIncoming(false)}><Icon name="call" /></button> : null}
          <button className="cbtn accept" data-act="rtc-accept" data-v={inc.video ? 1 : 0} title="Answer" aria-label="Answer" onClick={() => acceptIncoming(inc.video)}><Icon name={inc.video ? 'video' : 'call'} /></button>
        </div>
      </div>
    );
  }
  const c = RT.call;
  if (!c) return null;
  const label = c.state === 'ringing' ? (c.outgoing ? 'Ringing…' : 'Joining…') : c.state === 'connecting' ? 'Connecting…' : c.start ? <Ticker start={c.start} /> : '0:00';
  const peers = [...c.peers.values()];
  const hasCam = c.local.getVideoTracks().length > 0;
  const hasLocalVid = hasCam && !c.camOff;
  return (
    <div id="rtc" className="call rtc">
      <div className="call-top"><Icon name="lock" size={14} /> Encrypted peer-to-peer · {chatTitle(c.ch)}</div>
      <div className="call-stage">
        {peers.length ? (
          <div className="call-grid-wrap"><div className="call-title"><span id="rtc-status">{label}</span></div>
            <div className={`call-grid rtc-grid n${Math.min(peers.length, 4)}`}>
              {peers.map((p) => {
                const hasVid = !!p.stream?.getVideoTracks().some((t) => t.readyState === 'live');
                return (
                  <div key={p.uid} className="tile rtc-tile" data-peer={p.uid}>
                    {hasVid ? <video autoPlay playsInline data-remote={p.uid} ref={bindStream(p.stream)} /> : <Avatar o={contact(cuid(p.uid)) as any} size={84} />}
                    <audio autoPlay data-audio={p.uid} ref={hasVid ? undefined : bindStream(p.stream)} /><span>{rtcName(p.uid)}</span>
                  </div>
                );
              })}
            </div></div>
        ) : (
          <div className="call-hero"><ChatAvatar ch={c.ch} size={128} /><h2>{chatTitle(c.ch)}</h2><div className="call-status" id="rtc-status">{label}</div><div className="call-kind">WHATSMORE {c.video ? 'video' : 'voice'} call</div></div>
        )}
        {hasCam ? <div className={`self-view ${c.facing === 'environment' ? 'rear' : ''}`}>{hasLocalVid ? <video id="rtc-self" autoPlay playsInline muted ref={bindStream(c.local)} /> : <div className="self-off">Camera off</div>}<span>You</span></div> : null}
      </div>
      <div className="call-controls">
        <button className={`cbtn ${c.muted ? 'on' : ''}`} data-act="rtc-mute" title={c.muted ? 'Unmute' : 'Mute'} aria-label="Mute" onClick={rtcToggleMute}><Icon name={c.muted ? 'micoff' : 'mic'} /></button>
        <button className={`cbtn ${hasLocalVid ? '' : 'on'}`} data-act="rtc-cam" title="Camera" aria-label="Camera" onClick={rtcToggleCam}><Icon name={hasLocalVid ? 'video' : 'videooff'} /></button>
        {hasCam ? <button className="cbtn" data-act="rtc-flip" title="Switch camera" aria-label="Switch camera" onClick={rtcFlip}><Icon name="flipcam" /></button> : null}
        <button className="cbtn end" data-act="rtc-end" title="End call" aria-label="End call" onClick={() => endRealCall()}><Icon name="callend" /></button>
      </div>
    </div>
  );
}
overlays.rtc = RtcScreen;
