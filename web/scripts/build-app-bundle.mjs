// Builds the WHATSMORE app (the "/" route only) as static files for the Android app (Capacitor).
// The admin panel needs a server (it checks admin rights per request), so it isn't part of the APK:
// it stays on the website. This copies the project to .apk-build/, leaves out the admin routes and
// proxy, switches Next.js to a static export, builds, and leaves the result in .apk-build/out.
// The same static app is published on GitHub Pages: set WM_BASE_PATH=/WhatsMore for that build.
// NEXT_PUBLIC_ADMIN_URL sets where "Open the real Command Center" points (the admin is on the web).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dest = path.join(root, '.apk-build');
const SKIP = new Set(['node_modules', '.next', '.apk-build', 'android', 'tests', 'test-results', 'playwright-report', 'proxy.ts', 'scripts']);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest);
for (const entry of readdirSync(root)) {
  if (SKIP.has(entry) || entry.startsWith('.env')) continue;
  cpSync(path.join(root, entry), path.join(dest, entry), {
    recursive: true,
    filter: (src) => !path.relative(root, src).startsWith(path.join('app', 'admin')),
  });
}
symlinkSync(path.join(root, 'node_modules'), path.join(dest, 'node_modules'), 'dir');
writeFileSync(path.join(dest, 'next.config.ts'), `import type { NextConfig } from 'next';
// Static export for the Android app (see scripts/build-app-bundle.mjs).
const nextConfig: NextConfig = { output: 'export', images: { unoptimized: true }, devIndicators: false, trailingSlash: true${process.env.WM_BASE_PATH ? `, basePath: '${process.env.WM_BASE_PATH}'` : ''} };
export default nextConfig;
`);
execSync('npx next build', { cwd: dest, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
if (!existsSync(path.join(dest, 'out', 'index.html'))) throw new Error('static export did not produce out/index.html');
console.log('App bundle ready: .apk-build/out');
