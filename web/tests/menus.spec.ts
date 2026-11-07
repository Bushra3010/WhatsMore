// Opens every item of the chat header menu, the attach menu and the message menu (closing whatever
// it opens), plus the document studio, story viewer and demo call controls. Fails on any error.
import { test, expect, type Page } from '@playwright/test';
import { errorCanary, openApp, liveChatId } from './helpers';

async function openChat(page: Page, id: string) {
  await page.locator('[data-act="tab"][data-tab="chats"]:visible').first().click();
  await page.locator(`#sidebar [data-act="open"][data-chat="${id}"]`).first().click();
  await expect(page.locator('#msgs')).toBeVisible();
}
/** Close menus, dialogs, overlays and views opened by a menu item, without leaving the chat. */
async function settle(page: Page) {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('#menu, .modal-backdrop, .studio, .story, .call, .lightbox, #drawer.open').count())) break;
    await page.keyboard.press('Escape');
    const close = page.locator('#drawer.open .drawer-head button:first-child, .modal [aria-label="Close"], .studio [aria-label="Close"], .story [data-act="story-close"], .call [data-act="call-end"], .call .cbtn.end, .lightbox [aria-label="Close"]').first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
  }
}
async function menuLabels(page: Page, open: () => Promise<void>) {
  await open();
  const labels = await page.locator('#menu [role="menuitem"]').allTextContents();
  await page.keyboard.press('Escape');
  return labels.map((l) => l.trim()).filter(Boolean);
}
// Items that leave the chat or change data in ways that would break the following items
const SKIP = /^(Clear chat|Exit group|Delete chat|Block|Delete|Report|Lock chat|Start secret chat)/;

for (const chat of ['live']) {
  test(`every header and attach menu item works in the ${chat} chat`, async ({ page }) => {
    const canary = errorCanary(page);
    await openApp(page);
    await openChat(page, liveChatId());
    for (const [name, opener] of [
      ['header', () => page.locator('.chat-head [data-act="headmenu"]').click()],
      ['attach', () => page.locator('[data-act="attach"]').click()],
    ] as const) {
      const labels = await menuLabels(page, opener);
      expect(labels.length, `${name} menu items`).toBeGreaterThan(3);
      for (const label of labels) {
        if (SKIP.test(label)) continue;
        await opener();
        await page.locator('#menu [role="menuitem"]', { hasText: label }).first().click();
        // file pickers can't be driven here; anything else should open without errors
        await page.waitForTimeout(250);
        await settle(page);
        if (!(await page.locator('#msgs').isVisible())) await openChat(page, liveChatId());
      }
    }
    canary.check();
  });
}

test('every message menu item works in the live chat', async ({ page }) => {
  test.setTimeout(180_000);
  const canary = errorCanary(page);
  await openApp(page);
  await openChat(page, liveChatId());
  const rows = page.locator('#msgs .msg-row');
  // one message of each kind (text, voice, document, poll, payment, …), incoming and outgoing
  const kinds = await rows.evaluateAll((els) => els.map((e) => e.className + '|' + ((e.querySelector('.pay-card,.poll,.doc,.voice,.img-wrap,.event-card,.loc,.contact-card') as HTMLElement | null)?.className.split(' ')[0] || 'text')));
  const pickIdx = kinds.map((k, i) => [k.replace(/ first| last/g, ''), i] as const).filter(([k], i, arr) => arr.findIndex(([x]) => x === k) === i).map(([, i]) => i);
  for (const i of pickIdx) {
    const row = rows.nth(i);
    await row.scrollIntoViewIfNeeded();
    await row.click({ button: 'right' });
    if (!(await page.locator('#menu').count())) continue;
    const labels = (await page.locator('#menu [role="menuitem"]').allTextContents()).map((l) => l.trim());
    await page.keyboard.press('Escape');
    for (const label of labels) {
      if (SKIP.test(label) || /^Edit/.test(label)) continue;
      await rows.nth(i).click({ button: 'right' });
      await page.locator('#menu [role="menuitem"]', { hasText: label }).first().click();
      await page.waitForTimeout(200);
      await settle(page);
      const cancel = page.locator('[data-act="cancelreply"]:visible');
      if (await cancel.count()) await cancel.first().click();
    }
  }
  canary.check();
});

test('document studio: open, AI proofread, close', async ({ page }) => {
  const canary = errorCanary(page);
  await openApp(page);
  await openChat(page, liveChatId());
  const doc = page.locator('#msgs [data-act="opendoc"]').first(); // meeting-notes.txt from the other account
  await doc.click();
  await expect(page.locator('.modal, .doc-viewer').first()).toBeVisible();
  const edit = page.getByRole('button', { name: /Edit & AI-correct/ }).first();
  if (await edit.isVisible().catch(() => false)) {
    await edit.click();
    await expect(page.locator('.studio')).toBeVisible();
    const proof = page.locator('.studio').getByRole('button', { name: /proofread|AI/i }).first();
    if (await proof.isVisible().catch(() => false)) await proof.click();
  }
  await settle(page);
  canary.check();
});

test('story viewer: open, next, react, close', async ({ page }) => {
  const canary = errorCanary(page);
  await openApp(page);
  const tab = page.locator('[data-act="tab"][data-tab="status"]:visible');
  test.skip(!(await tab.count()), 'desktop rail tab');
  await tab.first().click();
  await page.locator('[data-act="viewstatus"]').first().click();
  await expect(page.locator('.story')).toBeVisible();
  await page.locator('[data-act="story-next"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('[data-act="story-react"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await expect(page.locator('.story')).toHaveCount(0);
  canary.check();
});

test('call-link meeting: every control works', async ({ page }) => {
  const canary = errorCanary(page);
  await openApp(page);
  const calls = page.locator('[data-act="tab"][data-tab="calls"]:visible');
  test.skip(!(await calls.count()), 'Calls is a desktop rail tab');
  await calls.first().click();
  await page.locator('#sidebar [data-act="calllink"]').first().click();
  await page.locator('.modal').getByRole('button', { name: 'Join now' }).click();
  await expect(page.locator('.call')).toBeVisible();
  await page.waitForTimeout(2500); // connects
  const acts = await page.locator('.call [data-act]').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset.act!))]);
  for (const act of acts) {
    if (/end|hangup/.test(act)) continue;
    const btn = page.locator(`.call [data-act="${act}"]:visible`).first();
    if (!(await btn.count())) continue;
    await btn.click().catch(() => {});
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    for (let i = 0; i < 2 && await page.locator('.modal-backdrop').count(); i++) await page.locator('.modal [aria-label="Close"]').first().click().catch(() => {});
  }
  await page.locator('.call .cbtn.end').first().click();
  await expect(page.locator('.call')).toHaveCount(0);
  canary.check();
});
