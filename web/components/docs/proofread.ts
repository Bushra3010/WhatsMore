'use client';
// AI proofreading (tracked changes) and document summary, ported from js/docs.js.
import { uid, esc } from '@/lib/util';

export interface Sugg { id: string; start: number; end: number; from: string; to: string; kind: string }

const TYPOS: Record<string, string> = {
  recieve: 'receive', recieved: 'received', teh: 'the', requirments: 'requirements', adress: 'address', seperate: 'separate', occured: 'occurred',
  untill: 'until', wich: 'which', definately: 'definitely', accomodate: 'accommodate', goverment: 'government', enviroment: 'environment',
  begining: 'beginning', calender: 'calendar', comittee: 'committee', managment: 'management', buisness: 'business', sucessful: 'successful',
  tommorow: 'tomorrow', tomorow: 'tomorrow', reccomend: 'recommend', acheive: 'achieve', beleive: 'believe', independant: 'independent',
  neccessary: 'necessary', necesary: 'necessary', occassion: 'occasion', relevent: 'relevant', responsibilty: 'responsibility', truely: 'truly',
  writting: 'writing', alot: 'a lot', infomation: 'information', informations: 'information', securty: 'security', privcy: 'privacy',
  encyption: 'encryption', aggrement: 'agreement', paymnet: 'payment', recomend: 'recommend', succesful: 'successful', untill_: 'until',
  freind: 'friend', thier: 'their', wether: 'whether', reciept: 'receipt', instalment_: 'instalment',
};
const CONTRACT: Record<string, string> = { dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", havent: "haven't", shouldnt: "shouldn't", couldnt: "couldn't", wouldnt: "wouldn't" };
const matchCase = (src: string, to: string) => (src[0] === src[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);

interface Rule { kind: string; re: RegExp; fix: (m: string, a?: string) => string }
const PROOF_RULES: Rule[] = [
  { kind: 'Spelling', re: new RegExp('\\b(' + Object.keys(TYPOS).filter((k) => !k.endsWith('_')).join('|') + ')\\b', 'gi'), fix: (m) => matchCase(m, TYPOS[m.toLowerCase()]) },
  { kind: 'Grammar', re: /\b(\w+)\s+\1\b/gi, fix: (m, a = '') => (isNaN(Number(a)) ? m.slice(0, a.length) : m) },
  { kind: 'Grammar', re: /\bmore then\b/gi, fix: (m) => matchCase(m, 'more than') },
  { kind: 'Grammar', re: /\bshare there\b/gi, fix: () => 'share their' },
  { kind: 'Grammar', re: /\b(could|should|would|must) of\b/gi, fix: (m, a = '') => a + ' have' },
  { kind: 'Grammar', re: new RegExp('\\b(' + Object.keys(CONTRACT).join('|') + ')\\b', 'gi'), fix: (m) => matchCase(m, CONTRACT[m.toLowerCase()]) },
  { kind: 'Capitalisation', re: /(?<=^|\s)i(?=[\s',.!?])/g, fix: () => 'I' },
  { kind: 'Capitalisation', re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|august|september|october|november|december)\b/g, fix: (m) => m[0].toUpperCase() + m.slice(1) },
  { kind: 'Capitalisation', re: /(?<=[.!?]\s+)[a-z]/g, fix: (m) => m.toUpperCase() },
  { kind: 'Punctuation', re: /[  ]+(?=[,.!?;:](\s|$))/g, fix: () => '' },
  { kind: 'Punctuation', re: / {2,}/g, fix: () => ' ' },
];

/** Wrap every suggestion in the page as a tracked change (<span class="sugg">). Returns the suggestions. */
export function proofread(page: HTMLElement): Sugg[] {
  const out: Sugg[] = [];
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('.sig-block, .sig-slot, .sugg, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const text = node.nodeValue || '';
    let hits: Omit<Sugg, 'id'>[] = [];
    PROOF_RULES.forEach((r) => {
      r.re.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = r.re.exec(text))) {
        if (!mm[0].length) { r.re.lastIndex++; continue; }
        const to = r.fix(mm[0], mm[1]);
        if (to !== mm[0]) hits.push({ start: mm.index, end: mm.index + mm[0].length, from: mm[0], to, kind: r.kind });
      }
    });
    hits.sort((a, b) => a.start - b.start);
    hits = hits.filter((h, i, arr) => !arr.slice(0, i).some((p) => p.end > h.start && p.start < h.end));
    if (!hits.length) return;
    const frag = document.createDocumentFragment();
    let pos = 0;
    hits.forEach((h) => {
      frag.appendChild(document.createTextNode(text.slice(pos, h.start)));
      const id = 's' + uid();
      const span = document.createElement('span');
      span.className = 'sugg';
      span.dataset.sid = id;
      span.contentEditable = 'false';
      span.innerHTML = `<del>${esc(h.from).replace(/ /g, '␣')}</del><ins>${esc(h.to)}</ins>`;
      frag.appendChild(span);
      out.push({ id, ...h });
      pos = h.end;
    });
    frag.appendChild(document.createTextNode(text.slice(pos)));
    node.replaceWith(frag);
  });
  return out;
}

export function summarizeDoc(page: HTMLElement, fallbackTitle?: string) {
  const blocks = [...page.querySelectorAll('p, li, td')].map((b) => (b.textContent || '').trim()).filter((t) => t.length > 20);
  const sentences = blocks.flatMap((b) => b.match(/[^.!?]+[.!?]?/g) || []).map((x) => x.trim()).filter((x) => x.length > 15);
  const title = page.querySelector('h1')?.textContent?.trim() || fallbackTitle || 'Document';
  return {
    sections: Math.max(1, page.querySelectorAll('h2').length),
    summary: `“${title}” — ${sentences.slice(0, 2).join(' ') || 'Short document.'}`,
    points: sentences.filter((x) => /₹|\d+%|\bmust\b|\bwill\b|\bshall\b|\bneed|scope|total/i.test(x)).slice(0, 5),
    dates: sentences.filter((x) => /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|\d+ days|\d{1,2}\s?(am|pm))\b/i.test(x)).slice(0, 4),
  };
}
