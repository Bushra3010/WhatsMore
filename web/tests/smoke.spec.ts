// Click-everything smoke test: every rail tab, every settings page, every super-app module and every
// chat, in light and dark, at desktop and phone width (via the two projects). Fails on any page error,
// console error or horizontal page overflow.
import { test, expect, type Page } from '@playwright/test';
import { errorCanary, openApp, overflowX, closeOverlays } from './helpers';

const TABS = ['home', 'chats', 'status', 'calls', 'communities', 'files', 'ai', 'services', 'settings'];

async function openTab(page: Page, id: string) {
  const btn = page.locator(`[data-act="tab"][data-tab="${id}"]:visible`).first();
  if (!(await btn.count())) return false; // desktop-only tab on phones
  await btn.click({ timeout: 10_000 });
  return true;
}
async function goBack(page: Page) {
  const back = page.locator('[data-act="back"]:visible, [data-act="closeview"]:visible, [data-act="closechat"]:visible').first();
  if (await back.count()) await back.click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`smoke (${theme})`, () => {
    test('every tab renders', async ({ page }) => {
      const canary = errorCanary(page);
      await openApp(page, { theme });
      for (const t of TABS) {
        if (!(await openTab(page, t))) continue;
        await expect(page.locator('#sidebar')).not.toBeEmpty();
        expect(await overflowX(page), `overflow on tab ${t}`).toBe(false);
        // on phones the AI tab opens a full-screen view over the tab bar
        const close = page.locator('[data-act="closeview"]:visible').first();
        if (await close.count()) await close.click();
      }
      canary.check();
    });

    test('every settings page renders', async ({ page }) => {
      const canary = errorCanary(page);
      await openApp(page, { theme });
      await openTab(page, 'settings');
      const pages = await page.locator('#sidebar [data-act="page"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.page!));
      expect(pages.length).toBeGreaterThan(8);
      for (const p of pages) {
        await page.locator(`#sidebar [data-act="page"][data-page="${p}"]`).first().click();
        await expect(page.locator('#sidebar .page-head, #sidebar header').first()).toBeVisible();
        expect(await overflowX(page), `overflow on ${p}`).toBe(false);
        await goBack(page);
        await closeOverlays(page);
      }
      canary.check();
    });

    test('every super-app module opens', async ({ page }) => {
      const canary = errorCanary(page);
      await openApp(page, { theme });
      await openTab(page, 'services');
      const mods = await page.locator('[data-act="svc"].mod-tile').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.mod!));
      expect(mods.length).toBeGreaterThan(5);
      for (const m of mods) {
        await openTab(page, 'services');
        await page.locator(`[data-act="svc"][data-mod="${m}"].mod-tile`).first().click();
        await expect(page.locator('#main')).not.toBeEmpty();
        expect(await overflowX(page), `overflow in module ${m}`).toBe(false);
        await closeOverlays(page);
        await goBack(page);
      }
      canary.check();
    });

    test('every chat opens with its messages', async ({ page }) => {
      const canary = errorCanary(page);
      await openApp(page, { theme });
      await openTab(page, 'chats');
      const ids = await page.locator('#sidebar [data-act="open"][data-chat]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.chat!));
      expect(ids.length).toBeGreaterThan(5);
      for (const id of ids) {
        await openTab(page, 'chats');
        await page.locator(`#sidebar [data-act="open"][data-chat="${id}"]`).first().click();
        await expect(page.locator('#msgs')).toBeVisible();
        expect(await overflowX(page), `overflow in chat ${id}`).toBe(false);
        await closeOverlays(page);
        await goBack(page);
      }
      canary.check();
    });
  });
}
