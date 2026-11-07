'use client';
/* eslint-disable react-hooks/immutability -- views mutate the shared S/ui store, then commit() (see PORTING.md) */
// Learn (+ upload a chapter, cloudplus.js), News & Channels (+ report / Creator verified, superapp.js),
// My Area, Creator Studio and Voice Rooms (js/modules.js).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { S, commit } from '@/lib/state';
import { modal, toast, pickFile } from '@/lib/overlay';
import { act } from '@/lib/registry';
import { switchProfile } from '@/lib/profiles';
import { readAloud } from '@/lib/translate';
import { MIN, COLORS, money, listTime, hash } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Kpi, Note } from '@/components/ui/Bits';
import { MS, UL } from './shared';
import { TOPICS, Quiz, newQuiz } from './ai';

// ---------- LEARN
const learnState = () => MS('learn', () => ({ topic: 'photosynthesis', lang: 'en', quiz: null } as any));
async function lnUpload() {
  const f = (await pickFile())[0];
  if (!f) return;
  const st = learnState();
  st.pdf = { name: f.name, size: f.size };
  st.topic = 'chapter'; st.quiz = null;
  commit();
  toast(`📄 ${f.name} read by AI · chapter detected`);
}
function lnQuiz() { const st = learnState(); st.quiz = newQuiz(st.topic); commit(); }

export function LearnView() {
  const st = learnState();
  const T = TOPICS[st.topic] || TOPICS.photosynthesis;
  const [joined, setJoined] = useState<string[]>([]);
  return (
    <>
      {st.pdf ? (
        <>
          <div className="cloud-card"><span className="doc-icon ext-pdf">PDF</span><div className="grow"><b>{st.pdf.name}</b><div className="ci-sub">AI detected chapter: Photosynthesis · 20 quiz questions ready (demo uses a sample chapter)</div></div></div>
          <div className="btn-row left"><button className="btn sm" data-act="lnexplainte" onClick={() => { st.lang = 'te'; commit(); }}>Explain this chapter in simple Telugu</button><button className="btn sm primary" data-act="lnquiz" onClick={lnQuiz}>Create 20 multiple-choice questions</button></div>
        </>
      ) : null}
      <Sec title="AI tutor">
        <div className="chips wrap">
          {Object.entries(TOPICS).map(([k, t]) => <button key={k} className={`chip ${st.topic === k ? 'on' : ''}`} data-act="lntopic" data-t={k} onClick={() => { st.topic = k; st.quiz = null; commit(); }}>{t.title}</button>)}
          <button className="chip" data-act="lnupload" onClick={lnUpload}><Icon name="upload" size={14} /> Upload a chapter (PDF)</button>
        </div>
        <div className="tutor">
          <div className="row-between"><b>{T.title}</b><div className="seg sm">{[['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी']].map(([k, l]) => <button key={k} className={st.lang === k ? 'on' : ''} data-act="lnlang" data-l={k} onClick={() => { st.lang = k; commit(); }}>{l}</button>)}</div></div>
          <p>{T.explain[st.lang]}</p>
          <div className="btn-row left"><button className="btn sm" data-act="lnsay" onClick={() => readAloud(T.explain[st.lang])}>🔊 Listen</button><button className="btn sm primary" data-act="lnquiz" onClick={lnQuiz}>📝 Generate quiz</button></div>
          {st.quiz ? <div className="quiz-box"><Quiz id={st.quiz} /></div> : null}
        </div>
      </Sec>
      <Sec title="Study groups">
        {[['📐', 'Class 10 Maths — Hyderabad', '1,240 students · 3 teachers'], ['⚖️', 'CLAT 2027 Prep', '8,900 members · daily quiz'], ['💻', 'Learn Python in Telugu', '3,410 members · live class Sat 6 PM']].map(([e, n, s]) => (
          <div className="set-row" key={n}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{n}</div><div className="ci-sub">{s}</div></div>
            <button className="btn sm" data-act="lnjoin" disabled={joined.includes(n)} onClick={() => { setJoined([...joined, n]); toast('Joined study group'); }}>{joined.includes(n) ? 'Joined ✓' : 'Join'}</button></div>
        ))}
      </Sec>
      <Sec title="For teachers"><UL items={['📢 Class groups and announcements', '📚 Assignments with due dates and auto-reminders', '🎥 Live classes with screen sharing', '🧠 AI-generated quizzes from any PDF']} /></Sec>
    </>
  );
}

// ---------- NEWS & CHANNELS
const BADGES: Record<string, [string, string]> = { gov: ['Government', '#1565c0'], official: ['Official', '#2e7d32'], news: ['News organisation', '#6d4c41'], verified: ['Verified', '#1a73e8'], biz: ['Business verified', '#f4511e'], creator: ['Creator verified', '#8e24aa'] };
const CHANNELS = [
  { id: 'n1', name: 'India Today Updates', badge: 'news', cat: 'National', followers: '2.4M', posts: ['Parliament winter session to begin on 24 November', 'Monsoon withdraws from the country; IMD forecasts a cold winter'] },
  { id: 'n2', name: 'Telangana Govt Updates', badge: 'gov', cat: 'State', followers: '880K', posts: ['New online portal for income certificates is live', 'Free health camps across all districts this Sunday'] },
  { id: 'n3', name: 'Hyderabad Traffic Police', badge: 'official', cat: 'District', followers: '410K', posts: ['Diversions near Hitech City for metro work till Friday', 'Wear a helmet — e-challans now sent on WHATSMORE'] },
  { id: 'n4', name: 'Cricket Live', badge: 'verified', cat: 'Sports', followers: '5.1M', posts: ['India win the series 3–1! 🏏', 'Squad announced for the next tour'] },
  { id: 'n5', name: 'TechGuru Kiran', badge: 'creator', cat: 'Technology', followers: '96K', posts: ['5 privacy settings you should turn on today 🔐', 'Review: the best budget phones of 2026'] },
  { id: 'n6', name: 'Sunrise Bakery', badge: 'biz', cat: 'Business', followers: '12K', posts: ['🎂 20% off all cakes this weekend', 'New: matcha croissants 🥐'] },
  { id: 'n7', name: 'Kisan Mitra', badge: 'verified', cat: 'Agriculture', followers: '640K', posts: ['Paddy procurement price updated for this season', 'Weather alert: light rain expected in coastal districts'] },
];
type Channel = (typeof CHANNELS)[number];
function Badge({ c }: { c: Channel }) {
  return <span className="vbadge" style={{ ['--b' as string]: BADGES[c.badge][1] }}><Icon name="verified" size={12} /> {BADGES[c.badge][0]}</span>;
}
function nwCreate() {
  modal({
    title: 'Create a channel',
    body: <><label className="field"><span>Channel name</span><input id="nc-n" autoFocus /></label><label className="field"><span>Category</span><select><option>Local</option><option>Education</option><option>Business</option><option>Entertainment</option></select></label><p className="muted small">New channels start unverified. Apply for a badge from channel settings with supporting documents.</p></>,
    actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: () => toast('Channel created · followers can find it by search') }],
  });
}
export function NewsView() {
  const st = MS('news', () => ({ cat: 'All', follow: ['n2', 'n3', 'n6'] } as any));
  const cats = ['All', ...new Set(CHANNELS.map((c) => c.cat))];
  const list = CHANNELS.filter((c) => st.cat === 'All' || c.cat === st.cat);
  const feed = CHANNELS.filter((c) => st.follow.includes(c.id)).flatMap((c, i) => c.posts.map((p, j) => ({ c, p, t: Date.now() - (i * 2 + j + 1) * 47 * MIN }))).sort((a, b) => b.t - a.t);
  const follow = (id: string) => { st.follow = st.follow.includes(id) ? st.follow.filter((x: string) => x !== id) : [...st.follow, id]; commit(); };
  return (
    <>
      <div className="chips wrap">{cats.map((c) => <button key={c} className={`chip ${st.cat === c ? 'on' : ''}`} data-act="nwcat" data-c={c} onClick={() => { st.cat = c; commit(); }}>{c}</button>)}</div>
      <Sec title="Channels" extra={<button className="link-btn" data-act="nwcreate" onClick={nwCreate}>+ Create channel</button>}>
        {list.map((c) => (
          <div className="set-row" key={c.id}><span className="mod-ic" style={{ background: BADGES[c.badge][1] }}><Icon name="news" size={18} /></span><div className="grow"><div className="ci-name">{c.name}</div><div className="ci-sub"><Badge c={c} /> · {c.followers} followers</div></div>
            <button className="icon-btn sm" data-act="reportchannel" data-c={c.id} title="Report channel" aria-label="Report channel" onClick={() => act.reportTarget({ kind: 'channel', name: c.name, defaultCat: 'Spam' })}><Icon name="warning" size={16} /></button>
            <button className={`btn sm ${st.follow.includes(c.id) ? '' : 'primary'}`} data-act="nwfollow" data-c={c.id} onClick={() => follow(c.id)}>{st.follow.includes(c.id) ? 'Following' : 'Follow'}</button></div>
        ))}
      </Sec>
      <Sec title="Your feed">
        {feed.length ? feed.map(({ c, p, t }) => (
          <div className="post" key={c.id + p}><div className="row-between"><b>{c.name}</b><Badge c={c} /></div><p>{p}</p><div className="ci-sub">{listTime(t)} · 👍 {(hash(p) % 900) + 100} · 🔁 {(hash(p + 1) % 90) + 10}</div></div>
        )) : <p className="muted">Follow channels to see posts</p>}
      </Sec>
      <Note ic="verified">Verification badges follow documented criteria: Government (authorised department), Official (registered organisation), News organisation (registered publisher), Verified (identity checked), Business verified (registered business), Creator verified (creator identity and audience checked). Nobody can simply claim official status.</Note>
    </>
  );
}

// ---------- MY AREA
const AREAS = ['Gachibowli', 'Madhapur', 'Kukatpally', 'Banjara Hills', 'Secunderabad'];
function areaPost() {
  modal({
    title: 'Post to My Area',
    body: <><label className="field"><span>Type</span><select><option>Announcement</option><option>Event</option><option>Job</option><option>Lost &amp; found</option></select></label><label className="field"><span>Details</span><textarea rows={3} autoFocus /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Post', primary: true, onClick: () => toast('Posted to your locality · moderated by community admins') }],
  });
}
export function AreaView() {
  const st = MS('area', () => ({ area: 'Gachibowli', tab: 'jobs' } as any));
  const [done, setDone] = useState<string[]>([]);
  const A2 = st.area;
  const data: Record<string, string[][]> = {
    jobs: [['💼', 'Front-end developer (React)', `TechNova · ${A2} · ₹8–12 LPA`], ['🛵', 'Delivery partner', `Spice Route Kitchen · ${A2} · ₹22,000/month`], ['📚', 'Maths tutor (Class 8–10)', `Home tuition · ${A2} · ₹500/hour`]],
    events: [['🎶', 'Sunday music evening', `Community Park, ${A2} · Sun 6 PM`], ['🏃', '5K fun run', `${A2} lake · Sat 6 AM · free`], ['🧘', 'Free yoga camp', 'Community Hall · daily 7 AM']],
    shops: [['🥐', 'Sunrise Bakery', '0.8 km · open till 9 PM · ⭐ 4.7'], ['🛒', 'Metro Kirana Store', '0.3 km · home delivery'], ['💊', 'Apollo-style Pharmacy', '0.5 km · 24×7']],
    services: [['🔧', 'QuickFix plumber', 'Arrives in 2 hours · ⭐ 4.4'], ['🚗', 'Car wash at home', '₹399 · book a slot'], ['🐶', 'Pet grooming', 'Doorstep · weekends']],
    notices: [['📢', 'Water supply off Sunday 10 AM–2 PM', 'Green Valley Residents'], ['🚧', 'Road repair on Main Street', 'Municipal Corporation'], ['🗳️', 'Residents association meeting', 'Saturday 5 PM · Clubhouse']],
    lost: [['🐕', 'Lost: brown Labrador "Bruno"', `Near ${A2} metro · call via WHATSMORE`], ['👛', 'Found: black wallet', 'Handed to the security desk, Block C'], ['🔑', 'Lost: car keys (Honda)', 'Near the park gate']],
  };
  const tabs = [['jobs', 'Jobs'], ['events', 'Events'], ['shops', 'Shops'], ['services', 'Services'], ['notices', 'Announcements'], ['lost', 'Lost & found']];
  const label = st.tab === 'jobs' ? 'Apply' : st.tab === 'shops' || st.tab === 'services' ? 'Chat' : st.tab === 'events' ? 'Going' : 'View';
  return (
    <>
      <div className="row-between"><label className="area-pick"><Icon name="place" size={18} /><select id="area-sel" value={A2} onChange={(e) => { st.area = e.target.value; setDone([]); commit(); }}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select><span className="ci-sub">Hyderabad</span></label><button className="btn sm primary" data-act="areapost" onClick={areaPost}>+ Post</button></div>
      <div className="chips wrap mt">{tabs.map(([k, l]) => <button key={k} className={`chip ${st.tab === k ? 'on' : ''}`} data-act="areatab" data-t={k} onClick={() => { st.tab = k; setDone([]); commit(); }}>{l}</button>)}</div>
      <div className="vsec">
        {(data[st.tab] || []).map(([e, t, s]) => {
          const k = st.tab + ':' + t;
          return <div className="set-row" key={k}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{t}</div><div className="ci-sub">{s}</div></div><button className="btn sm" data-act="areaact" disabled={done.includes(k)} onClick={() => setDone([...done, k])}>{done.includes(k) ? '✓ Done' : label}</button></div>;
        })}
      </div>
      <Note ic="place"><>Showing posts near <b>{A2}</b>. Your exact location is never shown to others — you choose your locality.</></Note>
    </>
  );
}

// ---------- CREATOR STUDIO
function LiveBox({ onEnd }: { onEnd: () => void }) {
  const [n, setN] = useState(128);
  useEffect(() => { const t = setInterval(() => setN((v) => Math.max(40, v + Math.floor(Math.random() * 30) - 9)), 1500); return () => clearInterval(t); }, []);
  return <div className="live-box"><span className="live-dot" /><b>You are LIVE</b> · <span id="live-n">{n}</span> watching<button className="btn sm danger" data-act="crlive" onClick={onEnd}>End live</button></div>;
}
function crPost() {
  modal({
    title: 'Publish',
    body: <><label className="field"><span>Post</span><textarea rows={4} autoFocus placeholder="Share something with your followers" /></label><label className="radio-row"><input type="checkbox" /> Subscribers only (premium)</label></>,
    actions: [{ label: 'Cancel' }, { label: 'Publish', primary: true, onClick: () => toast('Published to 12.4K followers') }],
  });
}
export function CreatorView() {
  const st = MS('creator', () => ({ live: false } as any));
  const crLive = () => { st.live = !st.live; commit(); toast(st.live ? '🔴 You are live — followers are notified' : 'Live ended · 1,240 people watched'); };
  return (
    <>
      <div className="biz-head"><Avatar o={S.me} size={56} /><div className="grow"><div className="ci-name">{S.me.name} <Icon name="verified" size={16} cls="accent" /></div><div className="ci-sub">Creator · @{S.me.username} · Design &amp; tech tips</div></div><button className="btn sm" data-act="setprofile" data-p="creator" onClick={() => switchProfile('creator')}>Use creator profile</button></div>
      <div className="kpi-grid"><Kpi label="Followers" value="12.4K" delta="+320" /><Kpi label="Subscribers" value="860" delta="+42" /><Kpi label="Views (30d)" value="1.2M" delta="+12%" /><Kpi label="Revenue (30d)" value={money(48200)} delta="+9%" /><Kpi label="Engagement" value="6.8%" delta="+0.4" /><Kpi label="Tips" value={money(3150)} delta="+11" /></div>
      {st.live ? <LiveBox onEnd={crLive} /> : <div className="btn-row left"><button className="btn primary" data-act="crlive" onClick={crLive}>🔴 Go live</button><button className="btn" data-act="crpost" onClick={crPost}>+ Publish post</button></div>}
      <Sec title="Content performance">
        {[['🎥', '10 UI tricks in 60 seconds', '312K views · 8.1% engagement'], ['🎙️', 'Podcast: designing for Bharat', '48K listens · 1,204 comments'], ['📸', 'My desk setup 2026', '96K views · 5.2% engagement']].map(([e, t, s]) => <div className="set-row" key={t}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{t}</div><div className="ci-sub">{s}</div></div></div>)}
      </Sec>
      <Sec title="Paid community"><div className="set-row"><span className="big-emoji">⭐</span><div className="grow"><div className="ci-name">Design Insiders</div><div className="ci-sub">{money(149)}/month · 860 subscribers · weekly live Q&amp;A</div></div><span className="pill">Active</span></div></Sec>
    </>
  );
}

// ---------- VOICE ROOMS
const ROOMS: [string, string, string, number][] = [['🎙️', 'Startup stories in Telugu', 'Siva', 342], ['🏏', 'Match analysis — live', 'Cricket Live', 2140], ['📚', 'CLAT doubt-clearing room', 'CLAT 2027 Prep', 516], ['🎵', 'Old Hindi songs request night', 'Retro Radio', 1203]];
function Room({ speakers, n }: { speakers: string[]; n: number }) {
  const [talk, setTalk] = useState(0);
  useEffect(() => { const t = setInterval(() => setTalk(Math.floor(Math.random() * speakers.length)), 1400); return () => clearInterval(t); }, [speakers.length]);
  return (
    <>
      <div className="room">{speakers.map((s, i) => <div key={s} className={`spk ${i === talk ? 'talking' : ''}`}><Avatar o={{ name: s, color: COLORS[i + 2] }} size={64} /><span>{s}{i === 0 ? ' · host' : ''}</span></div>)}</div>
      <p className="muted center-t">{n.toLocaleString()} listening · you are muted</p>
    </>
  );
}
function vrJoin(i: number) {
  const [e, t, hst, n] = ROOMS[i];
  modal({
    title: `${e} ${t}`, wide: true, body: <Room speakers={[hst, 'Ananya', 'Rahul', 'Meera']} n={n} />,
    actions: [{ label: '✋ Raise hand', onClick: () => { toast('Hand raised — the host can invite you to speak'); return false; } }, { label: 'Leave quietly', primary: true }],
  });
}
export function VoiceView() {
  return (
    <>
      <Sec title="Live now" extra={<button className="link-btn" data-act="vrstart" onClick={() => toast('🎙️ Room created — share the link to invite listeners')}>+ Start a room</button>}>
        {ROOMS.map(([e, t, hst, n], i) => <div className="set-row" key={t}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{t} <span className="live-tag">LIVE</span></div><div className="ci-sub">Hosted by {hst} · {n.toLocaleString()} listening</div></div><button className="btn sm primary" data-act="vrjoin" data-i={i} onClick={() => vrJoin(i)}>Join</button></div>)}
      </Sec>
      <Sec title="Voice status & podcasts">
        <UL items={[<>🎤 Post a <b>voice status</b> — up to 60 seconds</>, '🎧 Publish short audio programmes to followers', '👥 Community audio rooms with moderators and raise-hand']} />
        <button className="btn sm" data-act="vrstatus" onClick={() => act.voiceStatusModal()}>🎤 Record voice status</button>
      </Sec>
    </>
  );
}
