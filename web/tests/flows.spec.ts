// Typed user flows, signed in as test account A, in the live chat with test account B (no demo data).
// Tests run in parallel in the same chat, so each one uses its own unique text.
import { test, expect, type Page } from '@playwright/test';
import { errorCanary, openApp, liveChatId } from './helpers';
import { loadFixture } from './accounts';

async function openChat(page: Page, id = liveChatId()) {
  await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
  await page.locator(`#sidebar [data-act="open"][data-chat="${id}"]`).first().click();
  await expect(page.locator('#msgs')).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.locator('#input').fill(text);
  await page.locator('#input').press('Enter');
}
const uniq = (s: string) => `${s} ${Math.random().toString(36).slice(2, 7)}`;
const rowWith = (page: Page, text: string) => page.locator('#msgs .msg-row', { hasText: text }).last();
const menuItem = (page: Page, name: string | RegExp) => page.locator('#menu').getByRole('menuitem', { name });
const dialog = (page: Page) => page.locator('.modal[role="dialog"]').last();

test.describe('flows (live chat between test accounts)', () => {
  test('the live chat shows the other account and its messages', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    const fx = loadFixture();
    await expect(page.locator('.chat-head')).toContainText(fx.B.name);
    for (const t of fx.texts) await expect(rowWith(page, t)).toBeVisible();
    await expect(page.locator('.cloudbar')).toBeVisible();
    canary.check();
  });

  test('send a message; it is delivered to the server', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    const text = uniq('Delivery check');
    await send(page, text);
    await expect(rowWith(page, text).locator('.tick')).toBeVisible({ timeout: 15_000 });
    await expect(rowWith(page, text).locator('.tick.failed')).toHaveCount(0);
    canary.check();
  });

  test('react, reply, edit and delete a message', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    const text = uniq('Original text');
    await send(page, text);
    const row = rowWith(page, text);
    await expect(row.locator('.tick')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await row.click({ button: 'right' });
    await page.locator('#menu [data-react="❤️"]').click();
    await expect(row).toContainText('❤️');

    await row.click({ button: 'right' });
    await menuItem(page, 'Reply').click();
    await expect(page.locator('#reply-box')).toContainText(text);
    const reply = uniq('A reply');
    await send(page, reply);
    await expect(rowWith(page, reply).locator('.quote')).toContainText(text);

    await expect(rowWith(page, reply).locator('.tick')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await rowWith(page, reply).click({ button: 'right' });
    await menuItem(page, 'Edit').click();
    const edited = uniq('Edited reply');
    await page.locator('#input').fill(edited);
    await page.locator('#input').press('Enter');
    await expect(rowWith(page, edited)).toContainText(/edited/i);

    await rowWith(page, edited).click({ button: 'right' });
    await menuItem(page, 'Delete').click();
    await dialog(page).getByRole('button', { name: 'Delete for everyone' }).click();
    await expect(page.locator('#msgs')).not.toContainText(edited, { timeout: 15_000 });
    canary.check();
  });

  test('create a poll and vote', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    const q = uniq('Where should we go?');
    await page.locator('[data-act="attach"]').click();
    await menuItem(page, 'Poll').click();
    await page.locator('#pl-q').fill(q);
    const opts = page.locator('.pl-opt');
    await opts.nth(0).fill('Goa');
    await opts.nth(1).fill('Ooty');
    await dialog(page).getByRole('button', { name: /send|create/i }).click();
    await expect(rowWith(page, q)).toBeVisible();
    await page.waitForTimeout(1500); // the poll reaches the server before voting
    await rowWith(page, q).locator('[data-act="vote"]').first().click();
    await expect(rowWith(page, q)).toContainText(/1 vote/i);
    canary.check();
  });

  test('send a payment (demo money)', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    await page.locator('[data-act="attach"]').click();
    await menuItem(page, 'Payment').click();
    await page.locator('#pm-amt').fill('151');
    await dialog(page).getByRole('button', { name: 'Continue' }).click();
    await expect(rowWith(page, '151')).toBeVisible();
    canary.check();
  });

  test('search inside a chat', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page);
    const search = page.locator('[data-act="chatsearch"]:visible');
    if (await search.count()) await search.first().click();
    else { await page.locator('.chat-head [data-act="headmenu"]').click(); await page.locator('#menu').getByRole('menuitem', { name: 'Search' }).click(); } // phones: in the ⋮ menu
    await page.locator('#cs-input').fill('car park');
    await expect(page.locator('#msgs mark').first()).toBeVisible();
    canary.check();
  });

  test('the other account’s story is visible', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    const tab = page.locator('[data-act="tab"][data-tab="status"]:visible');
    test.skip(!(await tab.count()), 'Status is a desktop rail tab');
    await tab.first().click();
    await expect(page.locator('#sidebar')).toContainText(loadFixture().B.name, { timeout: 20_000 });
    canary.check();
  });

  test('post a text status', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    const tab = page.locator('[data-act="tab"][data-tab="status"]:visible');
    test.skip(!(await tab.count()), 'Status is a desktop rail tab');
    await tab.first().click();
    await page.locator('[data-act="addstatus"]').first().click();
    await dialog(page).locator('textarea').first().fill(uniq('Hello from the test suite'));
    await dialog(page).getByRole('button', { name: /post|share/i }).last().click();
    await expect(page.getByText(/Status shared with/)).toBeVisible({ timeout: 15_000 });
    canary.check();
  });

  test('ask the AI assistant', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await page.locator('[data-act="tab"][data-tab="ai"]:visible').first().click();
    await page.locator('#ai-input').fill('Translate good morning to Telugu');
    await page.locator('[data-act="aisend"]').click();
    await expect(page.locator('#ai-msgs')).toContainText(/శుభోదయం|Telugu/i, { timeout: 10_000 });
    canary.check();
  });

  test('create a live group with the other account', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    const name = uniq('Test group');
    await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
    await page.locator('#sidebar [aria-label="New chat"]').first().click();
    await page.getByText(/new group/i).first().click();
    await page.locator('#ng-name').fill(name);
    await page.locator('#sidebar .check-row', { hasText: loadFixture().B.name }).first().click();
    await page.getByRole('button', { name: /create group/i }).click();
    await expect(page.locator('.chat-head')).toContainText(name, { timeout: 15_000 });
    await expect(page.locator('.cloudbar')).toBeVisible();
    canary.check();
  });

  test('switch to dark theme from settings', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await page.locator('[data-act="tab"][data-tab="settings"]:visible').first().click();
    await page.locator('#sidebar [data-page="set-chats"]').first().click();
    await page.locator('#sidebar select').first().selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    canary.check();
  });

  test('reading the chat clears the Chats badge', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    const badge = page.locator('[data-act="tab"][data-tab="chats"]:visible .rail-badge');
    await expect(badge).toBeVisible(); // the other account's messages are unread on a new device
    await openChat(page);
    const back = page.locator('[data-act="closechat"]:visible');
    if (await back.count()) await back.first().click();
    await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
    await expect(page.locator(`#sidebar [data-chat="${liveChatId()}"] .badge:not(.grey)`)).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    canary.check();
  });

  test('a new install has no demo data and asks to sign in', async ({ page }) => {
    const canary = errorCanary(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText(/Try the demo/i)).toHaveCount(0);
    await expect(page.locator('#sidebar [data-act="open"][data-chat]')).toHaveCount(0);
    canary.check();
  });

  test('signing out removes the account from this device', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page, { as: 'B' });
    await page.locator('[data-act="tab"][data-tab="settings"]:visible').first().click();
    await page.locator('[data-act="cloudsignout"]').click();
    await page.locator('.modal').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#sidebar [data-act="open"][data-chat]')).toHaveCount(0);
    canary.check();
  });
});
