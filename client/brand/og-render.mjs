// KAN-42: captures the 1200 x 630 map behind the link preview, as og-map.png.
// Opens the home map, hides the app's UI, zooms and pans, and screenshots the map alone.
// build.mjs adds the street sign and the map credit.
//
//   node og-render.mjs                          # staging, Albuquerque, one zoom level in
//   ZOOM_IN=2 PAN=up,left node og-render.mjs
//   URL=http://localhost:5000/ node og-render.mjs
//
// ZOOM_IN: "+" presses on the map (one zoom level each; the map opens at 11.5).
// PAN: arrow keys, comma-separated (up, down, left, right); 80 px each.
import { chromium } from 'playwright';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const URL_ = process.env.URL || 'https://staging.betterbearings.net/';
const ZOOM_IN = Number(process.env.ZOOM_IN ?? 1);
const PAN = (process.env.PAN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const browser = await chromium.launch();
// bypassCSP: the site's Content-Security-Policy blocks the inline styles this script adds
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
  bypassCSP: true,
});
const page = await context.newPage();
await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-container');

// The map fills the window; the header, panels, controls and quiz circle are hidden
await page.addStyleTag({
  content: `
    body * { visibility: hidden !important; }
    .leaflet-container, .leaflet-tile-pane, .leaflet-tile-pane * { visibility: visible !important; }
    .leaflet-container { position: fixed !important; inset: 0 !important; width: 100vw !important;
      height: 100vh !important; z-index: 9000 !important; outline: none !important; }
    .leaflet-overlay-pane, .leaflet-tooltip-pane, .leaflet-marker-pane, .leaflet-control-container { display: none !important; }
  `,
});
await page.evaluate(() => window.dispatchEvent(new Event('resize'))); // Leaflet re-measures

await page.focus('.leaflet-container');
for (let i = 0; i < ZOOM_IN; i++) {
  await page.keyboard.press('Equal');
  await page.waitForTimeout(400);
}
for (const dir of PAN) {
  await page.keyboard.press(keyFor[dir]);
  await page.waitForTimeout(300);
}
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000); // vector tiles draw after they arrive

const file = path.join(here, 'og-map.png');
await page.screenshot({ path: file });
await browser.close();
console.log(`saved ${file} (zoom +${ZOOM_IN}, pan ${PAN.join(',') || 'none'})`);
