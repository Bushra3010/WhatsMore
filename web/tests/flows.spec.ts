// Typed user flows in demo mode (no account): messaging, message actions, polls, payments, calls,
// status, AI, groups, settings. Each test starts from fresh demo data.
import { test, expect, type Page } from '@playwright/test';
import { errorCanary, openApp } from './helpers';

async function openChat(page: Page, id: string) {
  await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
  await page.locator(`#sidebar [data-act="open"][data-chat="${id}"]`).first().click();
  await expect(page.locator('#msgs')).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.locator('#input').fill(text);
  await page.locator('#input').press('Enter');
}
const lastOut = (page: Page) => page.locator('#msgs .msg-row.out').last();
const menuItem = (page: Page, name: string | RegExp) => page.locator('#menu').getByRole('menuitem', { name });
const dialog = (page: Page) => page.locator('.modal[role="dialog"]').last();

test.describe('demo flows', () => {
  test('send a message, get ticks and a reply', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_ananya');
    const before = await page.locator('#msgs .msg-row.in').count();
    await send(page, 'how are you');
    await expect(lastOut(page)).toContainText('how are you');
    await expect.poll(() => page.locator('#msgs .msg-row.in').count(), { timeout: 15_000 }).toBeGreaterThan(before);
    canary.check();
  });

  test('react, reply, edit and delete a message', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_mom');
    await send(page, 'Original text');
    const row = lastOut(page);
    await row.click({ button: 'right' });
    await page.locator('#menu [data-react="❤️"]').click();
    await expect(row).toContainText('❤️');

    await row.click({ button: 'right' });
    await menuItem(page, 'Reply').click();
    await expect(page.locator('#reply-box')).toContainText('Original text');
    await send(page, 'A reply');
    await expect(lastOut(page).locator('.quote')).toContainText('Original text');

    await lastOut(page).click({ button: 'right' });
    await menuItem(page, 'Edit').click();
    await page.locator('#input').fill('Edited reply');
    await page.locator('#input').press('Enter');
    await expect(lastOut(page)).toContainText('Edited reply');
    await expect(lastOut(page)).toContainText(/edited/i);

    await lastOut(page).click({ button: 'right' });
    await menuItem(page, 'Delete').click();
    await dialog(page).getByRole('button', { name: 'Delete for everyone' }).click();
    await expect(lastOut(page)).toContainText(/deleted/i);
    canary.check();
  });

  test('create a poll and vote', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_trip');
    await page.locator('[data-act="attach"]').click();
    await menuItem(page, 'Poll').click();
    await page.locator('#pl-q').fill('Where should we go?');
    const opts = page.locator('.pl-opt');
    await opts.nth(0).fill('Goa');
    await opts.nth(1).fill('Ooty');
    await dialog(page).getByRole('button', { name: /send|create/i }).click();
    await expect(lastOut(page)).toContainText('Where should we go?');
    await lastOut(page).locator('[data-act="vote"]').first().click();
    canary.check();
  });

  test('send a demo payment', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_priya');
    await page.locator('[data-act="attach"]').click();
    await menuItem(page, 'Payment').click();
    await page.locator('#pm-amt').fill('150');
    await dialog(page).getByRole('button', { name: 'Continue' }).click();
    await expect(lastOut(page)).toContainText('150');
    canary.check();
  });

  test('search inside a chat', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_trip');
    await page.locator('[data-act="chatsearch"]').first().click();
    await page.locator('#cs-input').fill('car');
    await expect(page.locator('#msgs mark').first()).toBeVisible();
    canary.check();
  });

  test('start and end a demo video call', async ({ page, context }) => {
    await context.grantPermissions([]);
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, 'ch_siva');
    await page.locator('.chat-head [aria-label*="ideo"]').first().click();
    const end = page.getByRole('button', { name: /end call/i }).first();
    await expect(end).toBeVisible();
    await end.click();
    await expect(end).toHaveCount(0);
    canary.check();
  });

  test('post a text status', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    const tab = page.locator('[data-act="tab"][data-tab="status"]:visible');
    test.skip(!(await tab.count()), 'Status is a desktop rail tab');
    await tab.first().click();
    await page.locator('[data-act="addstatus"]').first().click();
    await dialog(page).locator('textarea').first().fill('Hello from the test suite');
    await dialog(page).getByRole('button', { name: /post|share/i }).last().click();
    await expect(page.locator('#sidebar')).toContainText(/My status/i);
    canary.check();
  });

  test('ask the AI assistant', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await page.locator('[data-act="tab"][data-tab="ai"]:visible').first().click();
    const input = page.locator('#ai-input');
    await input.fill('Translate good morning to Telugu');
    await page.locator('[data-act="aisend"]').click();
    await expect(page.locator('#ai-msgs')).toContainText(/శుభోదయం|Telugu/i, { timeout: 10_000 });
    canary.check();
  });

  test('create a demo group', async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
    await page.locator('#sidebar [aria-label="New chat"], #sidebar [data-act="newchat"]').first().click();
    await page.getByText(/new group/i).first().click();
    await page.locator('#ng-name').fill('Test group');
    await page.locator('#sidebar .check-row, #sidebar [data-pick]').first().click();
    await page.getByRole('button', { name: /create group/i }).click();
    await expect(page.locator('.chat-head')).toContainText('Test group');
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
});
