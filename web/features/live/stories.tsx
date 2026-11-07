'use client';
// Real stories (statuses) between WHATSMORE accounts, ported from js/stories.js.
// Status posts are stored for 24 hours and shown to the audience picked: Everyone, Contacts
// (people you share a chat with), Close friends or Only me. Viewers are recorded for real view counts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { S, commit, save, useRender } from '@/lib/state';
import { modal, toast } from '@/lib/overlay';
import { contact, directChatFor, listTime, senderName } from '@/lib/util';
import { register, addToSlot, act } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { statusPostedHooks, storyViewHooks, storyDeleteHooks, storyReplyHooks } from '@/components/media/hooks';
import { CL, sb, cloudOn, cuid, rawId, fetchProfiles, cloudSync, afterSync, onSignedOut } from './core';
import { isSuspended, suspendedText } from './send';

const ST_BUCKET = 'status-media';
const STV: { loading: Promise<void> | null; uploading: Set<any>; reloadT: any; urls: Map<string, string> } = { loading: null, uploading: new Set(), reloadT: 0, urls: new Map() };
const AUDIENCE: Record<string, string> = { everyone: 'everyone', contacts: 'contacts', selected: 'contacts', close: 'close', private: 'private' };
export const AUDIENCE_LABEL: Record<string, string> = { everyone: 'Everyone', contacts: 'Contacts', close: 'Close friends', private: 'Only me' };
const S2 = () => S as any;

// ---------- load other people's statuses
export function loadCloudStatuses(): Promise<void> {
  if (!cloudOn()) return Promise.resolve();
  if (STV.loading) return STV.loading;
  STV.loading = (async () => {
    const me = CL.user!.id;
    const { data, error } = await sb.from('statuses').select('id, user_id, kind, body, bg, caption, media_path, duration, created_at, expires_at').gt('expires_at', new Date().toISOString()).order('created_at');
    if (error || !data) return;
    const others = data.filter((s: any) => s.user_id !== me), mine = data.filter((s: any) => s.user_id === me);
    await fetchProfiles(others.map((s: any) => s.user_id));
    const paths = others.map((s: any) => s.media_path).filter((p: string) => p && !STV.urls.has(p));
    if (paths.length) {
      const { data: signed } = await sb.storage.from(ST_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
      (signed || []).forEach((d: any) => { if (d.signedUrl && d.path) STV.urls.set(d.path, d.signedUrl); });
    }
    const seen = (S2().cloudSeenStatus ||= {});
    const byUser = new Map<string, any[]>();
    others.forEach((s: any) => {
      const it: any = { sid: s.id, t: Date.parse(s.created_at), type: s.kind === 'video' ? 'image' : s.kind, caption: s.caption || '' };
      if (s.kind === 'text') Object.assign(it, { text: s.body, bg: s.bg || '#1565d8' });
      else if (s.kind === 'voice') Object.assign(it, { src: STV.urls.get(s.media_path) || '', dur: s.duration || 1, bg: s.bg || '#1565d8' });
      else Object.assign(it, { src: STV.urls.get(s.media_path) || '', art: { bg: '#263238', e: '📷' } });
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(it);
    });
    S2().statuses = S2().statuses.filter((s: any) => !s.cloud);
    byUser.forEach((items, u) => S2().statuses.unshift({ contactId: cuid(u), items, cloud: true, viewed: items.every((i) => seen[i.sid]) }));
    // my own: real view counts, and tidy up expired posts
    const { data: views } = mine.length ? await sb.from('status_views').select('status_id').in('status_id', mine.map((s: any) => s.id)) : { data: [] as any[] };
    const counts: Record<string, number> = {}; (views || []).forEach((v: any) => { counts[v.status_id] = (counts[v.status_id] || 0) + 1; });
    const my = S2().myStatus;
    my.items.forEach((it: any) => { if (it.sid) it.views = counts[it.sid] || 0; });
    const live = new Set(mine.map((s: any) => s.id));
    my.items = my.items.filter((it: any) => !it.sid || live.has(it.sid) || Date.now() - it.t < 60000);
    commit();
  })().finally(() => { STV.loading = null; });
  return STV.loading;
}
function scheduleStatusReload() { clearTimeout(STV.reloadT); STV.reloadT = setTimeout(loadCloudStatuses, 600); }

// ---------- post my statuses
async function uploadStatus(it: any) {
  if (!cloudOn() || it.sid || it.localOnly || STV.uploading.has(it)) return;
  if (isSuspended()) { it.localOnly = true; toast('🚫 ' + suspendedText(), null, { ms: 6000 }); return; }
  STV.uploading.add(it);
  try {
    const id = crypto.randomUUID(), me = CL.user!.id;
    const row: any = { id, kind: it.type === 'voice' ? 'voice' : it.type === 'text' ? 'text' : 'image', audience: AUDIENCE[it.privacy] || 'contacts', caption: it.caption || null };
    if (it.type === 'text') Object.assign(row, { body: it.text, bg: /^#[0-9a-f]{3,8}$/i.test(it.bg || '') ? it.bg : null });
    else {
      if (!it.src) { it.localOnly = true; return; }
      const blob = await (await fetch(it.src)).blob();
      const ext = it.type === 'voice' ? 'webm' : (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${me}/${id}.${ext}`;
      const up = await sb.storage.from(ST_BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream' });
      if (up.error) throw up.error;
      Object.assign(row, { media_path: path, duration: it.type === 'voice' ? Math.round(it.dur || 1) : null, bg: /^#[0-9a-f]{3,8}$/i.test(it.bg || '') ? it.bg : null });
      it.mediaPath = path;
    }
    const { error } = await sb.from('statuses').insert(row);
    if (error) throw error;
    it.sid = id; it.views = 0; it.cloudAudience = row.audience;
    save();
    toast(`🌐 Status shared with ${{ everyone: 'everyone', contacts: 'your contacts', close: 'your close friends', private: 'only you' }[row.audience as string]}`);
  } catch (e: any) {
    it.uploadFailed = true;
    toast('Status not shared: ' + (e?.message || e));
  } finally { STV.uploading.delete(it); }
}
statusPostedHooks.push((it) => { if (cloudOn()) uploadStatus(it); });

// ---------- viewing, replying, deleting
storyViewHooks.push((o, it) => {
  if (o.mine || !it?.sid || !cloudOn()) return;
  const seen = (S2().cloudSeenStatus ||= {});
  if (seen[it.sid]) return;
  seen[it.sid] = Date.now(); save();
  sb.from('status_views').upsert({ status_id: it.sid }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true }).then(() => {});
});
storyReplyHooks.push(async (o) => {
  if (o && !o.mine && o.who?.cloud && !directChatFor(o.who.id) && cloudOn()) {
    const { error } = await sb.rpc('start_direct', { other: rawId(o.who.id) });
    if (error) { toast('Could not reply: ' + error.message); return true; }
    await cloudSync();
  }
  return false;
});
storyDeleteHooks.push((it) => {
  if (!it?.sid || !cloudOn()) return;
  sb.from('statuses').delete().eq('id', it.sid).then(({ error }) => { if (error) toast('Could not delete it for everyone: ' + error.message); });
  if (it.mediaPath) sb.storage.from(ST_BUCKET).remove([it.mediaPath]);
});
/** Who viewed one of my live statuses. */
async function storyViewers(it: any) {
  if (!it?.sid) return;
  const { data } = await sb.from('status_views').select('viewer_id, viewed_at').eq('status_id', it.sid).order('viewed_at', { ascending: false });
  await fetchProfiles((data || []).map((v: any) => v.viewer_id));
  modal({
    title: `Viewed by ${(data || []).length}`,
    body: (data || []).length ? <>{(data || []).map((v: any) => (
      <div key={v.viewer_id} className="set-row"><Avatar o={contact(cuid(v.viewer_id)) as any} size={36} /><div className="grow"><div className="ci-name">{senderName(cuid(v.viewer_id))}</div><div className="ci-sub">{listTime(Date.parse(v.viewed_at))}</div></div></div>
    ))}</> : <p className="muted">No views yet.</p>,
    actions: [{ label: 'Close', primary: true }],
  });
}
/** After the views count of my live status items in the viewer: audience + who viewed. */
function StoryMine({ item }: { item?: any }) {
  if (!item?.sid) return null;
  return <> · {AUDIENCE_LABEL[item.cloudAudience] || 'Shared'} <button className="link-btn light" data-act="story-viewers" onClick={(e) => { e.stopPropagation(); storyViewers(item); }}>Who viewed</button></>;
}
addToSlot('story.mine', StoryMine);

// ---------- close friends
async function closeFriendsModal() {
  if (!cloudOn()) return act.openAccountFlow('acct-signin');
  const { data } = await sb.from('close_friends').select('friend_id');
  const picked = new Set<string>((data || []).map((r: any) => r.friend_id));
  const now = new Set(picked);
  const people = S.contacts.filter((c) => c.cloud);
  modal({
    title: 'Close friends',
    body: people.length ? <>
      <p className="muted small">Statuses shared with “Close friends” are seen only by these people.</p>
      <div className="pick-list">{people.map((c) => (
        <label key={c.id} className="chat-item check-row"><Avatar o={c} size={40} /><div className="ci-body"><div className="ci-name">{c.name}</div><div className="ci-preview">@{c.username}</div></div>
          <input type="checkbox" className="check" data-cf={rawId(c.id)} defaultChecked={picked.has(rawId(c.id))} onChange={(e) => { if (e.target.checked) now.add(rawId(c.id)); else now.delete(rawId(c.id)); }} /></label>
      ))}</div>
    </> : <p className="muted">Start a live chat with someone first, then add them here.</p>,
    actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      const add = [...now].filter((x) => !picked.has(x)), del = [...picked].filter((x) => !now.has(x));
      Promise.all([
        add.length ? sb.from('close_friends').insert(add.map((f) => ({ friend_id: f }))) : null,
        del.length ? sb.from('close_friends').delete().in('friend_id', del) : null,
      ]).then((rs) => { const err = rs.find((r: any) => r?.error) as any; toast(err ? 'Not saved: ' + err.error.message : `Close friends saved · ${now.size} ${now.size === 1 ? 'person' : 'people'}`); });
    } }],
  });
}
function CloseFriendsRow() {
  useRender();
  if (!cloudOn()) return null;
  return (
    <div className="list-row action" data-act="closefriends" onClick={closeFriendsModal}><span className="action-ic plain"><Icon name="heart" size={22} /></span>
      <div className="grow"><div className="ci-name">Close friends</div><div className="ci-sub">Choose who sees statuses shared with “Close friends”</div></div><Icon name="chevright" size={20} cls="muted" /></div>
  );
}
addToSlot('status.extra', CloseFriendsRow);
register({ closeFriendsModal, storyViewers, loadCloudStatuses });

// ---------- live: new statuses from people I can see, and views on mine
let stChannel: RealtimeChannel | null = null;
function subscribeStatuses() {
  if (stChannel) sb.removeChannel(stChannel);
  stChannel = sb.channel('wm-status-' + CL.user!.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'statuses' }, () => scheduleStatusReload())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'statuses' }, () => scheduleStatusReload())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_views' }, (p: any) => {
      const it = S2().myStatus.items.find((x: any) => x.sid === p.new.status_id);
      if (it) { it.views = (it.views || 0) + 1; commit(); }
    })
    .subscribe();
}
afterSync.push(() => { if (cloudOn()) { if (!stChannel) subscribeStatuses(); scheduleStatusReload(); } });
onSignedOut.push(() => {
  if (stChannel) { sb.removeChannel(stChannel); stChannel = null; }
  S2().statuses = S2().statuses.filter((s: any) => !s.cloud);
});
