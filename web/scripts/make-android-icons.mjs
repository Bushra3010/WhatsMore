// Renders the WHATSMORE tricolour W logo into the Android launcher icons and splash screens
// (replacing the Capacitor template images). Run after `npx cap add android`.
import { chromium } from 'playwright';
import path from 'node:path';

const res = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'android/app/src/main/res');
const DEFS = `<defs>
  <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#1a73e8"/></linearGradient>
  <linearGradient id="t" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="46">
    <stop offset=".333" stop-color="#ff9933"/><stop offset=".333" stop-color="#ffffff"/><stop offset=".667" stop-color="#ffffff"/><stop offset=".667" stop-color="#1ea31a"/>
  </linearGradient></defs>`;
const W = `<path d="M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23" fill="none" stroke="url(#t)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${DEFS}${body}</svg>`;

const ICONS = {
  // legacy square-ish icon and round icon (Android 7 and older launchers)
  ic_launcher: svg('0 0 64 64', `<rect x="2" y="2" width="60" height="60" rx="16" fill="url(#b)"/>${W}`),
  ic_launcher_round: svg('0 0 64 64', `<circle cx="32" cy="32" r="30" fill="url(#b)"/>${W}`),
  // adaptive icon (Android 8+): the W inside the 66dp safe zone of a 108dp canvas, on a gradient
  ic_launcher_foreground: svg('-11.2 -10.2 86.4 86.4', W),
  ic_launcher_background: svg('0 0 64 64', `<rect width="64" height="64" fill="url(#b)"/>`),
};
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = { 'port-mdpi': [320, 480], 'port-hdpi': [480, 800], 'port-xhdpi': [720, 1280], 'port-xxhdpi': [960, 1600], 'port-xxxhdpi': [1280, 1920],
  'land-mdpi': [480, 320], 'land-hdpi': [800, 480], 'land-xhdpi': [1280, 720], 'land-xxhdpi': [1600, 960], 'land-xxxhdpi': [1920, 1280], '': [480, 320] };

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(html, w, h, file, transparent = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}
for (const [name, markup] of Object.entries(ICONS)) {
  for (const [d, k] of Object.entries(DENS)) {
    const size = Math.round((name.endsWith('foreground') || name.endsWith('background') ? 108 : 48) * k);
    await render(`<div style="width:${size}px;height:${size}px">${markup}</div>`, size, size, `${res}/mipmap-${d}/${name}.png`);
  }
}
for (const [dir, [w, h]] of Object.entries(SPLASH)) {
  const s = Math.round(Math.min(w, h) * 0.32);
  const html = `<div style="width:${w}px;height:${h}px;background:linear-gradient(135deg,#0b3d91,#1a73e8);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(s * 0.12)}px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="width:${s}px;height:${s}px">${svg('8 12 48 42', W)}</div>
    <div style="color:#fff;font-weight:800;letter-spacing:.12em;font-size:${Math.round(s * 0.2)}px">WHATSMORE</div></div>`;
  await render(html, w, h, `${res}/drawable${dir ? '-' + dir : ''}/splash.png`, false);
}
await browser.close();
console.log('Android icons and splash screens written');
