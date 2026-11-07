// Real test accounts for the suite (the app has no demo data). Global setup creates two throwaway
// accounts (A and B) with a live chat between them, a story and a document; global teardown deletes
// them. Talks to Supabase over plain HTTPS with the public key, like the app does.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SUPABASE_KEY, SUPABASE_URL } from '../lib/supabase/config';

export interface Account { name: string; username: string; email: string; password: string; id: string; session: Record<string, unknown> }
export interface Fixture { run: string; A: Account; B: Account; conv: string; texts: string[] }

const FILE = path.join(__dirname, '.auth', 'fixture.json');
export const loadFixture = (): Fixture => JSON.parse(readFileSync(FILE, 'utf8'));

/** Runs one SQL statement as the project owner (only used to clean up). */
export function sql(q: string) {
  const runner = process.env.WM_SQL;
  if (!runner) throw new Error('Set WM_SQL to a script that runs SQL on the Supabase project (needed to clean up test accounts).');
  return JSON.parse(execFileSync(runner, [q], { encoding: 'utf8' }) || '[]');
}

async function api(method: string, url: string, token: string | null, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(SUPABASE_URL + url, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (token || SUPABASE_KEY), ...(body instanceof Uint8Array ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? new Blob([body as BlobPart]) : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signUp(run: string, tag: string, name: string): Promise<Account> {
  const username = `e2e${tag}${run}`.slice(0, 24), email = `wm.e2e.${run}.${tag}@mailinator.com`, password = `Pw-${run}-${tag}-x9`;
  const s = await api('POST', '/auth/v1/signup', null, { email, password, data: { name, username, color: '#1565d8' } });
  if (!s.access_token) throw new Error('sign-up did not return a session (is email auto-confirm on?)');
  // the shape supabase-js keeps in localStorage
  const session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + s.expires_in, token_type: s.token_type, user: s.user };
  return { name, username, email, password, id: s.user.id, session };
}

export async function createFixture(): Promise<Fixture> {
  const run = Date.now().toString(36);
  const A = await signUp(run, 'a', 'Asha Tester');
  const B = await signUp(run, 'b', 'Bala Tester');
  const tok = (x: Account) => x.session.access_token as string;
  const conv: string = await api('POST', '/rest/v1/rpc/start_direct', tok(A), { other: B.id });
  const texts = ['Hello Bala, are we meeting tomorrow?', 'Yes! See you at 10 near the car park', 'Great, I will bring the documents', 'Perfect, thank you'];
  for (const [i, t] of texts.entries()) {
    await api('POST', '/rest/v1/messages', tok(i % 2 ? B : A), { conversation_id: conv, kind: 'text', body: t });
    await new Promise((r) => setTimeout(r, 30));
  }
  // a document from B (uploaded to storage like the app does)
  const id = crypto.randomUUID(), file = `${conv}/${id}-meeting-notes.txt`, bytes = new TextEncoder().encode('Meeting notes\n- agenda\n- budget\n');
  await api('POST', `/storage/v1/object/chat-media/${file}`, tok(B), bytes, { 'Content-Type': 'text/plain' });
  await api('POST', '/rest/v1/messages', tok(B), { id, conversation_id: conv, kind: 'doc', media_path: file, media_name: 'meeting-notes.txt', media_size: bytes.length, media_mime: 'text/plain' });
  // a poll from B, and a story from B that everyone can see
  await api('POST', '/rest/v1/messages', tok(B), { conversation_id: conv, kind: 'rich', payload: { type: 'poll', question: 'Lunch after the meeting?', options: ['Biryani', 'Dosa'], multi: false } });
  await api('POST', '/rest/v1/statuses', tok(B), { kind: 'text', body: 'Story from Bala', bg: '#1565d8', audience: 'everyone' });
  const fx: Fixture = { run, A, B, conv, texts };
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(fx));
  return fx;
}

export async function destroyFixture() {
  if (!existsSync(FILE)) return;
  const fx = loadFixture();
  for (const who of [fx.A, fx.B]) {
    const files = sql(`select bucket_id, name from storage.objects where owner_id = '${who.id}'`) as { bucket_id: string; name: string }[];
    for (const bucket of new Set(files.map((f) => f.bucket_id))) {
      try {
        // sign in again: the access token from setup may have expired during a long run
        const s = await api('POST', '/auth/v1/token?grant_type=password', null, { email: who.email, password: who.password });
        await api('DELETE', `/storage/v1/object/${bucket}`, s.access_token, { prefixes: files.filter((f) => f.bucket_id === bucket).map((f) => f.name) });
      } catch (e) { console.warn('could not delete test files:', (e as Error).message); }
    }
  }
  const list = `'${fx.A.id}','${fx.B.id}'`;
  sql(`delete from public.conversations where id in (select conversation_id from public.members where user_id in (${list}))`);
  sql(`delete from public.reports where reporter_id in (${list}) or target_user in (${list})`);
  sql(`delete from public.admin_audit where admin_id in (${list})`);
  sql(`delete from auth.users where id in (${list})`);
}
