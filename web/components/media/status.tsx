'use client';
// Status tab, story viewer, new status (text / photo / link / location) and voice status.
// Ported from js/sidebar.js (tabStatus), js/overlays.js (stories), js/cloudplus.js (voice status) and
// js/stories.js (live hooks: see hooks.ts; close friends row comes through the 'status.extra' slot).
import { useEffect, useRef, useState } from 'react';
import { S, commit, useRender } from '@/lib/state';
import { modal, toast, pickFile, readImage, modalOpen } from '@/lib/overlay';
import { contact, directChatFor, listTime, privacyLabel, PRIVACY_OPTS, fmtDur, hash, fmtText } from '@/lib/util';
import { sendMsg, scheduleReply } from '@/lib/actions';
import { readAloud } from '@/lib/translate';
import type { Contact, Dict } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Slot } from '@/components/ui/Slot';
import { M, bump, useMedia, liveOn, getPosition, nowMs } from './shared';
import { statusPostedHooks, storyViewHooks, storyDeleteHooks, storyReplyHooks, type StoryOwner } from './hooks';

// ---------- tab
function RingAvatar({ o, count, viewed }: { o: Partial<Contact> | undefined; count: number; viewed: boolean }) {
  const r = 26, C = 2 * Math.PI * r, gap = count > 1 ? 4 : 0, seg = C / count - gap;
  return (
    <div className="ring-wrap">
      <svg width="56" height="56" viewBox="0 0 56 56" className={`ring ${viewed ? 'viewed' : ''}`}>
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="2.4" strokeDasharray={count > 1 ? `${seg} ${gap}` : undefined} transform="rotate(-90 28 28)" />
      </svg>
      <Avatar o={o} size={46} />
    </div>
  );
}

export function StatusTab() {
  useRender();
  const my = S.myStatus.items;
  const row = (s: Dict) => {
    const c = contact(s.contactId), last = s.items[s.items.length - 1];
    const idx = S.statuses.indexOf(s);
    return (
      <div key={idx} className="chat-item" data-act="viewstatus" data-idx={idx} onClick={() => openStatus(idx)}>
        <RingAvatar o={c} count={s.items.length} viewed={!!s.viewed} />
        <div className="ci-body"><div className="ci-name">{c?.name}{s.business ? <> <span className="pill biz">Business</span></> : null}</div><div className="ci-preview">{last ? listTime(last.t) : ''}</div></div>
      </div>
    );
  };
  const recent = S.statuses.filter((s) => !s.viewed), viewed = S.statuses.filter((s) => s.viewed);
  const lastMine = my[my.length - 1];
  return (
    <>
      <header className="side-head"><h2>Status</h2>
        <div className="head-actions">
          <button className="icon-btn" data-act="voicestatus" title="Voice status" aria-label="Record voice status" onClick={voiceStatusModal}><Icon name="mic" /></button>
          <button className="icon-btn" data-act="addstatus" title="Add status" aria-label="Add status" onClick={addStatusModal}><Icon name="add" /></button>
        </div>
      </header>
      <div className="side-scroll">
        <div className="chat-item" data-act={my.length ? 'viewmystatus' : 'addstatus'} onClick={() => (my.length ? openMyStatus() : addStatusModal())}>
          {my.length ? <RingAvatar o={S.me} count={my.length} viewed={false} /> : <div className="av-wrap"><Avatar o={S.me} /><span className="av-plus"><Icon name="add" size={14} /></span></div>}
          <div className="ci-body"><div className="ci-name">My status</div><div className="ci-preview">{lastMine ? listTime(lastMine.t) + ' · ' + privacyLabel(lastMine.privacy) : 'Click to add status update'}</div></div>
          {my.length ? <button className="icon-btn accent" data-act="addstatus" title="Add another" aria-label="Add another status" onClick={(e) => { e.stopPropagation(); addStatusModal(); }}><Icon name="add" /></button> : null}
        </div>
        {recent.length ? <><div className="list-label">Recent updates</div>{recent.map(row)}</> : null}
        {viewed.length ? <><div className="list-label">Viewed updates</div>{viewed.map(row)}</> : null}
        <Slot name="status.extra" />
        <div className="hint-box"><Icon name="lock" size={16} /><span>Status updates are end-to-end encrypted. Choose who sees each one: Everyone, Contacts, Selected, Close friends or Only me.</span></div>
      </div>
    </>
  );
}

// ---------- viewer
export function openStatus(idx: number) {
  const order = [...S.statuses.filter((s) => !s.viewed), ...S.statuses.filter((s) => s.viewed)];
  const owners: StoryOwner[] = order.map((s) => ({ ref: s, who: (contact(s.contactId) || { id: s.contactId, name: 'Unknown' }) as StoryOwner['who'], items: s.items }));
  M.story = { owners, oi: Math.max(0, order.indexOf(S.statuses[idx])), ii: 0, gen: 0 };
  renderStory();
}
export function openMyStatus() {
  if (!S.myStatus.items.length) return addStatusModal();
  M.story = { owners: [{ ref: null, who: S.me as StoryOwner['who'], items: S.myStatus.items, mine: true }], oi: 0, ii: 0, gen: 0 };
  renderStory();
}
/** Show the current item: marks it seen, runs the view hooks and restarts the 5 s timer (via the overlay). */
export function renderStory() {
  const st = M.story;
  if (!st) return bump();
  st.gen++; st.paused = false;
  const o = st.owners[st.oi], it = o.items[st.ii];
  if (!it) return closeStory();
  if (o.ref && st.ii === o.items.length - 1) o.ref.viewed = true;
  if (o.mine) it.views = it.views || 0;
  storyViewHooks.forEach((h) => h(o, it));
  bump();
}
export function storyNext() {
  const st = M.story; if (!st) return;
  if (st.ii < st.owners[st.oi].items.length - 1) st.ii++;
  else if (st.oi < st.owners.length - 1) { st.oi++; st.ii = 0; }
  else return closeStory();
  renderStory();
}
export function storyPrev() {
  const st = M.story; if (!st) return;
  if (st.ii > 0) st.ii--;
  else if (st.oi > 0) { st.oi--; st.ii = 0; }
  renderStory();
}
function pauseStory() { if (M.story) { M.story.paused = true; bump(); } }
export function closeStory() { M.story = null; bump(); commit(); }

export async function storyReply(text: string) {
  const st = M.story; if (!st) return;
  const o = st.owners[st.oi], it = o.items[st.ii];
  if (o.mine || !text) return;
  for (const h of storyReplyHooks) if (await h(o, text)) return;
  const ch = directChatFor(o.who.id);
  if (!ch) return;
  const m = sendMsg(ch, { type: 'text', text, statusQuote: { who: o.who.name, text: it.text || it.caption || 'Photo', bg: it.bg || it.art?.bg || '#333' } });
  scheduleReply(ch, m);
  toast('Reply sent to ' + o.who.name);
}
function deleteMyStatus() {
  const st = M.story; if (!st) return;
  const it = S.myStatus.items[st.ii];
  S.myStatus.items.splice(st.ii, 1);
  commit(); closeStory(); toast('Status deleted');
  if (it) storyDeleteHooks.forEach((h) => h(it));
}

function VoiceStory({ it }: { it: Dict }) {
  const bars = Array.from({ length: 34 }, (_, i) => 8 + (hash((it.t || 0) + ':' + i) % 40));
  return (
    <div className="story-voice">
      <div className="sv-mic"><Icon name="mic" size={40} /></div>
      <div className="sv-wave">{bars.map((h, i) => <i key={i} style={{ height: h }} />)}</div>
      <div className="sv-dur">🎤 Voice status · {fmtDur(it.dur || 0)}</div>
      {it.src ? <audio src={it.src} autoPlay /> : <button className="btn sm" data-act="svplay" onClick={() => { if (it.caption) readAloud(it.caption); }}>🔊 Play</button>}
    </div>
  );
}

function StoryView({ st }: { st: StoryState }) {
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const o = st.owners[st.oi], it = o.items[st.ii];
  const send = () => { const t = reply.trim(); if (!t) return; storyReply(t); setReply(''); storyNext(); };
  if (!it) return null;
  return (
    <div id="story" className={`story ${paused ? 'paused' : ''}`}>
      <div className="story-inner">
        <div className="story-bars">{o.items.map((_, i) => <div key={i} className="sbar"><div className={`sfill ${i < st.ii ? 'done' : i === st.ii ? 'run' : ''}`} /></div>)}</div>
        <div className="story-head">
          <Avatar o={o.who} size={40} />
          <div className="grow">
            <div className="sh-name">{o.mine ? 'My status' : o.who.name}{o.ref?.business ? <> · <span className="pill biz">Business</span></> : null}</div>
            <div className="sh-time">{listTime(it.t)}{it.privacy ? ' · ' + privacyLabel(it.privacy) : ''}</div>
          </div>
          {o.mine ? <button className="icon-btn light" data-act="story-delete" aria-label="Delete status" onClick={deleteMyStatus}><Icon name="delete" /></button> : null}
          <button className="icon-btn light" data-act="story-close" aria-label="Close" onClick={closeStory}><Icon name="close" /></button>
        </div>
        <div className="story-stage" style={{ background: it.type === 'text' ? it.bg : '#000' }}>
          {it.type === 'voice' ? <VoiceStory it={it} />
            : it.type === 'text' ? <div className="story-text" dangerouslySetInnerHTML={{ __html: fmtText(it.text || '') }} />
              : it.src ? <img src={it.src} alt="" />
                : <div className="story-art" style={{ background: it.art?.bg }}><span>{it.art?.emoji || it.art?.e}</span></div>}
          {it.caption ? <div className="story-caption">{it.caption}</div> : null}
          <button className="story-nav prev" data-act="story-prev" aria-label="Previous" onClick={storyPrev} />
          <button className="story-nav next" data-act="story-next" aria-label="Next" onClick={storyNext} />
        </div>
        <div className="story-foot">
          {o.mine ? (
            <div className="story-views">👁 {it.views} view{it.views === 1 ? '' : 's'}<Slot name="story.mine" item={it} /></div>
          ) : (
            <>
              <div className="story-reacts">{['❤️', '😂', '😮', '🔥', '👏', '🙏'].map((e) => <button key={e} data-act="story-react" data-e={e} aria-label={`React ${e}`} onClick={() => storyReply(e)}>{e}</button>)}</div>
              <div className="story-reply">
                <input id="story-input" placeholder={`Reply to ${o.who.name.split(' ')[0]}…`} autoComplete="off" value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onFocus={() => { setPaused(true); pauseStory(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
                <button className="icon-btn light" data-act="story-send" aria-label="Send reply" onClick={send}><Icon name="send" /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
type StoryState = NonNullable<typeof M.story>;

/** Always-mounted story overlay: 5 s auto-advance, arrow keys, Escape. */
export function StoryOverlay() {
  useMedia(); useRender();
  const st = M.story;
  const gen = st?.gen, paused = st?.paused;
  useEffect(() => {
    if (!M.story || paused) return;
    const t = setTimeout(storyNext, 5000);
    return () => clearTimeout(t);
  }, [gen, paused, st]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!M.story || M.lightbox) return;
      const tgt = e.target as HTMLElement;
      if (e.key === 'Escape') { if (!modalOpen() && !document.getElementById('menu')) closeStory(); return; }
      if (tgt?.matches?.('input')) return;
      if (e.key === 'ArrowRight') storyNext();
      if (e.key === 'ArrowLeft') storyPrev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!st) return null;
  return <StoryView key={`${st.oi}:${st.ii}:${st.gen}`} st={st} />;
}

// ---------- new status
const BGS = ['#5e35b1', '#1565d8', '#e91e63', '#0288d1', '#f4511e', '#37474f', '#c2185b'];
function postItem(item: Dict) {
  S.myStatus.items.push(item);
  commit();
  statusPostedHooks.forEach((h) => h(item));
}
function simulateViews(item: Dict, privacy: string) {
  // demo-only simulated views; signed-in accounts get real view counts from the live layer
  if (liveOn()) return;
  [3000, 7000, 12000].forEach((d) => setTimeout(() => { if (privacy !== 'private') { item.views++; commit(); } }, d));
}

export function addStatusModal() {
  const ref = { mode: 'text', bg: BGS[0], photo: null as string | null };
  function Body() {
    const [mode, setMode] = useState('text');
    const [bg, setBg] = useState(BGS[0]);
    const [photo, setPhoto] = useState<string | null>(null);
    const [place, setPlace] = useState('');
    const seg = (k: string, l: string) => <button className={mode === k ? 'on' : ''} data-st={k} onClick={() => { ref.mode = k; setMode(k); }}>{l}</button>;
    return (
      <>
        <div className="seg">{seg('text', 'Text')}{seg('photo', 'Photo')}{seg('link', 'Link')}{seg('location', 'Location')}</div>
        <div id="st-text-wrap" hidden={mode !== 'text'}>
          <textarea id="st-text" className="status-compose" style={{ background: bg }} rows={4} maxLength={400} placeholder="Type a status" autoFocus />
          <div className="swatches">{BGS.map((c) => <button key={c} className={`swatch ${bg === c ? 'on' : ''}`} style={{ background: c }} data-bg={c} aria-label={`Background ${c}`} onClick={() => { ref.bg = c; setBg(c); }} />)}</div>
        </div>
        <div id="st-photo-wrap" hidden={mode !== 'photo'}>
          <div className="media-preview" id="st-prev">
            {photo ? <img src={photo} alt="" /> : (
              <button className="btn" id="st-pick" onClick={async () => {
                const files = await pickFile({ accept: 'image/*' });
                if (!files[0]) return;
                try { const p = await readImage(files[0], 1080); ref.photo = p; setPhoto(p); } catch { toast('Could not read that image'); }
              }}><Icon name="image" size={18} /> Choose photo</button>
            )}
          </div>
          <label className="field"><span>Caption</span><input id="st-cap" maxLength={200} /></label>
        </div>
        <div id="st-link-wrap" hidden={mode !== 'link'}>
          <label className="field"><span>Link</span><input id="st-url" type="url" placeholder="https://" autoComplete="off" /></label>
          <label className="field"><span>Say something about it</span><input id="st-ltitle" maxLength={120} /></label>
        </div>
        <div id="st-location-wrap" hidden={mode !== 'location'}>
          <label className="field"><span>Place</span><input id="st-place" maxLength={80} placeholder="e.g. Inorbit Mall, Madhapur" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          <button className="btn sm" id="st-here" onClick={async () => { const p = await getPosition(); setPlace(p.demo ? 'Gachibowli, Hyderabad' : `Near ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`); }}><Icon name="place" size={16} /> Use my current location</button>
        </div>
        <label className="field"><span>Who can see this?</span>
          <select id="st-priv" defaultValue={S.settings.privacy.status}>{PRIVACY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </>
    );
  }
  modal({
    title: 'New status',
    body: <Body />,
    actions: [{ label: 'Cancel' }, {
      label: 'Post', primary: true, onClick: (root) => {
        const val = (id: string) => (root.querySelector<HTMLInputElement>('#' + id)?.value || '').trim();
        const privacy = root.querySelector<HTMLSelectElement>('#st-priv')!.value, t = Date.now(), bg = ref.bg;
        let item: Dict;
        if (ref.mode === 'text') { const text = val('st-text'); if (!text) { toast('Type something first'); return false; } item = { type: 'text', text, bg, t, privacy, views: 0 }; }
        else if (ref.mode === 'link') { const url = val('st-url'), tt = val('st-ltitle'); if (!/^https?:\/\/\S+\.\S+/.test(url)) { toast('Enter a link starting with https://'); return false; } item = { type: 'text', text: `🔗 ${tt || 'Check this out'}\n${url}`, link: url, bg, t, privacy, views: 0 }; }
        else if (ref.mode === 'location') { const place = val('st-place'); if (!place) { toast('Add a place'); return false; } item = { type: 'text', text: `📍 ${place}`, bg: '#2e7d32', t, privacy, views: 0 }; }
        else { if (!ref.photo) { toast('Choose a photo'); return false; } item = { type: 'image', src: ref.photo, caption: val('st-cap'), t, privacy, views: 0 }; }
        postItem(item);
        toast('Status posted · ' + privacyLabel(privacy));
        simulateViews(item, privacy);
      },
    }],
  });
}

// ---------- voice status (up to 60 s)
export function voiceStatusModal() {
  const r: { rec: MediaRecorder | null; chunks: Blob[]; start: number; timer?: ReturnType<typeof setInterval>; stream: MediaStream | null } = { rec: null, chunks: [], start: 0, stream: null };
  const stopAll = () => { clearInterval(r.timer); r.stream?.getTracks().forEach((t) => t.stop()); };
  function Body() {
    const [live, setLive] = useState(false);
    const [msg, setMsg] = useState('Tap to record up to 60 seconds');
    const [time, setTime] = useState('0:00 / 1:00');
    const el = useRef<HTMLDivElement>(null);
    const begin = async () => {
      if (r.start) return;
      let sim = false;
      try {
        r.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        r.rec = new MediaRecorder(r.stream);
        r.rec.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
        r.rec.start();
      } catch { sim = true; }
      r.start = nowMs();
      setLive(true);
      setMsg(sim ? 'Recording (simulated — microphone unavailable). Tap Post when done.' : 'Recording… tap Post when done');
      r.timer = setInterval(() => {
        const s = (Date.now() - r.start) / 1000;
        setTime(`${fmtDur(s)} / 1:00`);
        if (s >= 60) el.current?.closest('.modal-backdrop')?.querySelector<HTMLButtonElement>('[data-mact="1"]')?.click();
      }, 250);
    };
    return (
      <>
        <div className="vs-rec" ref={el}>
          <button className={`vs-btn ${live ? 'live' : ''}`} id="vs-btn" aria-label="Start recording" onClick={begin}><Icon name="mic" size={36} /></button>
          <div className="rec-time" id="vs-t">{time}</div>
          <p className="muted small" id="vs-msg">{msg}</p>
        </div>
        <label className="field"><span>Who can hear this?</span>
          <select id="vs-priv" defaultValue={S.settings.privacy.status}>{PRIVACY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </>
    );
  }
  modal({
    title: '🎤 Voice status',
    body: <Body />,
    onClose: stopAll,
    actions: [{ label: 'Cancel', onClick: () => { stopAll(); try { r.rec?.stop(); } catch { /* ignore */ } } }, {
      label: 'Post', primary: true, onClick: (root) => {
        if (!r.start) { toast('Record something first'); return false; }
        const dur = Math.max(1, Math.round((Date.now() - r.start) / 1000)), privacy = root.querySelector<HTMLSelectElement>('#vs-priv')!.value;
        const post = (src: string | null) => {
          postItem({ type: 'voice', src, dur: Math.min(60, dur), t: Date.now(), privacy, views: 0, caption: src ? '' : 'Voice status recorded on WHATSMORE' });
          toast('🎤 Voice status posted · ' + privacyLabel(privacy));
        };
        stopAll();
        r.start = 0;
        const rec = r.rec;
        if (rec && rec.state !== 'inactive') {
          rec.onstop = () => { const fr = new FileReader(); fr.onload = () => post(fr.result as string); fr.readAsDataURL(new Blob(r.chunks, { type: rec.mimeType || 'audio/webm' })); };
          rec.stop();
        } else post(null);
      },
    }],
  });
}
