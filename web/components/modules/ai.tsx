'use client';
// WHATSMORE AI: AI tab, AI main view, rule-based answers (translate, summarize, write, learn, quiz,
// status creator, spending, scam check, reminders) and chat summaries. Ported from js/modules.js (+ cloudplus.js).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { S, ui, commit, refresh, save } from '@/lib/state';
import { openView, openPage, closeView } from '@/lib/nav';
import { modal, toast, copyText } from '@/lib/overlay';
import { sendMsg } from '@/lib/actions';
import { uid, DAY, money, fmtTime, chatTitle, lastTime, firstName, senderName, preview } from '@/lib/util';
import { LANG_LIST, translateText } from '@/lib/translate';
import { scamCheck } from '@/lib/scam';
import type { Chat, Message } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { MS, h, b, ul, renderRich, richActs, chatPicker, gochat, type RN } from './shared';
import { seedFamily } from './family';

// ---------- topics for the tutor and quizzes
export const TOPICS: Record<string, { title: string; explain: Record<string, string>; qs: [string, string[], number][] }> = {
  photosynthesis: {
    title: 'Photosynthesis',
    explain: {
      en: 'Photosynthesis is how plants make their own food. Using sunlight, water and carbon dioxide, the green pigment chlorophyll in leaves makes glucose (food) and releases oxygen — the air we breathe. 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.',
      te: 'కిరణజన్య సంయోగక్రియ అంటే మొక్కలు సూర్యరశ్మి, నీరు, కార్బన్ డయాక్సైడ్ ఉపయోగించి తమ ఆహారం (గ్లూకోజ్) తయారు చేసుకోవడం. ఈ పని ఆకుల్లో ఉండే పచ్చని పదార్థం క్లోరోఫిల్ సహాయంతో జరుగుతుంది. ఈ ప్రక్రియలో మొక్కలు ఆక్సిజన్‌ను విడుదల చేస్తాయి — మనం పీల్చే గాలి అదే!',
      hi: 'प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे सूरज की रोशनी, पानी और कार्बन डाइऑक्साइड से अपना भोजन (ग्लूकोज़) बनाते हैं। यह काम पत्तियों में मौजूद हरे पदार्थ क्लोरोफिल की मदद से होता है। इसमें पौधे ऑक्सीजन छोड़ते हैं — वही हवा जिसमें हम सांस लेते हैं!',
    },
    qs: [['Which pigment captures sunlight?', ['Chlorophyll', 'Haemoglobin', 'Melanin', 'Keratin'], 0], ['Which gas do plants take in?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1], ['What food does the plant make?', ['Protein', 'Fat', 'Glucose', 'Vitamin C'], 2], ['Where does it mainly happen?', ['Roots', 'Stem', 'Leaves', 'Flowers'], 2], ['Which gas is released?', ['Oxygen', 'Carbon dioxide', 'Methane', 'Ammonia'], 0]],
  },
  constitution: {
    title: 'The Constitution of India',
    explain: {
      en: 'The Constitution of India came into effect on 26 January 1950. Dr B. R. Ambedkar chaired its Drafting Committee. Part III gives Fundamental Rights, Part IV the Directive Principles, and Article 32 lets citizens go to the Supreme Court to protect their rights.',
      te: 'భారత రాజ్యాంగం 26 జనవరి 1950 నుండి అమల్లోకి వచ్చింది. డా. బి. ఆర్. అంబేద్కర్ ముసాయిదా కమిటీకి అధ్యక్షత వహించారు. మూడవ భాగంలో ప్రాథమిక హక్కులు, నాలుగవ భాగంలో ఆదేశిక సూత్రాలు ఉన్నాయి.',
      hi: 'भारत का संविधान 26 जनवरी 1950 को लागू हुआ। डॉ. बी. आर. आंबेडकर मसौदा समिति के अध्यक्ष थे। भाग III में मौलिक अधिकार और भाग IV में नीति निदेशक तत्व हैं।',
    },
    qs: [['When did the Constitution of India come into effect?', ['15 Aug 1947', '26 Jan 1950', '26 Nov 1949', '2 Oct 1950'], 1], ['Who chaired the Drafting Committee?', ['Jawaharlal Nehru', 'B. R. Ambedkar', 'Rajendra Prasad', 'Sardar Patel'], 1], ['Fundamental Rights are in which Part?', ['Part III', 'Part IV', 'Part I', 'Part V'], 0], ['Right to Constitutional Remedies is Article…', ['14', '19', '21', '32'], 3], ['Directive Principles are in which Part?', ['Part II', 'Part III', 'Part IV', 'Part VI'], 2]],
  },
};
// Learn: your uploaded chapter (cloudplus.js §9)
TOPICS.chapter = {
  title: 'Photosynthesis — your uploaded chapter',
  explain: TOPICS.photosynthesis.explain,
  qs: [...TOPICS.photosynthesis.qs,
    ['What is the main source of energy for photosynthesis?', ['Sunlight', 'Moonlight', 'Heat from soil', 'Wind'], 0],
    ['Through which openings do leaves take in CO₂?', ['Stomata', 'Roots', 'Xylem', 'Petals'], 0],
    ['Which part carries water from roots to leaves?', ['Phloem', 'Xylem', 'Stomata', 'Cuticle'], 1],
    ['In which cell organelle does photosynthesis happen?', ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'], 2],
    ['Plants that make their own food are called…', ['Heterotrophs', 'Autotrophs', 'Parasites', 'Saprophytes'], 1],
    ['Which colour of light is least absorbed by chlorophyll?', ['Red', 'Blue', 'Green', 'Violet'], 2],
    ['Excess glucose is stored in plants as…', ['Starch', 'Protein', 'Fat', 'Vitamin'], 0],
    ['Which test shows starch in a leaf?', ['Iodine test', 'Litmus test', 'Flame test', 'Lime-water test'], 0],
    ['The splitting of water in light is called…', ['Photolysis', 'Respiration', 'Transpiration', 'Osmosis'], 0],
    ['Which gas turns lime water milky?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2],
    ['Photosynthesis mostly happens in which cells of the leaf?', ['Mesophyll', 'Epidermis', 'Root hair', 'Guard cells only'], 0],
    ['Which of these is NOT needed for photosynthesis?', ['Water', 'Carbon dioxide', 'Sunlight', 'Oxygen'], 3],
    ['Desert plants like cactus mainly photosynthesise in their…', ['Roots', 'Stems', 'Flowers', 'Seeds'], 1],
    ['The by-product released into the air is…', ['Oxygen', 'Glucose', 'Water vapour only', 'Nitrogen'], 0],
    ['Who depends on photosynthesis for food?', ['Only plants', 'Only animals', 'Almost all living things', 'Only fungi'], 2],
  ],
};

export const quizStore = () => MS<Record<string, { topic: string; answers: Record<string, number> }>>('quiz', () => ({}));
export function newQuiz(topic: string) { const id = 'q' + uid(); quizStore()[id] = { topic, answers: {} }; return id; }

/** Interactive quiz (quizHTML). */
export function Quiz({ id }: { id: string }) {
  const st = quizStore()[id];
  if (!st || !TOPICS[st.topic]) return null;
  const qs = TOPICS[st.topic].qs, done = Object.keys(st.answers).length;
  const score = Object.entries(st.answers).filter(([i, a]) => qs[+i][2] === a).length;
  const pickOpt = (i: number, j: number) => { if (st.answers[i] != null) return; st.answers[i] = j; commit(); };
  return (
    <>
      📝 <b>Quiz · {TOPICS[st.topic].title}</b> <span className="ci-sub">{done}/{qs.length} answered</span>
      {qs.map(([q, opts, ans], i) => {
        const a = st.answers[i];
        return (
          <div className="quiz-q" key={i}>
            <div><b>{i + 1}.</b> {q}</div>
            <div className="quiz-opts">
              {opts.map((o, j) => (
                <button key={j} className={`qopt ${a != null ? (j === ans ? 'right' : j === a ? 'wrong' : '') : ''}`} data-act="quizpick" data-quiz={id} data-i={i} data-o={j} disabled={a != null} onClick={() => pickOpt(i, j)}>{o}</button>
              ))}
            </div>
          </div>
        );
      })}
      {done === qs.length ? <div className="quiz-score">🏆 Score: {score}/{qs.length} {score === qs.length ? '— perfect!' : score >= 3 ? '— well done!' : '— review and try again'}</div> : null}
    </>
  );
}

// ---------- chat summaries (messaging.js summarize / aiSummaryModal)
type Line = { m: Message; s: string };
export function summarize(ch: Chat) {
  const msgs = ch.messages.filter((m) => m.type !== 'system' && m.type !== 'deleted');
  const txt = (m: Message) => (m.type === 'text' ? m.tr || m.text : m.type === 'doc' ? 'Shared ' + m.name : m.caption || preview(m));
  const lines: Line[] = msgs.map((m) => ({ m, s: String(txt(m) || '') }));
  const grab = (re: RegExp) => lines.filter((l) => re.test(l.s)).slice(-4);
  return {
    count: msgs.length,
    people: [...new Set(msgs.map((m) => senderName(m.from)))],
    key: lines.filter((l) => l.m.type === 'text' && l.s.length > 28).slice(-4),
    announcements: grab(/📢|important|announce|attention|will be off|notice|reminder/i),
    decisions: grab(/decided|decision|final|confirmed|booked|agreed|✅|we take|let's go with/i),
    tasks: grab(/please|pls|don't forget|dont forget|remember|need to|review|pay your|bring|forget/i),
    dates: grab(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2} o'?clock)\b/i),
    polls: msgs.filter((m) => m.type === 'poll').map((m) => { const best = m.options.map((o: string, i: number) => [o, (m.votes[i] || []).length]).sort((a: any, c: any) => c[1] - a[1])[0]; return `“${m.question}” — leading: ${best[0]} (${best[1]} vote${best[1] === 1 ? '' : 's'})`; }),
    pays: msgs.filter((m) => m.type === 'payment').map((m) => `${senderName(m.from)} ${m.kind === 'request' ? 'requested' : 'sent'} ${money(m.amount)}${m.note ? ' — ' + m.note : ''} (${m.status})`),
    files: msgs.filter((m) => m.type === 'doc').map((m) => m.name as string),
    links: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? l.m.text?.match(/https?:\/\/[^\s<]+/g) || [] : [])))].slice(-6),
    mentions: [...new Set(lines.flatMap((l) => (l.m.type === 'text' ? (l.m.text?.match(/@[a-z0-9._]{3,}/gi) || []).map((x) => x.toLowerCase()) : [])))],
    actions: grab(/please|pls|need to|can you|could you|will you|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow)|review|pay your|send|bring|share/i).map((l) => ({ ...l, who: firstName(l.m.from) })),
  };
}
export function aiSummaryModal(ch: Chat) {
  const s = summarize(ch);
  const li = (arr: Line[]) => arr.map((l, i) => <li key={i}><b>{firstName(l.m.from)}:</b> {l.s}</li>);
  const Sec = ({ ic, title, items }: { ic: string; title: string; items: React.ReactNode[] }) => (items.length ? <div className="sum-sec"><div className="sum-title">{ic} {title}</div><ul>{items}</ul></div> : null);
  const plain = (arr: string[]) => arr.map((p, i) => <li key={i}>{p}</li>);
  modal({
    title: '✨ AI summary',
    wide: true,
    body: (
      <>
        <p className="muted">{chatTitle(ch)} · {s.count} messages · {s.people.join(', ')}</p>
        <Sec ic="💬" title="Key discussions" items={li(s.key)} />
        <Sec ic="📢" title="Important announcements" items={li(s.announcements)} />
        <Sec ic="✅" title="Decisions" items={li(s.decisions)} />
        <Sec ic="📝" title="Pending tasks" items={li(s.tasks)} />
        <Sec ic="📅" title="Dates & meetings" items={li(s.dates)} />
        <Sec ic="📊" title="Polls" items={plain(s.polls)} />
        <Sec ic="💳" title="Payments" items={plain(s.pays)} />
        <Sec ic="📎" title="Shared files" items={plain(s.files)} />
        <Sec ic="🔗" title="Important links" items={s.links.map((p, i) => <li key={i}><a href={p} target="_blank" rel="noopener noreferrer">{p}</a></li>)} />
        <Sec ic="👤" title="Mentioned people" items={plain(s.mentions)} />
        <Sec ic="🎯" title="Action items" items={s.actions.map((l, i) => <li key={i}><b>{l.who}</b> raised: {l.s}</li>)} />
        <div className="hint-box"><Icon name="sparkle" size={16} /><span>Demo summary generated on your device with simple rules. A production build would use an on-device or privacy-preserving AI model so encrypted chats stay private.</span></div>
      </>
    ),
    actions: [{ label: 'Done', primary: true }],
  });
}

// ---------- document summary (docs.js demoDocHTML for the PRD + summarizeDoc)
const PRD_HTML = `<h1>WHATSMORE — Product Requirments Document v2</h1><p><b>Owner:</b> Siva · <b>Status:</b> Draft for review</p>
<h2>1. Vision</h2><p>WHATSMORE is more then a chat app. it combines chat , AI, payments and business in one secure platform.</p>
<h2>2. MVP scope</h2><ul><li>Private chat with end-to-end encyption</li><li>Voice and video calls with call links</li><li>Groups with no participant limit</li><li>Username based connection so users dont need to share there phone number</li></ul>
<h2>3. Timeline</h2><p>Designs will be ready untill Friday. The the beta release is planned for december. Every team member must recieve the final PRD before the investor demo on monday at 4 PM.</p>
<h2>4. Security</h2><p>Signal protocol for 1:1 chats and Sender Keys for groups. An independant security audit is neccessary before launch .</p>`;
function summarizePRD() {
  const page = new DOMParser().parseFromString(PRD_HTML, 'text/html');
  const blocks = [...page.querySelectorAll('p, li, td')].map((x) => (x.textContent || '').trim()).filter((t) => t.length > 20);
  const sentences = blocks.flatMap((x) => x.match(/[^.!?]+[.!?]?/g) || []).map((x) => x.trim()).filter((x) => x.length > 15);
  const title = page.querySelector('h1')?.textContent?.trim() || 'Document';
  return {
    summary: `“${title}” — ${sentences.slice(0, 2).join(' ') || 'Short document.'}`,
    points: sentences.filter((x) => /₹|\d+%|\bmust\b|\bwill\b|\bshall\b|\bneed|scope|total/i.test(x)).slice(0, 5),
    dates: sentences.filter((x) => /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|\d+ days|\d{1,2}\s?(am|pm))\b/i.test(x)).slice(0, 4),
  };
}

// ---------- the assistant
export const AI_TOOLS: [string, string, string][] = [
  ['sparkle', 'Ask anything', 'What can you do?'],
  ['translate', 'Translate', 'Translate "I will come tomorrow" to Telugu'],
  ['groups', 'Summarize a group', 'What happened in Weekend Trip today?'],
  ['doc', 'Summarize a document', 'Summarize the WHATSMORE PRD'],
  ['edit', 'Write for me', 'Write a professional message to my customer about a delayed order'],
  ['school', 'Learn', 'Explain photosynthesis in simple Telugu'],
  ['poll', 'Create a quiz', 'Create a quiz on the Indian Constitution'],
  ['status', 'AI status creator', 'Create a status: New shop opened today'],
  ['rupee', 'Analyze my spending', 'Analyze my payments'],
  ['warning', 'Is this a scam?', 'Is this a scam: You have won a lottery, share OTP to claim'],
];
const AI_CHIPS = ['Translate “How are you?” to Hindi', 'What happened in Project WHATSMORE?', 'Explain photosynthesis in simple Telugu', 'Create a quiz on photosynthesis', 'Write a birthday wish'];
const aiWelcome = (): RN => h('span', null, `Hi ${S.me.name.split(' ')[0]}! 👋 I'm `, b('WHATSMORE AI'), '. I can translate between 18 languages, summarize chats and documents, draft messages, teach and quiz you, create status posts and check messages for scams. What would you like to do?');
interface AIMsg { from: 'me' | 'ai'; t: number; rich?: RN; quiz?: string }
const aiMsgs = () => MS<AIMsg[]>('ai', () => [{ from: 'ai', rich: aiWelcome(), t: Date.now() }]);
const sub = (t: string): RN => h('span', { class: 'ci-sub' }, t);
const link = (label: string, attrs: Record<string, string>): RN => h('button', { class: 'link-btn', ...attrs }, label);

export function aiAnswer(q: string): RN | { quiz: string } {
  const s = q.toLowerCase();
  // translation
  if (/translat|अनुवाद|అనువాద/.test(s)) {
    const quoted = (q.match(/[“"']([^”"']+)[”"']/) || [])[1] || q.replace(/^.*?translate\s*/i, '').replace(/\s+(to|into|in)\s+\w+\s*$/i, '');
    const toName = (s.match(/\b(?:to|into|in)\s+(\w+)\s*$/) || [])[1];
    const lang = LANG_LIST.find(([, l]) => toName && l.toLowerCase() === toName.toLowerCase());
    const targets = lang ? [lang] : LANG_LIST.filter(([k]) => ['te', 'hi', 'ta', 'kn', 'ml', 'en'].includes(k));
    const rows = targets.map(([k, l]) => { const r = translateText(quoted, k); return r ? h('span', null, b(l + ':'), ' ' + r.text) : null; }).filter(Boolean) as RN[];
    if (rows.length) return h('span', null, `🌍 Translation of “${quoted}”`, ul(rows), sub('Each person can read the chat in their own language — the original is always kept.'));
    return `I can translate any message in production. In this demo try phrases like “How are you?”, “I will come tomorrow”, “Thank you”, “Good morning”, “Where are you?” — into ${LANG_LIST.length} languages including Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Arabic and Japanese.`;
  }
  // scam check
  if (/scam|fraud|safe\?|phishing/.test(s)) {
    const text = q.split(/:\s*/).slice(1).join(': ') || q;
    const r = scamCheck(text);
    return r.length ? h('span', null, '⚠️ ', b('Potentially suspicious.'), ' I noticed:', ul(r), "Don't click links, share OTPs or send money until you verify the sender through an official channel.") : '✅ I didn\'t find common scam signals in that text. Still, never share OTPs or PINs with anyone.';
  }
  // summaries of chats
  if (/summar|what happened|catch me up|decisions|pending tasks/.test(s) && !/pdf|document|prd|doc\b/.test(s)) {
    const ch = S.chats.filter((c) => !c.locked).map((c) => [c, chatTitle(c).toLowerCase().replace(/\p{Extended_Pictographic}/gu, '').trim()] as [Chat, string]).find(([, t]) => t && s.includes(t.split(' ')[0]))?.[0]
      || S.chats.filter((c) => c.type === 'group' && !c.locked).sort((a, c) => lastTime(c) - lastTime(a))[0];
    if (!ch) return 'There are no chats to summarize yet.';
    const sm = summarize(ch);
    const li = (arr: Line[]) => arr.map((l) => h('span', null, b(firstName(l.m.from) + ':'), ' ' + l.s));
    const parts = ([
      sm.decisions.length && ['✅ Decisions', li(sm.decisions)], sm.tasks.length && ['📝 Pending tasks', li(sm.tasks)], sm.dates.length && ['📅 Dates & meetings', li(sm.dates)],
      sm.announcements.length && ['📢 Announcements', li(sm.announcements)], sm.polls.length && ['📊 Polls', sm.polls], sm.pays.length && ['💳 Payments', sm.pays], sm.files.length && ['📎 Files', sm.files],
    ].filter(Boolean)) as [string, RN[]][];
    return h('span', null, '✨ ', b(chatTitle(ch)), ` · ${sm.count} messages from ${sm.people.slice(0, 5).join(', ')}`, ...parts.flatMap(([t, l]) => [h('div', { class: 'sum-title' }, t), ul(l)]), link('Open chat →', { 'data-act': 'gochat', 'data-chat': ch.id }));
  }
  // documents
  if (/pdf|document|prd|doc\b|chapter/.test(s) && /summar|explain|key points/.test(s)) {
    const sm = summarizePRD();
    return h('span', null, '📄 ', b('WHATSMORE_PRD_v2.pdf'), ' (18 pages) — summary', h('p', null, sm.summary), h('div', { class: 'sum-title' }, '📌 Key points'), ul(sm.points), h('div', { class: 'sum-title' }, '📅 Deadlines'), ul(sm.dates), h('span', { class: 'ci-sub' }, 'Tip: open any document in a chat → ', b('Edit & AI-correct'), ' to proofread it.'));
  }
  // learning
  if (/explain|teach|simple|easy/.test(s)) {
    const lang = /telugu|తెలుగు/.test(s) ? 'te' : /hindi|हिंदी/.test(s) ? 'hi' : 'en';
    const topic = /constitution/.test(s) ? 'constitution' : 'photosynthesis';
    return h('span', null, '📚 ', b(TOPICS[topic].title), ` — ${LANG_LIST.find((l) => l[0] === lang)![1]}`, h('p', null, TOPICS[topic].explain[lang]), link('Test me with a quiz →', { 'data-act': 'aiask', 'data-q': `Create a quiz on ${topic}` }));
  }
  if (/quiz|mcq|questions|test me/.test(s)) {
    const topic = /constitution/.test(s) ? 'constitution' : 'photosynthesis';
    return { quiz: newQuiz(topic) };
  }
  // status / poster creator
  if (/status|poster|advert|ad for|shop opened|announce/.test(s)) {
    const idea = (q.split(/:\s*/)[1] || 'New shop opened today').trim();
    return h('span', null, '🎨 ', b('AI status creator'), h('div', { class: 'ai-poster' }, h('div', { class: 'ap-big' }, `🎉 ${idea}!`), h('div', null, 'Visit us today · Special opening offers')),
      ul([h('span', null, b('English:'), ` 🎉 ${idea}! Come visit us — special opening offers all week.`), h('span', null, b('Telugu:'), ' 🎉 మా కొత్త షాప్ ఈరోజు ప్రారంభమైంది! ఈ వారం ప్రత్యేక ఆఫర్లు — తప్పకుండా రండి.'), h('span', null, b('Hindi:'), ' 🎉 हमारी नई दुकान आज खुल गई है! पूरे हफ्ते खास ऑफ़र — ज़रूर आइए।')]),
      h('button', { class: 'btn sm primary', 'data-act': 'aipoststatus', 'data-text': '🎉 ' + idea + '! Come visit us — special opening offers all week.' }, 'Post as my status'));
  }
  // spending
  if (/spend|expense|payment|money|budget/.test(s)) {
    const out = S.payments.filter((p) => p.dir === 'out'), inn = S.payments.filter((p) => p.dir === 'in');
    const total = out.reduce((a, p) => a + p.amount, 0), got = inn.reduce((a, p) => a + p.amount, 0);
    const top = Object.entries(out.reduce((o: Record<string, number>, p) => { o[p.with] = (o[p.with] || 0) + p.amount; return o; }, {})).sort((a, c) => c[1] - a[1]).slice(0, 3);
    return h('span', null, '💳 ', b('Your payments'), ul([`Spent ${money(total)} in ${out.length} payment${out.length === 1 ? '' : 's'}`, `Received ${money(got)} in ${inn.length} payment${inn.length === 1 ? '' : 's'}`, `Balance ${money(S.wallet)}`, ...top.map(([w, a]) => `Top: ${w} — ${money(a)}`)]));
  }
  // writing
  if (/write|draft|email|message to|wish|letter|reply/.test(s)) {
    let t: string;
    if (/birthday/.test(s)) t = 'Happy birthday! 🎉 Wishing you a wonderful year full of health, happiness and success. Have a great day!';
    else if (/customer|order|delay/.test(s)) t = 'Dear Customer,\n\nThank you for your order. Due to high demand, your delivery is delayed by one day and will reach you tomorrow by 6 PM. We sincerely apologise for the inconvenience and have added a 10% discount to your next order.\n\nWarm regards,\nTeam ' + S.me.name;
    else if (/leave/.test(s)) t = 'Dear Sir/Madam,\n\nI request leave on Friday due to a family function. I will complete my pending work before leaving and stay reachable on WHATSMORE.\n\nThank you,\n' + S.me.name;
    else t = 'Hi! Hope you are doing well. I wanted to follow up on our last conversation — let me know a good time to talk this week. Thanks! 😊';
    const lines = t.split('\n').flatMap((l, i) => (i ? [h('br', null), l] : [l]));
    return h('span', null, '✍️ ', b('Draft'), h('div', { class: 'ai-draft' }, ...lines), link('Copy', { 'data-act': 'aicopy', 'data-text': t }), ' ', link('Send to a chat →', { 'data-act': 'aisendto', 'data-text': t }));
  }
  if (/remind/.test(s)) {
    const fam = MS('family', seedFamily);
    const ev = { id: uid(), title: q.replace(/.*remind me (to )?/i, '').replace(/^./, (c) => c.toUpperCase()) || 'Reminder', at: Date.now() + DAY };
    fam.events.push(ev); save();
    return h('span', null, `⏰ Reminder set for tomorrow at ${fmtTime(ev.at)}: `, b(ev.title), ". You'll find it in Family Hub.");
  }
  return h('span', null, "Here's what I can do:", ul([
    h('span', null, '🌍 ', b('Translate'), ' — “Translate Thank you to Tamil”'), h('span', null, '🧠 ', b('Summarize'), ' — “What happened in Weekend Trip?”'), h('span', null, '📄 ', b('Documents'), ' — “Summarize the PRD”'),
    h('span', null, '✍️ ', b('Write'), ' — “Write a message to my customer”'), h('span', null, '📚 ', b('Learn'), ' — “Explain photosynthesis in simple Telugu”'), h('span', null, '🎨 ', b('Create'), ' — “Create a status: New shop opened today”'), h('span', null, '🛡️ ', b('Safety'), ' — “Is this a scam: …”'),
  ]), sub('Demo AI is rule-based. Production connects to a privacy-preserving model through the WHATSMORE AI gateway.'));
}

export function aiAsk(q: string) {
  q = (q || '').trim();
  if (!q) return;
  const msgs = aiMsgs();
  msgs.push({ from: 'me', rich: q, t: Date.now() });
  ui.aiTyping = true; ui.aiDraft = '';
  if (ui.view !== 'ai') { ui.tab = 'ai'; ui.page = null; openView('ai'); }
  commit();
  setTimeout(() => {
    ui.aiTyping = false;
    const r = aiAnswer(q);
    const list = aiMsgs();
    list.push({ from: 'ai', t: Date.now(), ...(typeof r === 'object' && !Array.isArray(r) ? r : { rich: r }) });
    if (list.length > 60) list.splice(1, list.length - 60);
    commit();
  }, 700 + Math.random() * 600);
}

function aiMic() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return toast('Voice input is not supported in this browser — try Chrome');
  const r = new SR();
  r.lang = 'en-IN'; r.interimResults = false;
  r.onresult = (e: any) => { const t = e.results[0][0].transcript; aiAsk(t); };
  r.onerror = () => toast('Could not hear you — check microphone permission');
  r.start();
  toast('🎙️ Listening… speak now');
}

// buttons inside AI answers
Object.assign(richActs, {
  aiask: (a: Record<string, string>) => aiAsk(a['data-q']),
  gochat: (a: Record<string, string>) => gochat(a['data-chat']),
  aicopy: (a: Record<string, string>) => copyText(a['data-text']),
  aisendto: (a: Record<string, string>) => { const t = a['data-text']; chatPicker('Send draft to…', (chats) => { chats.forEach((c) => sendMsg(c, { type: 'text', text: t })); toast('Draft sent'); }); },
  aipoststatus: (a: Record<string, string>) => { S.myStatus.items.push({ type: 'text', text: a['data-text'], bg: '#7c4dff', t: Date.now(), privacy: 'everyone' }); commit(); toast('Posted to your status · visible to Everyone'); },
});

function AIBubble({ m }: { m: AIMsg }) {
  const out = m.from === 'me';
  return (
    <div className={`msg-row ${out ? 'out' : 'in'} first`}>
      <div className="bubble tail ai-b">
        {out ? null : <div className="bot-tag"><Icon name="sparkle" size={12} /> WHATSMORE AI</div>}
        <div className="text">{m.quiz ? <Quiz id={m.quiz} /> : m.rich != null ? renderRich(m.rich) : null}<span className="meta-spacer" /></div>
        <span className="meta"><span>{fmtTime(m.t)}</span></span>
      </div>
    </div>
  );
}

const autosize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; };

export function AIView() {
  const msgs = aiMsgs();
  const box = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (innerWidth > 760) inp.current?.focus(); }, []);
  const typing = !!ui.aiTyping;
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, typing]);
  const send = () => aiAsk(inp.current?.value || '');
  return (
    <>
      <header className="chat-head view-head">
        <button className="icon-btn back-btn" data-act="closeview" aria-label="Back" onClick={closeView}><Icon name="back" /></button>
        <span className="mod-ic ai"><Icon name="sparkle" size={22} /></span>
        <div className="chat-head-text grow"><div className="chat-head-name">WHATSMORE AI</div><div className="chat-head-sub">{typing ? <span className="typing-txt">thinking…</span> : 'Personal assistant · private by design'}</div></div>
        <button className="icon-btn" data-act="aiclear" title="New conversation" aria-label="New conversation" onClick={() => { S.mod.ai = null; commit(); }}><Icon name="add" /></button>
      </header>
      <div className="messages-wrap"><div className="messages" id="ai-msgs" ref={box}><div className="msgs-inner">
        {msgs.map((m, i) => <AIBubble key={i + ':' + m.t} m={m} />)}
        {typing ? <div className="msg-row in first"><div className="bubble tail"><div className="text"><span className="dots"><i /><i /><i /></span></div></div></div> : null}
      </div></div></div>
      <div className="smart ai-chips">{AI_CHIPS.map((c) => <button key={c} data-act="aiask" data-q={c} onClick={() => aiAsk(c)}>{c}</button>)}</div>
      <footer className="composer">
        <button className="icon-btn" data-act="aimic" title="Speak" aria-label="Speak" onClick={aiMic}><Icon name="mic" /></button>
        <div className="input-wrap"><textarea id="ai-input" ref={inp} rows={1} placeholder="Ask WHATSMORE AI anything…" aria-label="Ask AI" value={ui.aiDraft || ''}
          onChange={(e) => { ui.aiDraft = e.target.value; autosize(e.target); refresh(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /></div>
        <button className="icon-btn send-btn send" data-act="aisend" aria-label="Send" onClick={send}><Icon name="send" /></button>
      </footer>
    </>
  );
}

export function AITab() {
  return (
    <>
      <header className="side-head"><h2>WHATSMORE AI</h2><div className="head-actions"><button className="pill clickable" data-act="page" data-page="set-ai" onClick={() => openPage('set-ai')}>Memory {S.settings.aiMemory ? 'on' : 'off'}</button></div></header>
      <div className="side-scroll">
        <div className="ai-hero"><Icon name="sparkle" size={30} /><div><b>Your personal AI assistant</b><div className="ci-sub">Translate · Summarize · Write · Learn · Analyze · Create</div></div></div>
        {AI_TOOLS.map(([ic, t, q]) => (
          <div key={t} className="list-row action" data-act="aiask" data-q={q} role="button" tabIndex={0} onClick={() => aiAsk(q)} onKeyDown={(e) => { if (e.key === 'Enter') aiAsk(q); }}>
            <span className="action-ic"><Icon name={ic} size={20} /></span><div className="grow"><div className="ci-name">{t}</div><div className="ci-sub">{q}</div></div>
          </div>
        ))}
        <div className="hint-box"><Icon name="shield" size={16} /><span>WHATSMORE AI runs through a model-agnostic AI gateway, so providers can change without rebuilding the app. You decide what AI may read in Settings → AI &amp; memory. Demo answers are rule-based.</span></div>
      </div>
    </>
  );
}

