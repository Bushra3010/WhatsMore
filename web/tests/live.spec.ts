// Live end-to-end test with real Supabase accounts: two people (A and B) in two browsers chat, share
// files, react, edit, delete, vote, pay, call each other (fake camera/mic) and post stories; then A,
// made an admin, moderates B in the Command Center. Throwaway accounts are deleted at the end.
//
// Opt-in: needs WM_SQL = path to a script that runs one SQL statement on the project as the owner
// (used only to make A an admin and to clean up). Run: WM_SQL=/path/sql.sh npx playwright test live
import { test, expect, chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { errorCanary } from './helpers';
import { SUPABASE_KEY, SUPABASE_URL } from '../lib/supabase/config';

const SQL = process.env.WM_SQL;
test.skip(!SQL, 'set WM_SQL to run the live tests');
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const run = Date.now().toString(36);
const A = { name: 'Asha Test', un: `e2ea${run}`, email: `wm.e2e.${run}.a@mailinator.com`, pw: `Pw-${run}-A!x` };
const B = { name: 'Bala Test', un: `e2eb${run}`, email: `wm.e2e.${run}.b@mailinator.com`, pw: `Pw-${run}-B!x` };
const sql = (q: string) => JSON.parse(execFileSync(SQL!, [q], { encoding: 'utf8' }) || '[]');

let browser: Browser, ctxA: BrowserContext, ctxB: BrowserContext, a: Page, b: Page;
let canA: ReturnType<typeof errorCanary>, canB: ReturnType<typeof errorCanary>;
const base = process.env.BASE_URL || 'http://localhost:3210';

async function signUp(p: Page, who: typeof A) {
  await p.goto(base + '/');
  await p.getByRole('button', { name: 'Create an account' }).click({ timeout: 15_000 });
  await p.locator('#ac-name').fill(who.name);
  await p.locator('#ac-un').fill(who.un);
  await expect(p.locator('#ac-un-st')).toContainText('is available');
  await p.locator('#ac-email').fill(who.email);
  await p.locator('#ac-pw').fill(who.pw);
  await p.getByRole('button', { name: 'Create account' }).click();
  // done step, then into the app
  const done = p.locator('#onboard');
  await expect(done).toContainText(/all set|welcome|start/i, { timeout: 20_000 });
  for (let i = 0; i < 4 && await done.count(); i++) {
    const btn = done.locator('.btn.primary').last();
    if (await btn.isVisible().catch(() => false)) await btn.click();
  }
  await expect(p.locator('#onboard')).toHaveCount(0);
}
async function goChats(p: Page) { await p.locator('[data-act="tab"][data-tab="chats"]:visible').first().click(); }
async function openLive(p: Page, title: string) {
  await goChats(p);
  await p.locator('#sidebar [data-act="open"]', { hasText: title }).first().click();
  await expect(p.locator('.cloudbar')).toBeVisible();
}
async function send(p: Page, text: string) { await p.locator('#input').fill(text); await p.locator('#input').press('Enter'); }
const rowWith = (p: Page, text: string) => p.locator('#msgs .msg-row', { hasText: text }).last();

test.beforeAll(async () => {
  browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera', 'microphone'] });
  ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera', 'microphone'] });
  for (const c of [ctxA, ctxB]) await c.addInitScript(() => { try { sessionStorage.setItem('wm-welcome', '1'); } catch { /* */ } });
  a = await ctxA.newPage(); b = await ctxB.newPage();
  canA = errorCanary(a); canB = errorCanary(b);
});
test.afterAll(async () => {
  if (process.env.WM_KEEP) { await browser?.close(); return; } // keep the accounts for debugging
  // 1) each account deletes its own uploads through the Storage API, signed in as itself in its own
  //    browser (direct SQL deletes on storage are blocked by Supabase)
  for (const [who, page] of [[A, a], [B, b]] as const) {
    const files = sql(`select bucket_id, name from storage.objects where owner_id = (select id::text from auth.users where email = '${who.email}')`) as { bucket_id: string; name: string }[];
    if (!files.length || !page) continue;
    await page.evaluate(async ({ files, url, key }) => {
      const token = JSON.parse(localStorage.getItem('wm-app-auth') || '{}').access_token;
      for (const bucket of new Set(files.map((f) => f.bucket_id))) {
        await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: files.filter((f) => f.bucket_id === bucket).map((f) => f.name) }) });
      }
    }, { files, url: SUPABASE_URL, key: SUPABASE_KEY }).catch(() => {});
  }
  await browser?.close();
  // 2) remove the throwaway accounts and everything they created (chats cascade)
  const ids = sql(`select id from auth.users where email in ('${A.email}','${B.email}')`).map((r: { id: string }) => r.id);
  if (ids.length) {
    const list = ids.map((i: string) => `'${i}'`).join(',');
    sql(`delete from public.conversations where id in (select conversation_id from public.members where user_id in (${list}))`);
    sql(`delete from public.reports where reporter_id in (${list}) or target_user in (${list})`);
    sql(`delete from public.announcements where title = 'E2E notice ${run}'`);
    sql(`delete from public.admin_audit where admin_id in (${list})`);
    sql(`delete from auth.users where id in (${list})`);
  }
});

test('two people sign up', async () => {
  await signUp(a, A);
  await signUp(b, B);
  const rows = sql(`select username from public.profiles where username in ('${A.un}','${B.un}') order by username`);
  expect(rows.map((r: { username: string }) => r.username)).toEqual([A.un, B.un]);
});

test('A finds B by @username and they chat live', async () => {
  await goChats(a);
  await a.locator('#sidebar [aria-label="New chat"]').first().click();
  await a.locator('#nc-search').fill('@' + B.un);
  await a.locator('#nc-cloud [data-act="sbdm"]').first().click();
  await expect(a.locator('.cloudbar')).toBeVisible();
  await send(a, 'Hello Bala from Asha');
  // B gets it in realtime
  await expect(b.locator('#sidebar')).toContainText(A.name, { timeout: 15_000 });
  await openLive(b, A.name);
  await expect(rowWith(b, 'Hello Bala from Asha')).toBeVisible();
  // typing indicator, reply, blue ticks
  await b.locator('#input').pressSequentially('typing…');
  await expect(a.locator('#chat-sub')).toContainText(/typing/i, { timeout: 10_000 });
  await b.locator('#input').fill('');
  await send(b, 'Hi Asha, got it');
  await expect(rowWith(a, 'Hi Asha, got it')).toBeVisible({ timeout: 15_000 });
  await expect(rowWith(a, 'Hello Bala from Asha').locator('.ticks.read, .tick.read, [class*="read"]').first()).toBeVisible({ timeout: 15_000 });
});

test('reactions, edits and delete for everyone sync', async () => {
  await rowWith(b, 'Hello Bala from Asha').click({ button: 'right' });
  await b.locator('#menu [data-react="👍"]').click();
  await expect(rowWith(a, 'Hello Bala from Asha')).toContainText('👍', { timeout: 15_000 });

  await send(a, 'Typo mesage');
  await expect(rowWith(b, 'Typo mesage')).toBeVisible({ timeout: 15_000 });
  await expect(rowWith(a, 'Typo mesage').locator('[class*="tick"]').first()).toBeVisible();
  await a.waitForTimeout(1000);
  await rowWith(a, 'Typo mesage').click({ button: 'right' });
  await a.locator('#menu').getByRole('menuitem', { name: 'Edit' }).click();
  await a.locator('#input').fill('Fixed message');
  await a.locator('#input').press('Enter');
  await expect(rowWith(b, 'Fixed message')).toBeVisible({ timeout: 15_000 });

  await send(a, 'Delete me please');
  await expect(rowWith(b, 'Delete me please')).toBeVisible({ timeout: 15_000 });
  await a.waitForTimeout(1000);
  await rowWith(a, 'Delete me please').click({ button: 'right' });
  await a.locator('#menu').getByRole('menuitem', { name: 'Delete' }).click();
  await a.locator('.modal').getByRole('button', { name: 'Delete for everyone' }).click();
  await expect(b.locator('#msgs')).not.toContainText('Delete me please', { timeout: 15_000 });
});

test('photos and documents upload and reach the other side', async () => {
  const img = path.join(__dirname, 'fixtures', 'photo.png');
  const doc = path.join(__dirname, 'fixtures', 'notes.txt');
  // photo
  const fc1 = a.waitForEvent('filechooser');
  await a.locator('[data-act="attach"]').click();
  await a.locator('#menu').getByRole('menuitem', { name: 'Photos & videos' }).click();
  await (await fc1).setFiles(img);
  await a.locator('.modal').getByRole('button', { name: 'Send', exact: true }).click();
  await expect(b.locator('#msgs .msg-row.in img').last()).toBeVisible({ timeout: 20_000 });
  // document
  const fc2 = a.waitForEvent('filechooser');
  await a.locator('[data-act="attach"]').click();
  await a.locator('#menu').getByRole('menuitem', { name: /Document/ }).click();
  await (await fc2).setFiles(doc);
  await expect(rowWith(b, 'notes.txt')).toBeVisible({ timeout: 20_000 });
});

test('polls and payment requests sync', async () => {
  await a.locator('[data-act="attach"]').click();
  await a.locator('#menu').getByRole('menuitem', { name: 'Poll' }).click();
  await a.locator('#pl-q').fill('Lunch where?');
  await a.locator('.pl-opt').nth(0).fill('Biryani');
  await a.locator('.pl-opt').nth(1).fill('Dosa');
  await a.locator('.modal').getByRole('button', { name: /send|create/i }).last().click();
  await expect(rowWith(b, 'Lunch where?')).toBeVisible({ timeout: 15_000 });
  await rowWith(b, 'Lunch where?').locator('[data-act="vote"]').nth(1).click();
  await expect(rowWith(a, 'Lunch where?')).toContainText(/1 vote/i, { timeout: 15_000 });

  await a.locator('[data-act="attach"]').click();
  await a.locator('#menu').getByRole('menuitem', { name: 'Payment' }).click();
  await a.locator('.modal').getByText('Request', { exact: true }).first().click();
  await a.locator('#pm-amt').fill('75');
  await a.locator('.modal').getByRole('button', { name: 'Continue' }).click();
  await expect(rowWith(b, '75')).toBeVisible({ timeout: 15_000 });
  await rowWith(b, '75').locator('[data-act="pay"]').click();
  await b.locator('.modal').getByRole('button', { name: /^Pay/ }).click();
  await expect(rowWith(a, '75')).toContainText(/paid/i, { timeout: 15_000 });
});

test('real video call connects between A and B', async () => {
  await a.locator('.chat-head [aria-label*="ideo"]').first().click();
  /* debug */ if (process.env.WM_DEBUG) console.log('DEBUG A rtc:', await a.locator('#rtc').count(), 'toasts:', await a.locator('#toasts').textContent().catch(() => ''), 'B rtc:', await b.locator('#rtc').count(), 'B active:', await b.evaluate(() => document.querySelector('.chat-head-name')?.textContent), 'A .call:', await a.locator('.call').count(), 'errs', canA.errors, canB.errors, 'btn', await a.locator('.chat-head [aria-label*="ideo"]').evaluateAll((e) => e.map((x) => x.outerHTML.slice(0, 120))));
  await expect(b.locator('#rtc')).toContainText(/Incoming video call/, { timeout: 15_000 });
  await b.locator('#rtc .cbtn.accept').click();
  await expect(a.locator('#rtc-status')).toHaveText(/^\d+:\d\d$/, { timeout: 30_000 });
  await expect(b.locator('#rtc video[data-remote]')).toBeVisible({ timeout: 15_000 });
  await a.locator('[data-act="rtc-end"]').click();
  await expect(b.locator('#rtc')).toHaveCount(0, { timeout: 15_000 });
});

test('a story shared with everyone is seen by the other account', async () => {
  await a.locator('[data-act="tab"][data-tab="status"]:visible').first().click();
  await a.locator('[data-act="addstatus"]').first().click();
  const d = a.locator('.modal').last();
  await d.locator('textarea').first().fill('Live story from Asha');
  const sel = d.locator('select').last();
  if (await sel.count()) await sel.selectOption({ index: 0 });
  await d.getByRole('button', { name: /post|share/i }).last().click();
  await expect(a.getByText(/Status shared with/)).toBeVisible({ timeout: 15_000 });
  await b.locator('[data-act="tab"][data-tab="status"]:visible').first().click();
  await expect(b.locator('#sidebar')).toContainText(A.name, { timeout: 20_000 });
});

test('B reports a message; A (as admin) sees it, suspends B, and B cannot send', async () => {
  test.setTimeout(240_000);
  await openLive(b, A.name);
  await rowWith(b, 'Fixed message').click({ button: 'right' });
  await b.locator('#menu').getByRole('menuitem', { name: 'Report' }).click();
  const block = b.locator('.modal').getByLabel(/Also block/);
  if (await block.count()) await block.uncheck(); // keep the chat open for the suspension check
  await b.locator('.modal').getByRole('button', { name: 'Report' }).click();
  await expect.poll(() => sql(`select count(*)::int n from public.reports where target_label is not null and reporter_id = (select id from auth.users where email='${B.email}')`)[0].n, { timeout: 15_000 }).toBe(1);

  sql(`insert into public.admins (user_id, role) select id, 'owner' from auth.users where email = '${A.email}'`);
  const adm = await ctxA.newPage();
  const canAdm = errorCanary(adm);
  await adm.goto(base + '/admin/login');
  await adm.getByLabel('Email').fill(A.email);
  await adm.getByLabel('Password').fill(A.pw);
  await adm.getByRole('button', { name: /sign in/i }).click();
  await expect(adm).toHaveURL(/\/admin\/dashboard/, { timeout: 20_000 });
  await expect(adm.locator('body')).toContainText(/Users/);

  for (const s of ['users', 'reports', 'verification', 'statuses', 'announcements', 'audit', 'admins']) {
    await adm.goto(base + '/admin/' + s);
    await expect(adm.locator('h1, h2').first()).toBeVisible();
  }
  await adm.goto(base + '/admin/reports');
  await expect(adm.locator('body')).toContainText('Fixed message', { timeout: 15_000 });

  // suspend B for 7 days from Users
  await adm.goto(base + '/admin/users');
  await adm.locator('input[type="search"], input[placeholder*="earch"]').first().fill(B.un);
  const row = adm.locator('tr, .row, li', { hasText: '@' + B.un }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: /suspend/i }).click();
  await adm.locator('dialog, .dialog, [role="dialog"]').last().getByRole('button', { name: /suspend/i }).last().click();
  await expect(row).toContainText(/suspended/i, { timeout: 15_000 });

  // B's app finds out, and sending is blocked
  await b.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(b.locator('.suspendbar')).toBeVisible({ timeout: 20_000 });
  const before = await b.locator('#msgs .msg-row.out').count();
  await send(b, 'should not send');
  await expect(b.getByText(/suspended/i).first()).toBeVisible();
  expect(await b.locator('#msgs .msg-row.out').count()).toBe(before);

  // announcement reaches the app live
  await adm.goto(base + '/admin/announcements');
  await adm.getByLabel(/title/i).fill('E2E notice ' + run);
  await adm.getByLabel(/message|body/i).fill('Scheduled maintenance test');
  await adm.getByRole('button', { name: /publish/i }).click();
  await expect(a.locator('#announce')).toContainText('E2E notice ' + run, { timeout: 20_000 });
  // the banner must not cover the app: the header buttons stay usable
  await a.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
  await a.locator('#sidebar [aria-label="New chat"]').first().click();
  await expect(a.locator('#nc-search')).toBeVisible();

  // A asks for a badge in the app; the admin approves it; A's profile shows it
  await a.locator('[data-act="tab"][data-tab="settings"]:visible').first().click();
  await a.locator('#sidebar [data-page="set-profile"]').first().click();
  await a.locator('[data-act="requestbadge"]').click();
  await a.locator('#vr-n').fill('Founder of a registered test business, website example.org');
  await a.locator('.modal').getByRole('button', { name: 'Send request' }).click();
  await expect(a.getByText(/Request sent/)).toBeVisible({ timeout: 15_000 });
  await adm.goto(base + '/admin/verification');
  await adm.getByRole('button', { name: 'Approve' }).first().click();
  await expect(adm.getByRole('button', { name: 'Approve' })).toHaveCount(0, { timeout: 15_000 });
  await a.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(a.locator('[data-act="requestbadge"]')).toContainText('Verified ✓', { timeout: 20_000 });

  // the admin removes A's story; it disappears for B
  await adm.goto(base + '/admin/statuses');
  await adm.getByRole('button', { name: 'Remove' }).first().click();
  await adm.locator('[role="dialog"]').getByRole('button', { name: 'Remove' }).click();
  await expect(adm.getByText('Status removed')).toBeVisible({ timeout: 15_000 });
  await b.locator('[data-act="tab"][data-tab="status"]:visible').first().click();
  await expect(b.locator('#sidebar')).not.toContainText(A.name, { timeout: 20_000 });

  // audit log recorded the suspension
  await adm.goto(base + '/admin/audit');
  await expect(adm.locator('body')).toContainText(/suspend/i, { timeout: 15_000 });
  // report actions: remove the reported message for everyone
  await adm.goto(base + '/admin/reports');
  await adm.getByRole('button', { name: 'Remove message' }).first().click();
  await expect(adm.getByText('Message removed for everyone')).toBeVisible({ timeout: 15_000 });
  await expect(b.locator('#msgs')).not.toContainText('Fixed message', { timeout: 20_000 });

  // unsuspend: B can send again
  await adm.goto(base + '/admin/users');
  await adm.locator('input[type="search"], input[placeholder*="earch"]').first().fill(B.un);
  const urow = adm.locator('tr', { hasText: '@' + B.un }).first();
  await urow.getByRole('button', { name: 'Unsuspend' }).click();
  await expect(urow.getByRole('button', { name: 'Suspend' })).toBeVisible({ timeout: 15_000 });
  await b.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(b.getByText(/no longer suspended/i)).toBeVisible({ timeout: 20_000 });
  await send(b, 'Back again');
  await expect(rowWith(a, 'Back again')).toBeVisible({ timeout: 20_000 });

  // badges from the Users page reach the person
  await urow.getByRole('combobox').selectOption('creator');
  await expect(adm.getByText(/is now Creator verified/)).toBeVisible({ timeout: 15_000 });
  await b.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(b.getByText(/You're now Creator verified/)).toBeVisible({ timeout: 20_000 });

  // admins: add B as moderator, then remove (with confirmation)
  await adm.goto(base + '/admin/admins');
  await adm.getByLabel('Username').fill('@' + B.un);
  await adm.getByRole('button', { name: 'Add' }).click();
  const arow = adm.locator('tr', { hasText: '@' + B.un });
  await expect(arow).toContainText('Moderator', { timeout: 15_000 });
  await arow.getByRole('button', { name: 'Remove' }).click();
  await adm.locator('[role="dialog"]').getByRole('button', { name: 'Remove' }).click();
  await expect(arow).toHaveCount(0, { timeout: 15_000 });

  // owner deletes B's account (typed confirmation); B's files go first so nothing is left in storage
  const bFiles = sql(`select bucket_id, name from storage.objects where owner_id = (select id::text from auth.users where email = '${B.email}')`) as { bucket_id: string; name: string }[];
  if (bFiles.length) await b.evaluate(async ({ files, url, key }) => {
    const token = JSON.parse(localStorage.getItem('wm-app-auth') || '{}').access_token;
    for (const bucket of new Set(files.map((f) => f.bucket_id))) await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: files.filter((f) => f.bucket_id === bucket).map((f) => f.name) }) });
  }, { files: bFiles, url: SUPABASE_URL, key: SUPABASE_KEY });
  await adm.goto(base + '/admin/users');
  await adm.locator('input[type="search"], input[placeholder*="earch"]').first().fill(B.un);
  await adm.locator('tr', { hasText: '@' + B.un }).first().getByRole('button', { name: 'Delete' }).click();
  const dlg = adm.locator('[role="dialog"]');
  await dlg.locator('input[name="confirm"]').fill(B.un);
  await dlg.getByRole('button', { name: 'Delete account' }).click();
  await expect(adm.getByText(`@${B.un} deleted`)).toBeVisible({ timeout: 15_000 });
  expect(sql(`select count(*)::int n from auth.users where email = '${B.email}'`)[0].n).toBe(0);

  // phone width: every admin page fits, and Sign out is reachable
  await adm.setViewportSize({ width: 375, height: 812 });
  for (const s of ['dashboard', 'users', 'reports', 'verification', 'statuses', 'announcements', 'audit', 'admins']) {
    await adm.goto(base + '/admin/' + s);
    await expect(adm.locator('h1, h2').first()).toBeVisible();
    expect(await adm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), `admin ${s} overflows at 375px`).toBe(false);
  }
  await adm.getByRole('link', { name: 'Sign out' }).click();
  await expect(adm).toHaveURL(/\/admin\/login/, { timeout: 15_000 });

  canAdm.check();
});

test('no errors in either app', async () => {
  canA.check();
  canB.check();
});
