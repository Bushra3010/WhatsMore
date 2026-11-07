'use client';
// Admin sign-in. Any WHATSMORE account can sign in, but only accounts on the admins list get past
// admin_me; anyone else is signed straight out again.
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { sb } from './rpc';

const NOT_ADMIN = 'This account is not an admin. Ask the owner to add you on the Admins page.';
const MESSAGES: Record<string, string> = { 'not-admin': NOT_ADMIN, 'signed-out': 'Signed out.' };

export function LoginForm() {
  const m = useSearchParams().get('m') || '';
  const [err, setErr] = useState(MESSAGES[m] || '');
  const [busy, setBusy] = useState(false);

  // The server found a session that is not an admin's: end it, as the original did.
  useEffect(() => { if (m === 'not-admin') void sb().auth.signOut(); }, [m]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr('');
    setBusy(true);
    const client = sb();
    const { error } = await client.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
    if (error) {
      setBusy(false);
      setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
      return;
    }
    const { data: me, error: notAdmin } = await client.rpc('admin_me');
    if (notAdmin || !me) {
      await client.auth.signOut();
      setBusy(false);
      setErr(NOT_ADMIN);
      return;
    }
    window.location.replace('/admin/dashboard');
  };

  return (
    <div className="login">
      <form className="login-card" autoComplete="on" onSubmit={submit}>
        <div className="brand-row"><Logo /><div><b>WHATSMORE</b><div className="muted small">Command Center</div></div></div>
        <h1>Admin sign-in</h1>
        <p className="muted small">Use your WHATSMORE account. Only accounts on the admin list can open the Command Center.</p>
        <label className="cc-field">Email<input name="email" type="email" required autoComplete="username" /></label>
        <label className="cc-field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <div className="cc-err" role="alert">{err}</div>
        <button className="cc-btn primary" type="submit" disabled={busy}>Sign in</button>
        {/* a full page load, so the Command Center styles don't carry over into the app */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="small" href="/">← Back to WHATSMORE</a>
      </form>
    </div>
  );
}
