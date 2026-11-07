import { defineConfig, devices } from '@playwright/test';

// Runs against a dev server on port 3210 (started automatically if it isn't running), or against
// BASE_URL when set (e.g. the Vercel deployment).
const BASE_URL = process.env.BASE_URL || 'http://localhost:3210';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }, testMatch: /(smoke|flows|menus)\.spec/ },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run dev -- --port 3210', url: BASE_URL, reuseExistingServer: true, timeout: 120_000 },
});
