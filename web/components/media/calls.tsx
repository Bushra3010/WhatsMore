'use client';
// Demo calls: the call screen, Calls tab, call links and meeting scheduling. Ported from
// js/overlays.js (startCall/renderCall/endCall/getCam/screen share), js/callsplus.js (captions,
// consent recording, participants panel, knocking, meetings), js/callsx.js (switch camera, virtual
// backgrounds, quality panel, call waiting, add people) and js/superapp.js (meeting chat + summary).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { S, commit, useRender } from '@/lib/state';
import { modal, toast, copyText } from '@/lib/overlay';
import {
  uid, pick, DAY, HOUR, MIN, contact, person, chatById, chatTitle, senderName, isAdmin, lastTime, fmtDur, fmtTime,
  dayLabel, callTime, ensureContact, namesSummary,
} from '@/lib/util';
import { sendMsg, openChat } from '@/lib/actions';
import { translateSentences } from '@/lib/translate';
import type { Chat, Dict } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar, ChatAvatar } from '@/components/ui/Avatar';
import { Note } from '@/components/ui/Bits';
import { M, bump, useMedia, logNotif, PeopleList, chatPicker, nowMs } from './shared';
import { startCallHooks } from './hooks';

type Call = Dict;
/** The current call (read in components through a plain function so handlers may mutate it). */
const cur = (): Call => M.call as Call;

// ---------- constants
const CC_SCRIPT = [
  { en: 'Can everyone hear me clearly?', te: 'అందరికీ నా మాట స్పష్టంగా వినిపిస్తుందా?', hi: 'क्या सबको मेरी आवाज़ साफ़ सुनाई दे रही है?' },
  { en: "Let's start with the demo updates.", te: 'డెమో అప్‌డేట్‌లతో మొదలుపెడదాం.', hi: 'चलिए डेमो अपडेट से शुरू करते हैं।' },
  { en: 'The payment flow is ready for testing.', te: 'పేమెంట్ ఫ్లో టెస్టింగ్‌కి సిద్ధంగా ఉంది.', hi: 'पेमेंट फ़्लो टेस्टिंग के लिए तैयार है।' },
  { en: 'Please share your feedback by Friday.', te: 'దయచేసి శుక్రవారం లోపు మీ అభిప్రాయం పంపండి.', hi: 'कृपया शुक्रवार तक अपनी राय भेजें।' },
  { en: 'Great, thank you everyone!', te: 'చాలా బాగుంది, అందరికీ ధన్యవాదాలు!', hi: 'बहुत बढ़िया, सभी को धन्यवाद!' },
];
const CC_LANGS: [string, string][] = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी']];
const CALL_FX: [string, string, string][] = [
  ['none', 'None', '🚫'], ['blur', 'Blur', '💧'], ['office', 'Office', '🏢'], ['beach', 'Beach', '🏖️'],
  ['library', 'Library', '📚'], ['space', 'Space', '🌌'], ['sunset', 'Sunset', '🌅'], ['brand', 'WHATSMORE', '💚'],
];
const Q_NAMES: Record<string, string> = { hdAudio: 'HD audio', noise: 'Noise cancellation', echo: 'Echo reduction', agc: 'Auto volume', hdVideo: 'HD video' };

export const callPeople = (call: Call): string[] => (call.room ? call.joined : call.ch?.type === 'group' ? call.ch.members || [] : call.ch ? [call.ch.contactId, ...(call.added || [])] : []).filter((id: string) => !(call.removed || []).includes(id));
const isHost = (call: Call) => !!call.room || (call.ch?.type === 'group' ? isAdmin(call.ch) : true);
const fxOf = (call: Call) => call.fx || (call.blur ? 'blur' : 'none');
const defaultQuality = () => ({ hdAudio: true, noise: true, echo: true, agc: true, hdVideo: true });
const audioConstraints = (q: Dict) => ({ noiseSuppression: q.noise, echoCancellation: q.echo, autoGainControl: q.agc, sampleRate: q.hdAudio ? 48000 : 16000, channelCount: 1 });
const who = (id: string) => contact(id) || person(id);

/** Re-render the call screen (renderCall). Keeps the mic track in sync with mute, like callsx.js. */
export function renderCall() {
  const c = M.call;
  c?.mic?.getAudioTracks().forEach((t: MediaStreamTrack) => { t.enabled = !c.muted; });
  bump();
}

// ---------- lifecycle
export async function startCall(ch: Chat | null, video: boolean, opts: { room?: string } = {}) {
  for (const h of startCallHooks) if (h(ch, video, opts)) return;
  if (M.call) return toast('You are already in a call');
  if (ch?.type === 'direct' && contact(ch.contactId)?.blocked) return toast('Unblock this contact to call them');
  const call: Call = M.call = { ch, video, state: 'calling', start: null, muted: false, camOff: false, blur: false, stream: null, screen: null, room: opts.room || null, joined: [] };
  if (call.room) call.waitingRoom = true; // rooms start with a waiting room (callsplus)
  else call.q = defaultQuality(); // callsx
  renderCall();
  if (video) await getCam(call);
  call.ringT = setTimeout(() => {
    if (M.call !== call) return;
    call.state = call.room ? 'waiting' : 'ringing';
    renderCall();
    call.ansT = setTimeout(() => {
      if (M.call !== call) return;
      call.state = 'connected';
      call.start = Date.now();
      renderCall();
      call.timer = setInterval(() => { if (M.call?.start) bump(); }, 1000);
      if (!call.room) scheduleCallWaiting(call);
    }, call.room ? 3500 : 2400);
  }, 1200);
}

export function endCall() {
  const call = M.call;
  if (!call) return;
  // superapp.js: meeting summary needs these before the call is torn down
  const secs = call.start ? Math.round((Date.now() - call.start) / 1000) : 0;
  const multi = call.room || callPeople(call).length > 1;
  // callsx.js
  clearTimeout(call.cwT); clearTimeout(call.cwMiss);
  if (call.cw) logIncomingMissed(call.cw);
  stopMic(call);
  const held = call.held;
  // callsplus.js
  stopCC(call);
  const recMs = (call.recDur || 0) + (call.rec ? Date.now() - call.rec.start : 0);
  // overlays.js
  clearTimeout(call.ringT); clearTimeout(call.ansT); clearInterval(call.timer);
  call.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  call.screen?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  M.call = null;
  renderCall();
  if (call.ch) {
    const dur = call.start ? Math.round((Date.now() - call.start) / 1000) : 0;
    S.calls.push({ id: uid(), chatId: call.ch.id, dir: call.dir || 'out', video: call.video, t: Date.now(), dur, missed: !dur });
    sendMsg(call.ch, { type: 'call', video: call.video, dur, missed: !dur });
  }
  toast(call.start ? 'Call ended · ' + fmtDur((Date.now() - call.start) / 1000) : 'Call cancelled');
  // callsplus.js: consent recording saved to the chat
  if (recMs > 1000 && call.ch) {
    const s = Math.round(recMs / 1000), d = new Date(), p = (n: number) => String(n).padStart(2, '0');
    sendMsg(call.ch, { type: 'doc', name: `Call_recording_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.m4a`, ext: 'm4a', size: s * 16000, caption: `🔴 Call recording · ${fmtDur(s)} · all participants consented` });
  }
  // callsx.js: resume a held call
  if (held && !M.call) {
    held.held = null;
    M.call = held;
    renderCall();
    toast(`Back on the call with ${chatTitle(held.ch)}`);
  }
  // superapp.js: AI meeting summary
  if (!multi || secs < 10) return;
  const text = meetingSummaryText(call, secs);
  if (call.ch) setTimeout(() => { sendMsg(call.ch, { type: 'text', text }); toast('📝 Meeting summary posted to the chat'); }, 400);
  else setTimeout(() => modal({ title: 'Meeting summary', body: <pre className="meet-sum">{text}</pre>, actions: [{ label: 'Copy', onClick: () => { copyText(text); return false; } }, { label: 'Done', primary: true }] }), 400);
  logNotif('calls', 'Meeting summary ready', `${fmtDur(secs)} · ${callPeople(call).length + 1} people`);
}

// ---------- camera, screen
async function listCams() { try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch { return []; } }
function updateRes(call: Call) { const s = call.stream?.getVideoTracks()[0]?.getSettings?.(); call.res = s?.height ? (s.height >= 720 ? 'HD ' : '') + s.height + 'p' : ''; }
export async function getCam(call: Call) {
  call.q ||= defaultQuality();
  const video: MediaTrackConstraints = { width: { ideal: call.q.hdVideo ? 1280 : 640 }, height: { ideal: call.q.hdVideo ? 720 : 360 } };
  if (call.camId) video.deviceId = { exact: call.camId }; else video.facingMode = call.facing || 'user';
  call.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  try { call.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); call.camErr = false; }
  catch { call.stream = null; call.camErr = true; }
  updateRes(call);
  if (M.call === call || M.call?.held === call) renderCall(); else call.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
}
async function flipCamera() {
  const call = M.call;
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
async function toggleScreen() {
  const call = M.call;
  if (!call) return;
  if (call.screen) { call.screen.getTracks().forEach((t: MediaStreamTrack) => t.stop()); call.screen = null; return renderCall(); }
  try {
    call.screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    call.screen.getVideoTracks()[0].onended = () => { if (M.call === call) { call.screen = null; renderCall(); } };
    renderCall();
  } catch { toast('Screen sharing was cancelled or is unavailable'); }
}
async function toggleCam() {
  const c = M.call; if (!c) return;
  if (!c.video) { c.video = true; c.camOff = false; renderCall(); await getCam(c); }
  else { c.camOff = !c.camOff; if (!c.camOff && !c.stream) await getCam(c); renderCall(); }
}

// ---------- microphone: HD audio, noise cancellation, echo reduction (real getUserMedia constraints)
async function startMic(call: Call) {
  if (call.mic || call.micErr) return;
  try {
    call.mic = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(call.q) });
    if (M.call !== call && M.call?.held !== call) return stopMic(call);
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      call.ac = new AC();
      const an = call.ac.createAnalyser(); an.fftSize = 512;
      call.ac.createMediaStreamSource(call.mic).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!call.mic) return;
        an.getByteTimeDomainData(buf);
        let peak = 0; for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
        const bar = document.getElementById('mic-level'); if (bar && M.call === call) bar.style.width = (call.muted ? 0 : Math.min(100, peak * 1.6)) + '%';
        call.raf = requestAnimationFrame(tick);
      };
      tick();
    }
  } catch { call.micErr = true; }
  if (M.call === call) renderCall();
}
function stopMic(call: Call) {
  cancelAnimationFrame(call.raf);
  call.mic?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); call.mic = null;
  try { call.ac?.close(); } catch { /* ignore */ }
  call.ac = null;
}
async function applyQuality(call: Call, key: string) {
  const q = call.q;
  if (key === 'hdVideo') {
    const vt = call.stream?.getVideoTracks()[0];
    if (vt) { try { await vt.applyConstraints({ width: { ideal: q.hdVideo ? 1280 : 640 }, height: { ideal: q.hdVideo ? 720 : 360 } }); } catch { /* keep current */ } updateRes(call); }
  } else if (call.mic) {
    const at = call.mic.getAudioTracks()[0];
    try { await at.applyConstraints(audioConstraints(q)); } catch { /* some browsers need a restart */ }
    const s = at.getSettings?.() || {};
    // Browsers that can't change these on a live track: restart the mic with the new settings
    if ((key === 'noise' && s.noiseSuppression !== undefined && s.noiseSuppression !== q.noise) || (key === 'echo' && s.echoCancellation !== undefined && s.echoCancellation !== q.echo)) { stopMic(call); call.micErr = false; await startMic(call); }
  }
  toast(`${Q_NAMES[key]} ${q[key] ? 'on' : 'off'}`);
  if (M.call === call) renderCall();
}

// ---------- live captions + translation
function startCC(call: Call) {
  call.ccLines = call.ccLines || [];
  call.ccLang = call.ccLang || 'en';
  let i = 0;
  clearInterval(call.ccT);
  call.ccT = setInterval(() => {
    if (M.call !== call || !call.cc) return clearInterval(call.ccT);
    if (call.state !== 'connected') return;
    const people = callPeople(call);
    const w = people.length ? senderName(people[i % people.length]).split(' ')[0] : 'Guest';
    call.ccLines.push({ who: w, text: CC_SCRIPT[i % CC_SCRIPT.length] });
    i++; bump();
  }, 3200);
  // Your own speech, when the browser supports it
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SR && !call.muted) {
    try {
      const r = call.sr = new SR();
      r.lang = 'en-IN'; r.continuous = true; r.interimResults = false;
      r.onresult = (e: any) => {
        const t = e.results[e.results.length - 1][0].transcript.trim();
        if (t) { const te = translateSentences(t, 'te'), hi = translateSentences(t, 'hi'); call.ccLines.push({ who: 'You', text: { en: t, te: te || t, hi: hi || t } }); bump(); }
      };
      r.onerror = () => {};
      r.start();
    } catch { /* captions still show other speakers */ }
  }
}
function stopCC(call: Call) { clearInterval(call.ccT); try { call.sr?.stop(); } catch { /* ignore */ } call.sr = null; }

// ---------- call waiting
function scheduleCallWaiting(call: Call) {
  if (call.room || M.cwDone) return;
  call.cwT = setTimeout(() => {
    if (M.call !== call || call.state !== 'connected' || call.cw) return;
    const busy = new Set([call.ch.id, call.held?.ch.id]);
    const pickC = S.chats.filter((c) => c.type === 'direct' && !c.secret && !c.cloud && !busy.has(c.id) && !contact(c.contactId)?.blocked && !contact(c.contactId)?.business);
    const c = pickC.find((x) => /ananya/i.test(chatTitle(x))) || pickC[0];
    if (!c) return;
    M.cwDone = true;
    call.cw = c;
    renderCall();
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
    call.cwMiss = setTimeout(() => { if (call.cw === c) { call.cw = null; logIncomingMissed(c); if (M.call === call) renderCall(); toast(`Missed call from ${chatTitle(c)}`); } }, 20000);
  }, 12000);
}
function logIncomingMissed(c: Chat) {
  S.calls.push({ id: uid(), chatId: c.id, dir: 'in', video: false, t: Date.now(), dur: 0, missed: true });
  commit();
}
function answerIncoming(c: Chat, held: Call | null) {
  const nc: Call = { ch: c, video: false, dir: 'in', state: 'connected', start: Date.now(), muted: false, camOff: false, blur: false, stream: null, screen: null, room: null, joined: [], held, q: defaultQuality() };
  M.call = nc;
  nc.timer = setInterval(() => { if (M.call?.start) bump(); }, 1000);
  renderCall();
}
function endHeld(call: Call) {
  const h = call.held; if (!h) return;
  call.held = null;
  const cur = M.call; M.call = h; endCall(); M.call = cur;
}
function callWaitingAction(m: string) {
  const call = M.call, c = call?.cw;
  if (!call || !c) return;
  clearTimeout(call.cwMiss); call.cw = null;
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
}
function swapCall() {
  const a = M.call, h = a?.held;
  if (!a || !h) return;
  a.held = null; h.held = a; a.sheet = null;
  M.call = h; renderCall();
  toast(`${chatTitle(a.ch)} is on hold`);
}

// ---------- add people (1:1 → group call, no participant limit)
function addToCallModal() {
  const call = M.call; if (!call) return;
  const picked = new Set<string>();
  const exclude = callPeople(call);
  function Body() {
    const [q, setQ] = useState('');
    const [n, setN] = useState(0);
    return (
      <>
        <div className="search modal-search"><Icon name="search" size={18} /><input id="ac-q" placeholder="Search name or @username" autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="muted small" id="ac-count">{n ? `${n.toLocaleString()} selected` : 'No limit on participants'}</div>
        <div className="pick-list" id="ac-list"><PeopleList key={q} q={q} picked={picked} exclude={exclude} attr="data-ac" onToggle={(id, on) => { if (on) picked.add(id); else picked.delete(id); setN(picked.size); }} /></div>
      </>
    );
  }
  modal({
    title: 'Add people to this call',
    body: <Body />,
    actions: [{ label: 'Cancel' }, {
      label: 'Call', primary: true, onClick: () => {
        if (!picked.size) { toast('Select at least one person'); return false; }
        const ids = [...picked];
        ids.forEach((id) => ensureContact(id));
        toast(`Ringing ${namesSummary(ids, 3)}…`);
        setTimeout(() => {
          if (M.call !== call) return;
          call.added = [...(call.added || []), ...ids];
          renderCall();
          toast(`${namesSummary(ids, 3)} joined · this is now a group call`);
        }, 2500);
      },
    }],
  });
}

// ---------- consent recording
function toggleRecording() {
  const c = M.call; if (!c) return;
  if (c.rec) { c.recDur = (c.recDur || 0) + (Date.now() - c.rec.start); c.rec = null; renderCall(); return toast('Recording stopped · saved when the call ends'); }
  modal({
    title: 'Record this call?',
    body: <><p className="muted">Everyone in the call will be asked for consent. Recording starts only if all participants agree, and a REC banner stays visible to everyone.</p><Note ic="shield">Call recording laws differ by country. WHATSMORE always asks first and never records silently.</Note></>,
    actions: [{ label: 'Cancel' }, {
      label: 'Ask everyone', primary: true, onClick: () => {
        toast('Asking participants for consent…', null, { ms: 1500 });
        setTimeout(() => { if (M.call !== c) return; c.rec = { start: Date.now() }; renderCall(); const n = callPeople(c).length; toast(`All ${n || 1} participant${n === 1 ? '' : 's'} agreed · recording`); }, 1600);
      },
    }],
  });
}

// ---------- meeting chat + summary (superapp.js)
function sendMeetingChat(text: string) {
  const c = M.call;
  if (!c || !text) return;
  (c.chatLog ||= []).push({ who: 'You', text, t: Date.now() });
  renderCall();
  const people = callPeople(c);
  if (people.length) setTimeout(() => {
    if (M.call !== c) return;
    const w = senderName(people[Math.floor(Math.random() * people.length)]).split(' ')[0];
    c.chatLog.push({ who: w, text: pick(['👍 Got it', 'Agreed', 'Can you share the link here?', 'Noted, thanks!', 'I will send the file after the call']), t: Date.now() });
    if (c.sheet !== 'chat') c.chatUnread = (c.chatUnread || 0) + 1;
    renderCall();
  }, 1800);
}
function meetingSummaryText(call: Call, secs: number) {
  const people = callPeople(call).map((id) => senderName(id).split(' ')[0]);
  const lines: string[] = (call.ccLines || []).map((l: Dict) => l.text.en);
  const said = [...new Set(lines)].slice(0, 4);
  const actions = lines.filter((t) => /please|by friday|share|send|ready/i.test(t)).slice(0, 3);
  const chat = (call.chatLog || []).filter((x: Dict) => /share|send|file|link/i.test(x.text));
  return ['📝 Meeting summary (AI)', `⏱ ${fmtDur(secs)} · 👥 You${people.length ? ', ' + people.slice(0, 6).join(', ') + (people.length > 6 ? ` +${people.length - 6}` : '') : ''}`,
    said.length ? '• Discussed: ' + said.join(' · ') : '• Discussed: live captions were off, so only the chat and attendance are summarised',
    actions.length || chat.length ? '✅ Action items: ' + [...actions, ...chat.map((x: Dict) => `${x.who}: ${x.text}`)].slice(0, 4).join(' · ') : '✅ Action items: none recorded',
    `💬 ${(call.chatLog || []).length} chat message(s)${call.recDur || call.rec ? ' · 🔴 recording saved' : ''}`].join('\n');
}

// ---------- call screen
const toggle = (k: string, val?: unknown) => { const c = M.call; if (!c) return; c[k] = val === undefined ? !c[k] : val; renderCall(); };
const toggleSheet = (s: string) => { const c = M.call; if (!c) return; c.sheet = c.sheet === s ? null : s; c.panel = false; renderCall(); };

function Video({ stream, id }: { stream: MediaStream; id: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video id={id} ref={ref} autoPlay playsInline muted />;
}

function CcLines() {
  const call = cur();
  const lines = (call.ccLines || []).slice(-3);
  if (!lines.length) return <div className="cc-line muted">Live captions on · {CC_LANGS.find((l) => l[0] === call.ccLang)?.[1]} — waiting for speech…</div>;
  return (
    <>
      {lines.map((l: Dict, i: number) => <div key={i} className="cc-line"><b>{l.who}:</b> {l.text[call.ccLang] || l.text.en}</div>)}
      {call.ccLang !== 'en' ? <div className="cc-note"><Icon name="translate" size={12} /> Translated live · original kept</div> : null}
    </>
  );
}

function ParticipantsPanel() {
  const call = cur();
  const host = isHost(call);
  const people = callPeople(call);
  return (
    <div className="call-panel" role="dialog" aria-label="Participants">
      <div className="row-between"><b>Participants ({(people.length + 1).toLocaleString()})</b><button className="icon-btn sm light" data-act="call-people" aria-label="Close" onClick={() => toggle('panel')}><Icon name="close" size={18} /></button></div>
      {host ? (
        <div className="cp-tools">
          <button className="btn sm" data-act="call-muteall" onClick={() => { const c = cur(); c.mutedIds = callPeople(c).slice(); renderCall(); toast('Everyone muted · they can unmute themselves'); }}>Mute all</button>
          <button className="btn sm" data-act="call-lock" onClick={() => { const c = cur(); c.locked = !c.locked; renderCall(); toast(c.locked ? 'Meeting locked · no one new can join' : 'Meeting unlocked'); }}>{call.locked ? '🔒 Locked' : 'Lock meeting'}</button>
          <label className="cp-wr"><input type="checkbox" data-callwr checked={!!call.waitingRoom} onChange={(e) => { const c = cur(); c.waitingRoom = e.target.checked; renderCall(); toast(e.target.checked ? 'Waiting room on · you admit each person' : 'Waiting room off'); }} /> Waiting room</label>
          <label className="cp-wr"><input type="checkbox" data-callshare checked={!!call.hostShareOnly} onChange={(e) => { const c = cur(); c.hostShareOnly = e.target.checked; renderCall(); toast(e.target.checked ? 'Only the host can share their screen' : 'Everyone can share their screen'); }} /> Only host shares screen</label>
        </div>
      ) : null}
      {call.waiting?.length ? (
        <>
          <div className="cp-label">Waiting to join ({call.waiting.length})</div>
          {call.waiting.map((id: string) => (
            <div key={id} className="cp-row"><Avatar o={person(id)} size={30} /><span className="grow">{senderName(id)}</span>
              {host ? <>
                <button className="btn sm primary" data-act="call-admit" data-id={id} onClick={() => { const c = cur(); c.waiting = c.waiting.filter((x: string) => x !== id); c.joined.push(id); renderCall(); toast(`${senderName(id)} admitted`); }}>Admit</button>
                <button className="btn sm" data-act="call-deny" data-id={id} onClick={() => { const c = cur(); c.waiting = c.waiting.filter((x: string) => x !== id); renderCall(); toast('Request declined'); }}>Deny</button>
              </> : null}
            </div>
          ))}
        </>
      ) : null}
      <div className="cp-label">In the call</div>
      <div className="cp-row"><Avatar o={S.me} size={30} /><span className="grow">You{host ? ' · host' : ''}</span><Icon name={call.muted ? 'micoff' : 'mic'} size={16} /></div>
      {people.slice(0, 50).map((id) => (
        <div key={id} className="cp-row"><Avatar o={person(id)} size={30} /><span className="grow">{senderName(id)}</span><Icon name={(call.mutedIds || []).includes(id) ? 'micoff' : 'mic'} size={16} />
          {host ? <button className="icon-btn sm light" data-act="call-remove" data-id={id} title="Remove" aria-label={`Remove ${senderName(id)}`} onClick={() => {
            const c = cur();
            if (c.room) c.joined = c.joined.filter((x: string) => x !== id);
            else c.removed = [...(c.removed || []), id];
            renderCall(); toast(`${senderName(id)} removed from the call`);
          }}><Icon name="close" size={16} /></button> : null}
        </div>
      ))}
      {people.length > 50 ? <div className="cp-label">+ {(people.length - 50).toLocaleString()} more</div> : null}
    </div>
  );
}

function QualityConfirm() {
  const call = cur();
  const a = call.mic?.getAudioTracks()[0]?.getSettings?.() || {}, v = call.stream?.getVideoTracks()[0]?.getSettings?.() || {};
  const yn = (x: unknown) => (x === undefined ? 'n/a' : x ? 'on' : 'off');
  const lines = [call.mic ? `Noise suppression ${yn(a.noiseSuppression)} · echo cancellation ${yn(a.echoCancellation)} · auto gain ${yn(a.autoGainControl)}${a.sampleRate ? ` · ${(a.sampleRate / 1000).toFixed(1)} kHz` : ''}` : 'Microphone not started',
    call.video && v.width ? `Camera ${v.width}×${v.height}${v.frameRate ? ' @ ' + Math.round(v.frameRate) + ' fps' : ''}` : ''].filter(Boolean);
  return <>{lines.map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}</>;
}

function QualityPanel() {
  const call = cur();
  const q = call.q;
  const row = (k: string, label: string, sub: string) => (
    <label className="cq-row"><div className="grow"><div>{label}</div><div className="cp-sub">{sub}</div></div>
      <input type="checkbox" className="switch" data-callq={k} checked={!!q[k]} onChange={(e) => { q[k] = e.target.checked; applyQuality(call, k); renderCall(); }} /></label>
  );
  return (
    <div className="call-panel" role="dialog" aria-label="Audio and video quality">
      <div className="row-between"><b>Audio &amp; video quality</b><button className="icon-btn sm light" data-act="call-quality" aria-label="Close" onClick={() => toggleSheet('quality')}><Icon name="close" size={18} /></button></div>
      <div className="cp-label">Your microphone</div>
      <div className="mic-meter"><div id="mic-level" /></div>
      <div className="cp-sub" id="mic-state">{call.micErr ? 'Microphone unavailable — allow access to test these settings' : call.mic ? (call.muted ? 'You are muted' : 'Speak to see your level') : 'Starting microphone…'}</div>
      <div className="cp-label">Audio</div>
      {row('hdAudio', 'HD audio', '48 kHz wideband voice')}
      {row('noise', 'Noise cancellation', 'Removes fans, traffic and keyboard noise')}
      {row('echo', 'Echo reduction', 'Stops your speaker feeding back into the mic')}
      {row('agc', 'Auto volume', 'Keeps your voice at a steady level')}
      {call.video ? <><div className="cp-label">Video</div>{row('hdVideo', 'HD video', '720p when your connection allows')}</> : null}
      <div className="cp-label">Browser confirms</div><div className="cp-sub" id="cq-confirm"><QualityConfirm /></div>
    </div>
  );
}

function MeetingChat() {
  const call = cur();
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  const n = (call.chatLog || []).length;
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [n]);
  useEffect(() => { inp.current?.focus(); }, []);
  return (
    <div className="call-panel" role="dialog" aria-label="Meeting chat">
      <div className="row-between"><b>Meeting chat</b><button className="icon-btn sm light" data-act="call-chat" aria-label="Close" onClick={() => toggleSheet('chat')}><Icon name="close" size={18} /></button></div>
      <div className="mc-list" id="mc-list" ref={list}>
        {n ? call.chatLog.map((x: Dict, i: number) => <div key={i} className={`mc-msg ${x.who === 'You' ? 'me' : ''}`}><b>{x.who}</b>{x.text}</div>)
          : <div className="cp-sub">Messages here are seen by everyone in the meeting and saved to the summary.</div>}
      </div>
      <form className="mc-form" data-mcform onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(''); sendMeetingChat(t); inp.current?.focus(); }}>
        <input id="mc-in" ref={inp} placeholder="Message everyone" autoComplete="off" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn sm primary">Send</button>
      </form>
    </div>
  );
}

function CallXStage() {
  const call = cur();
  const c = call.cw as Chat | undefined;
  return (
    <>
      {call.held ? <div className="held-bar"><Icon name="pause" size={16} /><span className="grow">On hold · {chatTitle(call.held.ch)}</span><button className="btn sm" data-act="call-swap" onClick={swapCall}>Swap</button></div> : null}
      {c ? (
        <div className="cw-card" role="alertdialog" aria-label="Incoming call"><ChatAvatar ch={c} size={44} />
          <div className="grow"><div className="ci-name">{chatTitle(c)}</div><div className="ci-sub">Call waiting · WHATSMORE voice call</div></div>
          <div className="cw-actions">
            <button className="btn sm danger" data-act="call-cw" data-m="decline" onClick={() => callWaitingAction('decline')}>Decline</button>
            <button className="btn sm" data-act="call-cw" data-m="message" onClick={() => callWaitingAction('message')}>Message</button>
            <button className="btn sm" data-act="call-cw" data-m="end" onClick={() => callWaitingAction('end')}>End &amp; answer</button>
            <button className="btn sm primary" data-act="call-cw" data-m="hold" onClick={() => callWaitingAction('hold')}>Hold &amp; answer</button>
          </div>
        </div>
      ) : null}
      {call.sheet === 'fx' ? (
        <div className="call-panel fx-panel" role="dialog" aria-label="Background effects">
          <div className="row-between"><b>Background effects</b><button className="icon-btn sm light" data-act="call-fx" aria-label="Close" onClick={() => toggleSheet('fx')}><Icon name="close" size={18} /></button></div>
          <div className="fx-grid">{CALL_FX.map(([id, name, e]) => <button key={id} className={`fx-tile vbg-${id} ${fxOf(call) === id ? 'on' : ''}`} data-act="call-setfx" data-fx={id} onClick={() => { const c = cur(); c.fx = id; c.blur = id === 'blur'; renderCall(); }}><span>{e}</span><b>{name}</b></button>)}</div>
          <p className="cp-note">Demo: virtual backgrounds use an approximate portrait cut-out. The production app would use on-device person segmentation, so your camera feed never leaves your phone.</p>
        </div>
      ) : null}
      {call.sheet === 'quality' ? <QualityPanel /> : null}
      {call.sheet === 'chat' ? <MeetingChat /> : null}
    </>
  );
}

function CallButton({ act: a, on, title, label, onClick, cls = '', children }: { act: string; on?: boolean; title: string; label: string; onClick: () => void; cls?: string; children: ReactNode }) {
  return <button className={`cbtn ${on ? 'on' : ''} ${cls}`} data-act={a} title={title} aria-label={label} onClick={onClick}>{children}</button>;
}

function CallScreen() {
  const call = cur();
  const title = call.room ? 'WHATSMORE Call Room' : call.added?.length ? `Group call · ${chatTitle(call.ch)} + ${call.added.length}` : chatTitle(call.ch);
  const elapsed = call.start ? fmtDur((nowMs() - call.start) / 1000) : '0:00';
  const label = ({ calling: 'Calling…', ringing: 'Ringing…', waiting: 'Waiting for others to join…', connected: elapsed } as Record<string, string>)[call.state];
  const all = callPeople(call);
  const people = all.slice(0, 11), extra = all.length - people.length;
  const grid = people.length > 0 && call.state === 'connected';
  const fx = fxOf(call);
  const fxCls = `${fx !== 'none' && fx !== 'blur' ? 'vbg vbg-' + fx : ''} ${call.facing === 'environment' ? 'rear' : ''}`;
  const bits: string[] = [];
  if (fx === 'blur') bits.push('blur on'); else if (fx !== 'none') bits.push(CALL_FX.find((f) => f[0] === fx)![1] + ' background');
  if (call.facing === 'environment') bits.push('rear camera');
  if (call.res) bits.push(call.res);
  const selfLabel = bits.length ? ' · ' + bits.join(' · ') : '';
  const nPeople = callPeople(call).length;
  const multi = call.room || nPeople > 1;
  return (
    <div id="call" className="call">
      <div className="call-top"><Icon name="lock" size={14} /> End-to-end encrypted{call.room ? ` · whatsmore.app/call/${call.room}` : ''}</div>
      <div className="call-stage">
        {call.screen ? (
          <><Video id="screen-vid" stream={call.screen} /><div className="screen-label"><Icon name="screen" size={16} /> You are presenting · <span id="call-status">{label}</span></div></>
        ) : grid ? (
          <div className="call-grid-wrap">
            <div className="call-title">{title} · <span id="call-status">{label}</span></div>
            <div className="call-grid">
              {people.map((id: string) => <div key={id} className="tile"><Avatar o={who(id)} size={84} /><span>{who(id)?.name}</span><span className="tile-mic"><Icon name="mic" size={14} /></span></div>)}
              {extra > 0 ? <div className="tile more"><b>+{extra.toLocaleString()}</b><span>more in call</span></div> : null}
            </div>
          </div>
        ) : (
          <div className="call-hero">
            {call.room ? <div className="action-ic big"><Icon name="link" size={40} /></div> : <ChatAvatar ch={call.ch} size={128} />}
            <h2>{title}</h2><div className="call-status" id="call-status">{label}</div>
            <div className="call-kind">{call.video ? 'WHATSMORE video call' : 'WHATSMORE voice call'}</div>
          </div>
        )}
        {call.video ? (
          <div className={`self-view ${call.blur ? 'blur' : ''} ${fxCls}`}>
            {call.stream && !call.camOff ? <Video id="self-vid" stream={call.stream} /> : <div className="self-off">{call.camErr ? 'Camera unavailable' : 'Camera off'}</div>}
            <span>You{selfLabel}</span>
          </div>
        ) : null}
        <CallXStage />
        {call.rec ? <div className="rec-banner"><span className="rec-dot" /> REC · everyone agreed to recording</div> : null}
        {call.cc ? <div className="cc-box" id="cc-box" aria-live="polite"><CcLines /></div> : null}
        {call.panel ? <ParticipantsPanel /> : null}
      </div>
      <div className="call-controls">
        <CallButton act="call-mute" on={call.muted} title={call.muted ? 'Unmute' : 'Mute'} label="Mute" onClick={() => toggle('muted')}><Icon name={call.muted ? 'micoff' : 'mic'} /></CallButton>
        <CallButton act="call-cam" on={!(call.video && !call.camOff)} title="Camera" label="Camera" onClick={toggleCam}><Icon name={call.video && !call.camOff ? 'video' : 'videooff'} /></CallButton>
        {call.video ? <>
          <CallButton act="call-flip" title="Switch camera" label="Switch camera" onClick={flipCamera}><Icon name="flipcam" /></CallButton>
          <CallButton act="call-fx" on={fx !== 'none'} title="Background effects" label="Background effects" onClick={() => toggleSheet('fx')}><Icon name="blur" /></CallButton>
        </> : null}
        <CallButton act="call-quality" on={call.sheet === 'quality'} title="Audio & video quality" label="Audio and video quality" onClick={() => { const c = cur(); c.q ||= defaultQuality(); toggleSheet('quality'); if (c.sheet === 'quality') startMic(c); }}><Icon name="tune" /></CallButton>
        {call.room ? null : <CallButton act="call-add" title="Add people" label="Add people to call" onClick={addToCallModal}><Icon name="personadd" /></CallButton>}
        {multi ? <CallButton act="call-chat" on={call.sheet === 'chat'} title="Meeting chat" label="Meeting chat" onClick={() => { const c = cur(); c.chatUnread = 0; toggleSheet('chat'); }}><Icon name="chat" />{call.chatUnread ? <span className="cbadge">{call.chatUnread}</span> : null}</CallButton> : null}
        <CallButton act="call-screen" on={!!call.screen} title="Share screen" label="Share screen" onClick={toggleScreen}><Icon name="screen" /></CallButton>
        {call.room ? <CallButton act="call-copylink" title="Copy link" label="Copy call link" onClick={() => copyText('https://whatsmore.app/call/' + call.room)}><Icon name="link" /></CallButton> : null}
        <CallButton act="call-cc" on={call.cc} title="Live captions" label="Live captions" onClick={() => { const c = cur(); c.cc = !c.cc; if (c.cc) startCC(c); else stopCC(c); renderCall(); }}><b className="cc-ic">CC</b></CallButton>
        {call.cc ? <CallButton act="call-cclang" on={call.ccLang !== 'en'} title="Translate captions" label="Translate captions" onClick={() => {
          const c = cur(); const i = CC_LANGS.findIndex((l) => l[0] === c.ccLang); c.ccLang = CC_LANGS[(i + 1) % CC_LANGS.length][0]; renderCall(); toast('Captions in ' + CC_LANGS.find((l) => l[0] === c.ccLang)![1]);
        }}><Icon name="translate" /></CallButton> : null}
        <CallButton act="call-rec" on={!!call.rec} cls={call.rec ? 'rec' : ''} title={call.rec ? 'Stop recording' : 'Record (asks everyone)'} label="Record call" onClick={toggleRecording}><span className="rec-ic" /></CallButton>
        {nPeople > 1 || call.room ? <CallButton act="call-people" on={call.panel} title="Participants" label="Participants" onClick={() => toggle('panel')}><Icon name="groups" />{call.waiting?.length ? <span className="cbadge">{call.waiting.length}</span> : null}</CallButton> : null}
        <CallButton act="call-end" cls="end" title="End call" label="End call" onClick={endCall}><Icon name="callend" /></CallButton>
      </div>
    </div>
  );
}

/** Always-mounted call overlay. Also opens whatsmore.app/call/<code> links anywhere in the app. */
export function CallOverlay() {
  useMedia(); useRender();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const link = (e.target as HTMLElement)?.closest?.('a[href*="whatsmore.app/call/"]') as HTMLAnchorElement | null;
      if (!link) return;
      e.preventDefault();
      startCall(null, true, { room: link.href.split('/call/')[1] });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return M.call ? <CallScreen /> : null;
}

// ---------- call links, meetings
export function callLinkModal() {
  const code = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
  const link = `https://whatsmore.app/call/${code}`;
  modal({
    title: 'Create call link',
    body: <><div className="call-link-card"><div className="action-ic big"><Icon name="video" size={28} /></div><div><div className="ci-name">WHATSMORE Call Room</div><div className="qr-link">{link}</div></div></div><p className="muted small">Anyone with this link can join. Share it in a chat or copy it.</p></>,
    actions: [
      { label: 'Copy link', onClick: () => { copyText(link); return false; } },
      { label: 'Share in chat', onClick: () => { setTimeout(() => chatPicker('Share call link', (chats) => { chats.forEach((ch) => sendMsg(ch, { type: 'text', text: `Join my WHATSMORE call 📹 ${link}` })); toast('Call link shared'); }), 0); } },
      { label: 'Join now', primary: true, onClick: () => { startCall(null, true, { room: code }); } },
    ],
  });
}

export function scheduleMeetingModal() {
  const d = new Date(Date.now() + DAY); d.setHours(11, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  const groups = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  modal({
    title: 'Schedule a meeting',
    body: (
      <>
        <label className="field"><span>Title</span><input id="mt-t" maxLength={60} placeholder="e.g. Weekly team sync" autoFocus /></label>
        <label className="field"><span>Date &amp; time</span><input id="mt-d" type="datetime-local" defaultValue={local} /></label>
        <label className="field"><span>Share invite in</span><select id="mt-c" defaultValue=""><option value="">Don&apos;t share yet</option>{groups.map((c) => <option key={c.id} value={c.id}>{chatTitle(c)}</option>)}</select></label>
        <label className="radio-row"><input type="checkbox" id="mt-wr" defaultChecked /> Waiting room — host admits each person</label>
      </>
    ),
    actions: [{ label: 'Cancel' }, {
      label: 'Schedule', primary: true, onClick: (root) => {
        const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
        const title = q<HTMLInputElement>('#mt-t').value.trim(), at = new Date(q<HTMLInputElement>('#mt-d').value).getTime();
        if (!title || !(at > Date.now())) { toast('Add a title and a future time'); return false; }
        const code = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
        const mt = { id: uid(), title, at, code, waitingRoom: q<HTMLInputElement>('#mt-wr').checked };
        (S.meetings ||= []).push(mt);
        const ch = chatById(q<HTMLSelectElement>('#mt-c').value);
        if (ch) { sendMsg(ch, { type: 'event', title: '📹 ' + title, when: at, place: 'WHATSMORE video meeting', going: ['me'] }); sendMsg(ch, { type: 'text', text: `Join the meeting: https://whatsmore.app/call/${code}` }); }
        commit();
        toast(`Meeting scheduled · ${dayLabel(at).toLowerCase()} at ${fmtTime(at)}`);
      },
    }],
  });
}

// ---------- Calls tab
export function CallsTab() {
  useRender();
  const nowT = useNow();
  const ups = (S.meetings || []).filter((m: Dict) => m.at > nowT - HOUR).sort((a: Dict, b: Dict) => a.at - b.at);
  const rows = S.calls.slice().sort((a, b) => b.t - a.t).map((k) => {
    const ch = chatById(k.chatId);
    if (!ch) return null;
    return (
      <div key={k.id} className="chat-item" data-act="open" data-chat={ch.id} onClick={() => openChat(ch.id)}>
        <ChatAvatar ch={ch} />
        <div className="ci-body">
          <div className="ci-top"><span className={`ci-name ${k.missed ? 'missed' : ''}`}>{chatTitle(ch)}</span></div>
          <div className="ci-bottom"><span className="ci-preview"><span className={`call-dir ${k.missed ? 'missed' : ''}`}><Icon name={k.dir === 'in' ? 'callin' : 'callout'} size={16} /></span>{callTime(k.t)}{k.dur ? ' · ' + fmtDur(k.dur) : k.missed ? ' · Missed' : ''}</span></div>
        </div>
        <button className="icon-btn accent" data-act="callback" data-chat={ch.id} data-video={k.video ? 1 : ''} title="Call again" aria-label="Call again" onClick={(e) => { e.stopPropagation(); startCall(ch, !!k.video); }}><Icon name={k.video ? 'video' : 'call'} /></button>
      </div>
    );
  }).filter(Boolean);
  return (
    <>
      <header className="side-head"><h2>Calls</h2><div className="head-actions"><button className="icon-btn" data-act="calllink" title="Create call link" aria-label="Create call link" onClick={callLinkModal}><Icon name="link" /></button></div></header>
      <div className="side-scroll">
        <div className="list-row action" data-act="calllink" onClick={callLinkModal}><span className="action-ic"><Icon name="link" size={22} /></span><div><div className="ci-name">Create call link</div><div className="ci-sub">WHATSMORE Call Rooms — share a link anyone can join</div></div></div>
        <div className="list-row action" data-act="schedmeet" onClick={scheduleMeetingModal}><span className="action-ic"><Icon name="event" size={22} /></span><div><div className="ci-name">Schedule a meeting</div><div className="ci-sub">Invite link · waiting room · host controls · live captions</div></div></div>
        {ups.length ? <>
          <div className="list-label">Upcoming meetings</div>
          {ups.map((m: Dict) => (
            <div key={m.id} className="set-row">
              <div className="date-chip"><b>{new Date(m.at).getDate()}</b><span>{new Date(m.at).toLocaleDateString([], { month: 'short' })}</span></div>
              <div className="grow"><div className="ci-name">{m.title}</div><div className="ci-sub">{dayLabel(m.at)} · {fmtTime(m.at)} · whatsmore.app/call/{m.code}</div></div>
              <button className="btn sm primary" data-act="joinmeet" data-id={m.id} onClick={() => startCall(null, true, { room: m.code })}>Join</button>
              <button className="icon-btn sm" data-act="delmeet" data-id={m.id} aria-label="Cancel meeting" onClick={() => { S.meetings = (S.meetings || []).filter((x: Dict) => x.id !== m.id); commit(); }}><Icon name="delete" size={18} /></button>
            </div>
          ))}
        </> : null}
        <div className="list-label">Recent</div>
        {rows.length ? rows : <div className="empty-list">No calls yet</div>}
        <div className="hint-box"><Icon name="lock" size={16} /><span>Your personal calls are end-to-end encrypted.</span></div>
      </div>
    </>
  );
}
function useNow() { const [t] = useState(nowMs); return t; }

