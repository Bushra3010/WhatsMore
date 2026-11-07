'use client';
// What WHATSMORE users see of the admin side (ported from js/moderation.js): suspension notices,
// announcements from the Command Center, verified badges on their own profile, and badge requests.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { S, commit, save, refresh, useRender } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { BADGE_LABELS } from '@/lib/util';
import { register, addToSlot, overlays, act } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import { Note } from '@/components/ui/Bits';
import { CL, sb, cloudOn, afterSync, onSignedOut, refusalHooks } from './core';
import { suspendedText } from './send';

const MOD: { ann: any[]; channel: RealtimeChannel | null } = { ann: [], channel: null };
const ANN_LEVEL: Record<string, [string, string]> = { info: ['ℹ️', 'ann-info'], warning: ['⚠️', 'ann-warn'], critical: ['🚨', 'ann-crit'] };
const S2 = () => S as any;

// ---------- announcements from the Command Center
async function loadAnnouncements() {
  if (!cloudOn()) { MOD.ann = []; refresh(); return; }
  const { data } = await sb.from('announcements').select('id, title, body, level, created_at').eq('active', true).order('created_at', { ascending: false }).limit(5);
  MOD.ann = data || [];
  refresh();
}
function Announcements() {
  useRender();
  const dismissed = S2().dismissedAnn || {};
  const show = MOD.ann.filter((a) => !dismissed[a.id]);
  if (!show.length) return null;
  return (
    <div id="announce" role="region" aria-label="Announcements">
      {show.slice(0, 2).map((a) => {
        const [e, cls] = ANN_LEVEL[a.level] || ANN_LEVEL.info;
        return (
          <div key={a.id} className={`ann ${cls}`}><span>{e}</span><div className="grow"><b>{a.title}</b> {a.body}</div>
            <button className="icon-btn sm" data-act="dismissann" data-id={a.id} aria-label="Dismiss announcement" onClick={() => { (S2().dismissedAnn ||= {})[a.id] = Date.now(); commit(); }}><Icon name="close" size={16} /></button></div>
        );
      })}
    </div>
  );
}
function subscribeModeration() {
  if (MOD.channel) sb.removeChannel(MOD.channel);
  MOD.channel = sb.channel('wm-mod-' + CL.user!.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => { loadAnnouncements(); })
    .subscribe();
}

// Your suspension and badge are private to you: checked on sync, on return to the window,
// every 2 minutes, and straight away whenever the database refuses something you send.
export async function checkModeration(afterRefusal = false) {
  if (!cloudOn()) return;
  const { data } = await sb.rpc('my_moderation');
  if (!data) return;
  const was = !!CL.suspended, badgeWas = S.me.badge || null;
  CL.suspended = data.suspended_until && Date.parse(data.suspended_until) > Date.now() ? { until: Date.parse(data.suspended_until), reason: data.suspend_reason || '' } : null;
  S.me.badge = data.badge || null; save();
  if (CL.suspended && (!was || afterRefusal)) toast('🚫 ' + suspendedText(), null, { ms: 8000 });
  else if (!CL.suspended && was) toast('✅ Your account is no longer suspended');
  else if (afterRefusal) toast('Not sent — please try again');
  if (S.me.badge && S.me.badge !== badgeWas) toast(`✅ You're now ${BADGE_LABELS[S.me.badge]}`);
  refresh();
}
refusalHooks.push(() => { checkModeration(true); });
afterSync.push(() => {
  if (cloudOn() && !MOD.channel) { subscribeModeration(); loadAnnouncements(); }
  checkModeration();
});
onSignedOut.push(() => {
  if (MOD.channel) { sb.removeChannel(MOD.channel); MOD.channel = null; }
  MOD.ann = [];
});

/** Always-mounted: announcement banner + the moderation timers. */
function ModerationOverlay() {
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') checkModeration(); }, 120000);
    const onFocus = () => { checkModeration(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, []);
  return <Announcements />;
}
overlays.moderation = ModerationOverlay;

// ---------- my badge and badge requests (Settings → Profile)
async function verificationModal() {
  if (!cloudOn()) return act.openAccountFlow('acct-signin');
  const { data: mine } = await sb.from('verification_requests').select('badge, status, created_at').order('created_at', { ascending: false }).limit(1);
  const last = mine?.[0];
  if (last?.status === 'pending') return toast(`Your request for “${BADGE_LABELS[last.badge]}” is being reviewed`);
  const box = { badge: Object.keys(BADGE_LABELS)[0], note: '' };
  modal({
    title: 'Request a badge',
    body: <>
      {S.me.badge ? <p>You currently have <b>{BADGE_LABELS[S.me.badge]}</b>.</p> : null}
      {last?.status === 'rejected' ? <p className="muted small">Your last request ({BADGE_LABELS[last.badge]}) wasn&apos;t approved. You can apply again with more detail.</p> : null}
      <label className="field"><span>Badge</span><select id="vr-b" defaultValue={box.badge} onChange={(e) => { box.badge = e.target.value; }}>{Object.entries(BADGE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Tell us who you are (business registration, official role, website…)</span><textarea id="vr-n" rows={3} maxLength={500} onChange={(e) => { box.note = e.target.value; }} /></label>
      <Note ic="verified">WHATSMORE checks every request against documented criteria. Nobody can simply claim an official badge.</Note>
    </>,
    actions: [{ label: 'Cancel' }, { label: 'Send request', primary: true, onClick: () => {
      const n = box.note.trim();
      if (n.length < 10) { toast('Add a few details so the team can check'); return false; }
      sb.from('verification_requests').insert({ badge: box.badge, note: n }).then(({ error }) => toast(error ? 'Not sent: ' + error.message : 'Request sent — you\'ll see the badge once it\'s approved'));
    } }],
  });
}
function BadgeRow() {
  useRender();
  if (!cloudOn()) return null;
  return (
    <div className="list-row action" data-act="requestbadge" onClick={verificationModal}><span className="action-ic plain"><Icon name="verified" size={22} /></span>
      <div className="grow"><div className="ci-name">{S.me.badge ? BADGE_LABELS[S.me.badge] + ' ✓' : 'Request a badge'}</div><div className="ci-sub">{S.me.badge ? 'Shown next to your name · request a different badge' : 'Verified, Business, Creator, Official or Government'}</div></div><Icon name="chevright" size={20} cls="muted" /></div>
  );
}
addToSlot('settings.profile', BadgeRow);
register({ verificationModal, checkModeration });
