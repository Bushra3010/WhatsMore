// Command Center: pages are checked on the server, so nothing renders without an admin session.
import { test, expect } from '@playwright/test';
import { errorCanary } from './helpers';

const SECTIONS = ['dashboard', 'users', 'reports', 'verification', 'statuses', 'announcements', 'audit', 'admins'];

test('admin pages redirect to sign-in without a session', async ({ page }) => {
  for (const s of SECTIONS) {
    await page.goto('/admin/' + s);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
});

test('admin sign-in rejects wrong credentials', async ({ page }) => {
  const canary = errorCanary(page);
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
  await page.getByLabel('Email').fill('nobody-' + Date.now() + '@example.com');
  await page.getByLabel('Password').fill('wrong-password-123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/wrong email or password/i)).toBeVisible();
  canary.errors.splice(0, canary.errors.length, ...canary.errors.filter((e) => !/400|invalid/i.test(e)));
  canary.check();
});

test('the admin page has no app styles leaking in', async ({ page }) => {
  await page.goto('/admin/login');
  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(overflow).not.toBe('hidden');
});
