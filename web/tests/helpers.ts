import { expect, type Page } from '@playwright/test';

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

/** Opens the app with onboarding finished (demo mode, no account). */
export async function openApp(page: Page, opts: { theme?: 'light' | 'dark' } = {}) {
  await page.addInitScript(() => { try { sessionStorage.setItem('wm-welcome', '1'); } catch { /* ignore */ } });
  await page.goto('/');
  // first run shows the splash, then the welcome screen with the demo option
  const skip = page.getByRole('button', { name: 'Try the demo without an account' });
  await skip.click({ timeout: 15_000 });
  await expect(page.locator('#onboard')).toHaveCount(0);
  await expect(page.locator('#app')).toBeVisible();
  if (opts.theme) await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, opts.theme);
}

/** True when the document is wider than the viewport (horizontal page scroll). */
export async function overflowX(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Close whatever modal/menu is open. */
export async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
}
