// KAN-42: builds BetterBearings' icons and link-preview image into client/public.
// Sources here: mark.js (the marks and colours), og-map.png (from og-render.mjs) and the
// Overpass font (fonts/, SIL OFL 1.1). See README.md.
//
//   node build.mjs              # writes to ../public
//   MARK=compass node build.mjs out/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { COLORS, markSvg, tileSvg } from './mark.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(process.argv[2] || path.join(here, '../public'));
const MARK = process.env.MARK || 'map'; // map or compass
const FONT = path.join(here, 'fonts');
const font = (w) =>
  `@font-face{font-family:Overpass;font-weight:${w};src:url(data:font/woff2;base64,${fs
    .readFileSync(path.join(FONT, `overpass-latin-${w}-normal.woff2`))
    .toString('base64')})}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`
  );
  await page.screenshot({ path: path.join(out, file), omitBackground: true });
}

// Browser tabs: the simplified mark (no ticks) on a rounded tile
for (const s of [16, 32])
  await png(tileSvg({ mark: MARK, size: s, small: true }), s, `favicon-${s}.png`);
await png(tileSvg({ mark: MARK, size: 48 }), 48, 'favicon-48.png');
fs.writeFileSync(path.join(out, 'favicon.svg'), tileSvg({ mark: MARK, small: true }) + '\n');
// Home screens. iOS rounds corners itself and turns transparency black, so its icon is full-bleed.
// Maskable keeps the mark inside the central 80% safe zone.
await png(
  tileSvg({ mark: MARK, size: 180, fullBleed: true, scale: 0.72 }),
  180,
  'apple-touch-icon.png'
);
await png(tileSvg({ mark: MARK, size: 192 }), 192, 'icon-192.png');
await png(tileSvg({ mark: MARK, size: 512 }), 512, 'icon-512.png');
await png(
  tileSvg({ mark: MARK, size: 512, fullBleed: true, scale: 0.6 }),
  512,
  'icon-maskable-512.png'
);

// Link preview: the map, with two street-name blades on a pole like a real intersection sign
// (MUTCD D3-1: green blade, thin white border inset from the edge, white mixed-case letters).
// The mark sits at the left end of the top blade, where many cities put their seal.
const map = fs.readFileSync(path.join(here, 'og-map.png')).toString('base64');
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<style>${font(400)}${font(700)}
  html,body{margin:0}
  body{width:1200px;height:630px;background:url(data:image/png;base64,${map});position:relative;font-family:Overpass;overflow:hidden}
  .post{position:absolute;left:96px;bottom:0;display:flex;flex-direction:column;align-items:flex-start}
  .pole{position:absolute;left:104px;top:-16px;bottom:0;width:20px;border-radius:10px 10px 0 0;
        background:linear-gradient(90deg,#7c858b,#c9d0d4 45%,#8d969b);box-shadow:2px 0 6px rgba(0,0,0,.25)}
  .blade{position:relative;background:${COLORS.green};color:#fff;border-radius:12px;
         box-shadow:inset 0 0 0 6px ${COLORS.green},inset 0 0 0 10px #fff,0 4px 10px rgba(0,0,0,.3)}
  .bracket{position:absolute;left:96px;width:36px;height:12px;background:linear-gradient(#aab3b8,#7c858b);border-radius:3px}
  .top{display:flex;align-items:center;gap:18px;padding:18px 38px 14px 24px}
  .top b{font-weight:700;font-size:70px;line-height:1;letter-spacing:.5px}
  .second{margin-top:18px;padding:14px 28px 10px;font-weight:700;font-size:31px;line-height:1;letter-spacing:.3px}
  .credit{position:absolute;right:0;bottom:0;background:rgba(255,255,255,.88);color:#374151;font:400 16px Overpass;padding:5px 12px 3px}
</style>
<div class="post" style="bottom:56px">
  <div class="pole" style="bottom:-56px"></div>
  <div class="blade top">${markSvg({ mark: MARK, size: 74 })}<b>BetterBearings</b><i class="bracket" style="top:-6px"></i><i class="bracket" style="bottom:-6px"></i></div>
  <div class="blade second">Learn your city's streets by name<i class="bracket" style="top:-6px"></i><i class="bracket" style="bottom:-6px"></i></div>
</div>
<div class="credit">Map data &copy; OpenStreetMap contributors, Protomaps</div>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(out, 'og-image.png') });
await browser.close();
// favicon.ico holds the 16, 32 and 48 px drawings above, each drawn at its own size
execFileSync('python3', [path.join(here, 'ico.py'), out], { stdio: 'inherit' });
console.log(`wrote the ${MARK} icons and og-image.png to ${out}`);
