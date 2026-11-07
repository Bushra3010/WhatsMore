'use client';
// Accounts (ported from js/cloud.js): sign up / sign in / reset, the session lifecycle, profile saves
// to the account, the Settings sign-in row and live @username search on the New chat page.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { S, ui, commit, useRender } from '@/lib/state';
import { modal, toast, confirmModal } from '@/lib/overlay';
import { register, addToSlot, act } from '@/lib/registry';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { profileSaveHooks } from '@/components/settings/hooks';
import { CL, sb, cloudOn, cloudSync, cloudSubscribe, cloudUnsubscribe, onSignedOut } from './core';
import { startCloudDM } from './send';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- session lifecycle
export async function cloudSignedIn(user: User) {
  CL.user = user;
  let p: any = null;
  for (let i = 0; i < 4 && !p; i++) {
    const { data } = await sb.from('profiles').select('id, username, name, about, color, badge').eq('id', user.id).maybeSingle();
    p = data; if (!p) await new Promise((r) => setTimeout(r, 400));
  }
  if (!p) { // the account was deleted: drop the stale session instead of half-signing in
    await sb.auth.signOut().catch(() => {});
    cloudSignedOut();
    toast('That account no longer exists — please sign in or create a new one');
    return false;
  }
  Object.assign(S.me, { name: p.name, username: p.username, about: p.about, color: p.color, cloudId: p.id, email: user.email, badge: p.badge || null });
  const { data: mod } = await sb.rpc('my_moderation'); // your own suspension is private to you
  CL.suspended = mod?.suspended_until && Date.parse(mod.suspended_until) > Date.now() ? { until: Date.parse(mod.suspended_until), reason: mod.suspend_reason || '' } : null;
  S.settings.onboarded = true;
  commit();
  cloudSubscribe();
  await cloudSync();
  return true;
}
export function cloudSignedOut() {
  onSignedOut.forEach((f) => f());
  cloudUnsubscribe();
  CL.user = null; CL.suspended = null;
  S.chats = S.chats.filter((c) => !c.cloud);
  S.contacts = S.contacts.filter((c) => !c.cloud);
  delete S.me.cloudId; delete S.me.email;
  if (ui.active?.startsWith('sb_')) ui.active = null;
  commit();
}

// ---------- actions used by the onboarding / account screens (settings area)
type Res = { error?: string; ok?: boolean; needsConfirm?: boolean };
async function liveSignIn({ email, password }: { email: string; password: string }): Promise<Res> {
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address' };
  if (!password) return { error: 'Enter your password' };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message };
  if (!(await cloudSignedIn(data.user))) return { error: 'That account no longer exists — please sign in or create a new one' };
  toast(`👋 Welcome back, ${S.me.name.split(' ')[0]}!`);
  return { ok: true };
}
async function liveSignUp({ name, username, email, password }: { name: string; username: string; email: string; password: string }): Promise<Res> {
  const un = String(username || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address' };
  if (!name?.trim()) return { error: 'Enter your name' };
  if (!/^[a-z0-9._]{3,24}$/.test(un)) return { error: 'Username: 3–24 letters, numbers, dot or underscore' };
  if ((password || '').length < 8) return { error: 'Password must be at least 8 characters' };
  const { data: free } = await sb.rpc('username_available', { u: un });
  if (free === false) return { error: `@${un} is already taken — try another` };
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name.trim(), username: un, color: S.me.color || '#1565d8' } } });
  if (error) return { error: /database error/i.test(error.message) ? `@${un} was just taken — try another` : /registered/i.test(error.message) ? 'That email already has an account — sign in instead' : error.message };
  if (!data.session || !data.user) return { error: 'Account created. Check your email to confirm it, then sign in.', needsConfirm: true };
  await cloudSignedIn(data.user);
  return { ok: true };
}
async function liveUsernameAvailable(u: string): Promise<boolean | null> {
  const { data, error } = await sb.rpc('username_available', { u });
  return error ? null : !!data;
}
async function liveResetPassword(email: string): Promise<Res> {
  if (!EMAIL.test(email)) return { error: 'Enter your email above first' };
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) return { error: error.message };
  toast('📨 If that email has an account, a reset link is on its way (limited to a few emails per hour)', null, { ms: 6000 });
  return { ok: true };
}
function liveSignOut() {
  confirmModal('Sign out?', 'Your live chats stay safe in your account. Demo chats on this device are kept.', 'Sign out', async () => { await sb.auth.signOut(); cloudSignedOut(); toast('Signed out'); }, false);
}
register({
  liveSignIn, liveSignUp, liveUsernameAvailable, liveResetPassword, liveSignOut,
  liveIsSignedIn: () => cloudOn(),
  liveEmail: () => CL.user?.email || '',
  startCloudDM,
});

// Profile edits go to the account when signed in
profileSaveHooks.push(async ({ name, username, about }) => {
  if (!cloudOn()) return false;
  const un = username.trim().toLowerCase(), ab = about.trim() || 'Hey there! I am using WHATSMORE.';
  if (!name.trim()) { toast('Name cannot be empty'); return true; }
  if (!/^[a-z0-9._]{3,24}$/.test(un)) { toast('Username: 3–24 letters, numbers, dot or underscore'); return true; }
  const { error } = await sb.from('profiles').update({ name: name.trim(), username: un, about: ab, color: S.me.color }).eq('id', CL.user!.id);
  if (error) { toast(/duplicate|unique/i.test(error.message) ? `@${un} is already taken` : 'Could not save: ' + error.message); return true; }
  Object.assign(S.me, { name: name.trim(), username: un, about: ab });
  commit(); toast('Profile saved to your account');
  return true;
});

// ---------- Settings tab: sign-in / signed-in row
function AccountRow() {
  useRender();
  if (cloudOn()) return (
    <div className="list-row action" data-act="cloudsignout" onClick={liveSignOut}><span className="action-ic plain"><Icon name="cloud" size={22} /></span>
      <div className="grow"><div className="ci-name">Signed in · live account</div><div className="ci-sub">{CL.user?.email || ''} · @{S.me.username} · tap to sign out</div></div></div>
  );
  return (
    <div className="list-row action" data-act="cloudsignin" onClick={() => act.openAccountFlow('acct-signin')}><span className="action-ic plain"><Icon name="cloud" size={22} /></span>
      <div className="grow"><div className="ci-name">Sign in or create an account</div><div className="ci-sub">Chat live with real people by @username</div></div><Icon name="chevright" size={20} cls="muted" /></div>
  );
}
addToSlot('settings.account', AccountRow);

// ---------- New chat: search real accounts by @username or name
const cleanQ = (s: string) => (s || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._ ]/g, '');
function NewChatSearch() {
  useRender();
  const q = cleanQ(ui.ncQuery);
  const [res, setRes] = useState<{ q: string; rows: any[] | null; err?: string }>({ q: '', rows: null });
  const t = useRef<any>(0);
  const on = cloudOn();
  useEffect(() => {
    if (!on || q.length < 2) return;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const { data, error } = await sb.from('profiles').select('id, username, name, about, color, badge').or(`username.ilike.%${q}%,name.ilike.%${q}%`).neq('id', CL.user!.id).limit(20);
      if (cleanQ(ui.ncQuery) !== q) return;
      (data || []).forEach((p: any) => CL.found.set(p.id, p));
      setRes({ q, rows: data || [], err: error?.message });
    }, 250);
    return () => clearTimeout(t.current);
  }, [q, on]);
  if (!on) return (
    <div className="hint-box cloud-hint"><Icon name="cloud" size={18} /><span><b>Chat with real people:</b> <button className="link-btn" data-act="cloudsignin" onClick={() => act.openAccountFlow('acct-signin')}>sign in or create an account</button> to find friends by their @username.</span></div>
  );
  if (q.length < 2) return <div className="hint-box cloud-hint"><Icon name="cloud" size={18} /><span>Type at least 2 letters of a friend&apos;s <b>@username</b> to find their real WHATSMORE account.</span></div>;
  const ready = res.q === q && res.rows;
  return (
    <div id="nc-cloud"><div className="list-label">WHATSMORE accounts</div>
      {!ready ? <div className="empty-list small">Searching…</div>
        : res.err ? <div className="empty-list small">Search failed: {res.err}</div>
          : res.rows!.length ? res.rows!.map((p) => (
            <div key={p.id} className="chat-item" data-act="sbdm" data-uid={p.id} onClick={() => startCloudDM(p.id)}><Avatar o={p} />
              <div className="ci-body"><div className="ci-top"><span className="ci-name">{p.name}</span><span className="pill live-acct">Live</span></div>
                <div className="ci-bottom"><span className="ci-preview">@{p.username} · {p.about}</span></div></div></div>
          )) : <div className="empty-list small">No account found for “{q}”.</div>}
    </div>
  );
}
addToSlot('newchat.results', NewChatSearch);

// ---------- start-up: restore a saved session; password reset links land back here
let started = false;
export function startAccounts() {
  if (started) return;
  started = true;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      const box = { pw: '' };
      setTimeout(() => modal({
        title: 'Set a new password',
        body: <label className="field"><span>New password (at least 8 characters)</span><input id="np-pw" type="password" minLength={8} autoComplete="new-password" autoFocus onChange={(e) => { box.pw = e.target.value; }} /></label>,
        actions: [{ label: 'Save', primary: true, onClick: () => {
          if (box.pw.length < 8) { toast('At least 8 characters'); return false; }
          sb.auth.updateUser({ password: box.pw }).then(({ error }) => toast(error ? error.message : 'Password updated'));
        } }],
      }), 300);
    }
    if (event === 'SIGNED_OUT' && CL.user) cloudSignedOut();
    if (event === 'TOKEN_REFRESHED' && session) CL.user = session.user;
  });
  sb.auth.getSession().then(({ data }) => {
    if (data.session) cloudSignedIn(data.session.user);
    else if (S.chats.some((c) => c.cloud)) cloudSignedOut();
  });
}
