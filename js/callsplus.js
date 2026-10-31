// Blueprint §11 Super Calling: live captions + real-time translation, consent-based recording,
// host controls with a waiting room, and meeting scheduling
'use strict';
const CC_SCRIPT = [
  { en: 'Can everyone hear me clearly?', te: 'అందరికీ నా మాట స్పష్టంగా వినిపిస్తుందా?', hi: 'क्या सबको मेरी आवाज़ साफ़ सुनाई दे रही है?' },
  { en: "Let's start with the demo updates.", te: 'డెమో అప్‌డేట్‌లతో మొదలుపెడదాం.', hi: 'चलिए डेमो अपडेट से शुरू करते हैं।' },
  { en: 'The payment flow is ready for testing.', te: 'పేమెంట్ ఫ్లో టెస్టింగ్‌కి సిద్ధంగా ఉంది.', hi: 'पेमेंट फ़्लो टेस्टिंग के लिए तैयार है।' },
  { en: 'Please share your feedback by Friday.', te: 'దయచేసి శుక్రవారం లోపు మీ అభిప్రాయం పంపండి.', hi: 'कृपया शुक्रवार तक अपनी राय भेजें।' },
  { en: 'Great, thank you everyone!', te: 'చాలా బాగుంది, అందరికీ ధన్యవాదాలు!', hi: 'बहुत बढ़िया, सभी को धन्यवाद!' },
];
const CC_LANGS = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी']];
const callPeople = (call) => (call.room ? call.joined : call.ch?.type === 'group' ? call.ch.members : call.ch ? [call.ch.contactId] : []).filter((id) => !(call.removed || []).includes(id));
const isHost = (call) => !!call.room || (call.ch?.type === 'group' ? isAdmin(call.ch) : true);

function callPlusStageHTML(call) {
  let h = '';
  if (call.rec) h += `<div class="rec-banner"><span class="rec-dot"></span> REC · everyone agreed to recording</div>`;
  if (call.cc) h += `<div class="cc-box" id="cc-box" aria-live="polite">${ccLinesHTML(call)}</div>`;
  if (call.panel) h += participantsPanelHTML(call);
  return h;
}
function callPlusButtonsHTML(call) {
  const people = callPeople(call).length;
  return `<button class="cbtn ${call.cc ? 'on' : ''}" data-act="call-cc" title="Live captions" aria-label="Live captions"><b class="cc-ic">CC</b></button>
    ${call.cc ? `<button class="cbtn ${call.ccLang !== 'en' ? 'on' : ''}" data-act="call-cclang" title="Translate captions" aria-label="Translate captions">${icon('translate')}</button>` : ''}
    <button class="cbtn ${call.rec ? 'on rec' : ''}" data-act="call-rec" title="${call.rec ? 'Stop recording' : 'Record (asks everyone)'}" aria-label="Record call"><span class="rec-ic"></span></button>
    ${people > 1 || call.room ? `<button class="cbtn ${call.panel ? 'on' : ''}" data-act="call-people" title="Participants" aria-label="Participants">${icon('groups')}${call.waiting?.length ? `<span class="cbadge">${call.waiting.length}</span>` : ''}</button>` : ''}`;
}
function ccLinesHTML(call) {
  const lines = (call.ccLines || []).slice(-3);
  if (!lines.length) return `<div class="cc-line muted">Live captions on · ${CC_LANGS.find((l) => l[0] === call.ccLang)[1]} — waiting for speech…</div>`;
  return lines.map((l) => `<div class="cc-line"><b>${esc(l.who)}:</b> ${esc(l.text[call.ccLang] || l.text.en)}</div>`).join('') + (call.ccLang !== 'en' ? `<div class="cc-note">${icon('translate', 12)} Translated live · original kept</div>` : '');
}
function updateCC() { const box = $('#cc-box'); if (box && ui.call) box.innerHTML = ccLinesHTML(ui.call); }
function startCC(call) {
  call.ccLines = call.ccLines || [];
  call.ccLang = call.ccLang || 'en';
  let i = 0;
  clearInterval(call.ccT);
  call.ccT = setInterval(() => {
    if (ui.call !== call || !call.cc) return clearInterval(call.ccT);
    if (call.state !== 'connected') return;
    const people = callPeople(call);
    const who = people.length ? senderName(people[i % people.length]).split(' ')[0] : 'Guest';
    call.ccLines.push({ who, text: CC_SCRIPT[i % CC_SCRIPT.length] });
    i++; updateCC();
  }, 3200);
  // Your own speech, when the browser supports it
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && !call.muted) {
    try {
      const r = call.sr = new SR();
      r.lang = 'en-IN'; r.continuous = true; r.interimResults = false;
      r.onresult = (e) => { const t = e.results[e.results.length - 1][0].transcript.trim(); if (t) { const tr = translateSentences(t, 'te'), hi = translateSentences(t, 'hi'); call.ccLines.push({ who: 'You', text: { en: t, te: tr || t, hi: hi || t } }); updateCC(); } };
      r.onerror = () => {};
      r.start();
    } catch (e) { /* captions still show other speakers */ }
  }
}
function stopCC(call) { clearInterval(call.ccT); try { call.sr?.stop(); } catch (e) { /* ignore */ } call.sr = null; }

function participantsPanelHTML(call) {
  const host = isHost(call);
  const people = callPeople(call);
  return `<div class="call-panel" role="dialog" aria-label="Participants">
    <div class="row-between"><b>Participants (${(people.length + 1).toLocaleString()})</b><button class="icon-btn sm light" data-act="call-people" aria-label="Close">${icon('close', 18)}</button></div>
    ${host ? `<div class="cp-tools"><button class="btn sm" data-act="call-muteall">Mute all</button><button class="btn sm" data-act="call-lock">${call.locked ? '🔒 Locked' : 'Lock meeting'}</button><label class="cp-wr"><input type="checkbox" data-callwr ${call.waitingRoom ? 'checked' : ''}> Waiting room</label><label class="cp-wr"><input type="checkbox" data-callshare ${call.hostShareOnly ? 'checked' : ''}> Only host shares screen</label></div>` : ''}
    ${call.waiting?.length ? `<div class="cp-label">Waiting to join (${call.waiting.length})</div>${call.waiting.map((id) => `<div class="cp-row">${avatarHTML(person(id), 30)}<span class="grow">${esc(senderName(id))}</span>${host ? `<button class="btn sm primary" data-act="call-admit" data-id="${id}">Admit</button><button class="btn sm" data-act="call-deny" data-id="${id}">Deny</button>` : ''}</div>`).join('')}` : ''}
    <div class="cp-label">In the call</div>
    <div class="cp-row">${avatarHTML(S.me, 30)}<span class="grow">You${host ? ' · host' : ''}</span>${icon(call.muted ? 'micoff' : 'mic', 16)}</div>
    ${people.slice(0, 50).map((id) => `<div class="cp-row">${avatarHTML(person(id), 30)}<span class="grow">${esc(senderName(id))}</span>${icon((call.mutedIds || []).includes(id) ? 'micoff' : 'mic', 16)}${host ? `<button class="icon-btn sm light" data-act="call-remove" data-id="${id}" title="Remove" aria-label="Remove ${esc(senderName(id))}">${icon('close', 16)}</button>` : ''}</div>`).join('')}
    ${people.length > 50 ? `<div class="cp-label">+ ${(people.length - 50).toLocaleString()} more</div>` : ''}
  </div>`;
}
function knockLater(call) {
  // Simulate people arriving through the room link; with the waiting room on, the host admits them
  [['u_rahul', 7000], ['u_fatima', 13000]].forEach(([id, d]) => setTimeout(() => {
    if (ui.call !== call || call.state !== 'connected' || call.locked) return;
    ensureContact(id);
    if (call.waitingRoom) { (call.waiting ||= []).push(id); toast(`${senderName(id)} is waiting to join`); }
    else { call.joined.push(id); toast(`${senderName(id)} joined`); }
    renderCall();
  }, d));
}

Object.assign(XA, {
  'call-cc'() { const c = ui.call; c.cc = !c.cc; c.cc ? startCC(c) : stopCC(c); renderCall(); },
  'call-cclang'() { const c = ui.call; const i = CC_LANGS.findIndex((l) => l[0] === c.ccLang); c.ccLang = CC_LANGS[(i + 1) % CC_LANGS.length][0]; updateCC(); toast('Captions in ' + CC_LANGS.find((l) => l[0] === c.ccLang)[1]); },
  'call-rec'() {
    const c = ui.call;
    if (c.rec) { c.recDur = (c.recDur || 0) + (Date.now() - c.rec.start); c.rec = null; renderCall(); return toast('Recording stopped · saved when the call ends'); }
    modal({
      title: 'Record this call?',
      body: `<p class="muted">Everyone in the call will be asked for consent. Recording starts only if all participants agree, and a REC banner stays visible to everyone.</p>${note('Call recording laws differ by country. WHATSMORE always asks first and never records silently.', 'shield')}`,
      actions: [{ label: 'Cancel' }, { label: 'Ask everyone', primary: true, onClick: () => {
        toast('Asking participants for consent…', null, { ms: 1500 });
        setTimeout(() => { if (ui.call !== c) return; c.rec = { start: Date.now() }; renderCall(); toast(`All ${callPeople(c).length || 1} participant${callPeople(c).length === 1 ? '' : 's'} agreed · recording`); }, 1600);
      } }],
    });
  },
  'call-people'() { ui.call.panel = !ui.call.panel; renderCall(); },
  'call-muteall'() { const c = ui.call; c.mutedIds = callPeople(c).slice(); renderCall(); toast('Everyone muted · they can unmute themselves'); },
  'call-lock'() { const c = ui.call; c.locked = !c.locked; renderCall(); toast(c.locked ? 'Meeting locked · no one new can join' : 'Meeting unlocked'); },
  'call-admit'(el) { const c = ui.call; c.waiting = c.waiting.filter((x) => x !== el.dataset.id); c.joined.push(el.dataset.id); renderCall(); toast(`${senderName(el.dataset.id)} admitted`); },
  'call-deny'(el) { const c = ui.call; c.waiting = c.waiting.filter((x) => x !== el.dataset.id); renderCall(); toast('Request declined'); },
  'call-remove'(el) {
    const c = ui.call, id = el.dataset.id;
    if (c.room) c.joined = c.joined.filter((x) => x !== id);
    else c.removed = [...(c.removed || []), id];
    renderCall(); toast(`${senderName(id)} removed from the call`);
  },
  schedmeet() { scheduleMeetingModal(); },
  joinmeet(el) { const mt = (S.meetings || []).find((x) => x.id === el.dataset.id); if (mt) startCall(null, true, { room: mt.code }); },
  delmeet(el) { S.meetings = (S.meetings || []).filter((x) => x.id !== el.dataset.id); save(); renderSidebar(); },
});
document.addEventListener('change', (e) => {
  if (!ui.call) return;
  if (e.target.matches('[data-callwr]')) { ui.call.waitingRoom = e.target.checked; toast(e.target.checked ? 'Waiting room on · you admit each person' : 'Waiting room off'); }
  if (e.target.matches('[data-callshare]')) { ui.call.hostShareOnly = e.target.checked; toast(e.target.checked ? 'Only the host can share their screen' : 'Everyone can share their screen'); }
});

// Wrap call lifecycle: rooms start with a waiting room, and recordings are saved to the chat
const _startCallPlus = startCall;
startCall = async function (ch, video, opts = {}) {
  await _startCallPlus(ch, video, opts);
  const call = ui.call;
  if (!call) return;
  if (call.room) call.waitingRoom = true;
  const wait = setInterval(() => {
    if (ui.call !== call) return clearInterval(wait);
    if (call.state === 'connected') { clearInterval(wait); if (call.room) knockLater(call); }
  }, 500);
};
const _endCallPlus = endCall;
endCall = function () {
  const call = ui.call;
  if (!call) return;
  stopCC(call);
  const recMs = (call.recDur || 0) + (call.rec ? Date.now() - call.rec.start : 0);
  _endCallPlus();
  if (recMs > 1000 && call.ch) {
    const secs = Math.round(recMs / 1000), d = new Date();
    sendMsg(call.ch, { type: 'doc', name: `Call_recording_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.m4a`, ext: 'm4a', size: secs * 16000, caption: `🔴 Call recording · ${fmtDur(secs)} · all participants consented` });
  }
};

// ---------- meeting scheduling (Calls tab)
function scheduleMeetingModal() {
  const d = new Date(Date.now() + DAY); d.setHours(11, 0, 0, 0);
  const local = new Date(d - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  const groups = S.chats.filter((c) => !c.locked && !c.left && !(c.readOnly && !isAdmin(c))).sort((a, b) => lastTime(b) - lastTime(a));
  modal({
    title: 'Schedule a meeting',
    body: `<label class="field"><span>Title</span><input id="mt-t" maxlength="60" placeholder="e.g. Weekly team sync" autofocus></label>
      <label class="field"><span>Date & time</span><input id="mt-d" type="datetime-local" value="${local}"></label>
      <label class="field"><span>Share invite in</span><select id="mt-c"><option value="">Don't share yet</option>${groups.map((c) => `<option value="${c.id}">${esc(chatTitle(c))}</option>`).join('')}</select></label>
      <label class="radio-row"><input type="checkbox" id="mt-wr" checked> Waiting room — host admits each person</label>`,
    actions: [{ label: 'Cancel' }, { label: 'Schedule', primary: true, onClick: (root) => {
      const title = $('#mt-t', root).value.trim(), at = new Date($('#mt-d', root).value).getTime();
      if (!title || !(at > Date.now())) { toast('Add a title and a future time'); return false; }
      const code = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
      const mt = { id: uid(), title, at, code, waitingRoom: $('#mt-wr', root).checked };
      (S.meetings ||= []).push(mt);
      const ch = chatById($('#mt-c', root).value);
      if (ch) { sendMsg(ch, { type: 'event', title: '📹 ' + title, when: at, place: 'WHATSMORE video meeting', going: ['me'] }); sendMsg(ch, { type: 'text', text: `Join the meeting: https://whatsmore.app/call/${code}` }); }
      save(); if (ui.tab === 'calls') renderSidebar();
      toast(`Meeting scheduled · ${dayLabel(at).toLowerCase()} at ${fmtTime(at)}`);
    } }],
  });
}
const _tabCallsPlus = tabCalls;
tabCalls = function () {
  const ups = (S.meetings || []).filter((m) => m.at > Date.now() - HOUR).sort((a, b) => a.at - b.at);
  const block = `<div class="list-row action" data-act="schedmeet"><span class="action-ic">${icon('event', 22)}</span><div><div class="ci-name">Schedule a meeting</div><div class="ci-sub">Invite link · waiting room · host controls · live captions</div></div></div>`
    + (ups.length ? '<div class="list-label">Upcoming meetings</div>' + ups.map((m) => `<div class="set-row"><div class="date-chip"><b>${new Date(m.at).getDate()}</b><span>${new Date(m.at).toLocaleDateString([], { month: 'short' })}</span></div><div class="grow"><div class="ci-name">${esc(m.title)}</div><div class="ci-sub">${dayLabel(m.at)} · ${fmtTime(m.at)} · whatsmore.app/call/${esc(m.code)}</div></div><button class="btn sm primary" data-act="joinmeet" data-id="${m.id}">Join</button><button class="icon-btn sm" data-act="delmeet" data-id="${m.id}" aria-label="Cancel meeting">${icon('delete', 18)}</button></div>`).join('') : '');
  return _tabCallsPlus().replace('<div class="list-label">Recent</div>', block + '<div class="list-label">Recent</div>');
};
