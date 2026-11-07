import { expect, type Page } from '@playwright/test';
import { loadFixture } from './accounts';

/** Collects page errors and console errors; call `check()` at the end of a test. */
export function errorCanary(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    // an action one area calls that no area registered
    if (m.type() === 'warning' && t.includes('[registry]')) { errors.push('missing action: ' + t); return; }
    if (m.type() !== 'error') return;
    // network noise that isn't an app bug (blocked camera, offline fonts, Supabase realtime reconnects)
    if (/Failed to load resource|NotAllowedError|websocket|ERR_INTERNET_DISCONNECTED|Download the React DevTools/i.test(t)) return;
    errors.push('console: ' + t);
  });
  return { errors, check: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Opens the app signed in as test account A (or B), with its live chats loaded. */
export async function openApp(page: Page, opts: { theme?: 'light' | 'dark'; as?: 'A' | 'B' } = {}) {
  const fx = loadFixture();
  const who = fx[opts.as || 'A'];
  await page.addInitScript((session) => { try { localStorage.setItem('wm-app-auth', JSON.stringify(session)); } catch { /* ignore */ } }, who.session);
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
  // the saved session is restored and the live chat with the other account syncs
  await expect(page.locator(`#sidebar [data-act="open"][data-chat="sb_${fx.conv}"]`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#onboard')).toHaveCount(0);
  if (opts.theme) await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, opts.theme);
}
/** The id of the live chat between A and B in the app. */
export const liveChatId = () => 'sb_' + loadFixture().conv;

/** True when the document is wider than the viewport (horizontal page scroll). */
export async function overflowX(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Close whatever modal/menu is open. */
export async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
}
