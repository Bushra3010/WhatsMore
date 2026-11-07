'use client';
/* eslint-disable react-hooks/purity -- views read the clock (progress of orders, events) */
// Family Hub (js/modules.js modFamily).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { S, commit } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { sendMsg, scheduleReply } from '@/lib/actions';
import { uid, contact, chatById, dayLabel, fmtTime, DAY } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Sec, Note } from '@/components/ui/Bits';
import { MS, gochat, val, withPin } from './shared';

export function seedFamily() {
  const at = (days: number, hr: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hr, m, 0, 0); return +d; };
  return {
    events: [{ id: 'f1', title: 'School meeting — parent-teacher', at: at(1, 10) }, { id: 'f2', title: "Mom's birthday 🎂", at: at(4, 19) }, { id: 'f3', title: 'Electricity bill due', at: at(6, 9) }, { id: 'f4', title: 'Doctor appointment — Dr Rao', at: at(9, 17, 30) }, { id: 'f5', title: 'Family trip to Tirupati 🚗', at: at(16, 6) }],
    todos: [['Buy groceries for Sunday lunch', false], ['Renew car insurance', false], ['Pay school fees', true]] as [string, boolean][],
    docs: [['🪪', 'Aadhaar cards', 'Mom, Siva, Ananya, You'], ['💳', 'PAN cards', '4 documents'], ['🏥', 'Health insurance policy', 'Valid till Mar 2027'], ['🎓', 'School report cards', '2026 · Term 1']],
    sharing: { c_mom: false, c_siva: true, c_ananya: false } as Record<string, boolean>,
  };
}
const fam = () => MS('family', seedFamily);

function famAdd() {
  modal({
    title: 'Add to family calendar',
    body: <><label className="field"><span>Title</span><input id="fe-t" placeholder="e.g. School meeting" autoFocus /></label><label className="field"><span>When</span><input id="fe-w" type="datetime-local" /></label></>,
    actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const t = val(root, '#fe-t').trim(), w = new Date(val(root, '#fe-w')).getTime(); if (!t || !w) { toast('Add a title and time'); return false; } fam().events.push({ id: uid(), title: t, at: w }); commit(); toast('Added · family members will be reminded'); } }],
  });
}
function famTodo() {
  modal({ title: 'New reminder', body: <label className="field"><span>Reminder</span><input id="ft" autoFocus /></label>, actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: (root) => { const t = val(root, '#ft').trim(); if (t) { fam().todos.push([t, false]); commit(); } } }] });
}
function famAnnounce() {
  const ch = chatById('ch_family');
  if (!ch) return;
  modal({
    title: 'Family announcement',
    body: <label className="field"><span>Message</span><textarea id="fa" rows={3} autoFocus defaultValue="📢 School meeting tomorrow at 10 AM — who can go?" /></label>,
    actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: (root) => { const m = sendMsg(ch, { type: 'text', text: val(root, '#fa').trim() }); scheduleReply(ch, m); toast('Sent to Family ❤️'); } }],
  });
}

export function FamilyView() {
  const f = fam();
  const members = ['c_mom', 'c_siva', 'c_ananya'].map(contact).filter(Boolean) as any[];
  const evs = f.events.filter((e: any) => e.at > Date.now() - DAY).sort((a: any, b: any) => a.at - b.at);
  return (
    <>
      <div className="fam-members">
        {[S.me, ...members].map((m) => <div className="fm" key={m.id}><Avatar o={m} size={52} /><span>{m === S.me ? 'You' : m.name.split(' ')[0]}</span></div>)}
        <button className="fm add" data-act="gochat" data-chat="ch_family" onClick={() => gochat('ch_family')}><span className="fm-plus"><Icon name="chat" size={22} /></span><span>Family chat</span></button>
      </div>
      <Sec title="Shared calendar" extra={<button className="link-btn" data-act="famadd" onClick={famAdd}>+ Add event</button>}>
        {evs.map((e: any) => (
          <div className="set-row" key={e.id}><div className="date-chip"><b>{new Date(e.at).getDate()}</b><span>{new Date(e.at).toLocaleDateString([], { month: 'short' })}</span></div><div className="grow"><div className="ci-name">{e.title}</div><div className="ci-sub">{dayLabel(e.at)} · {fmtTime(e.at)} · everyone notified</div></div></div>
        ))}
      </Sec>
      <Sec title="Reminders" extra={<button className="link-btn" data-act="famtodo" onClick={famTodo}>+ Add</button>}>
        {f.todos.map(([t, d]: [string, boolean], i: number) => (
          <label className="set-row" key={i}><input type="checkbox" data-famtodo={i} checked={d} onChange={(e) => { f.todos[i][1] = e.target.checked; commit(); }} /><span className={`grow ${d ? 'done' : ''}`}>{t}</span></label>
        ))}
      </Sec>
      <Sec title="Important documents">
        {f.docs.map(([e, t, s]: string[]) => (
          <div className="set-row" data-act="famdoc" key={t} role="button" tabIndex={0} onClick={() => withPin(() => toast('🔓 Document vault unlocked (demo)'))}><span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{t}</div><div className="ci-sub">{s}</div></div><Icon name="lock" size={18} cls="muted" /></div>
        ))}
      </Sec>
      <Sec title="Location sharing (optional)">
        {members.map((m) => (
          <label className="set-row" key={m.id}><Avatar o={m} size={36} /><div className="grow"><div className="ci-name">{m.name}</div><div className="ci-sub">{f.sharing[m.id] ? 'Sharing live location with family' : 'Not sharing'}</div></div>
            <input type="checkbox" className="switch" data-famshare={m.id} checked={!!f.sharing[m.id]} onChange={(e) => { f.sharing[m.id] = e.target.checked; commit(); }} /></label>
        ))}
        <Note ic="place">Location sharing is off by default and each person controls their own.</Note>
      </Sec>
      <button className="btn primary block" data-act="famannounce" onClick={famAnnounce}><Icon name="megaphone" size={18} /> Send family announcement</button>
    </>
  );
}
