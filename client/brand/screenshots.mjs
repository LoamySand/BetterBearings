// L2 (KAN-68): the README screenshots, docs/screenshot-desktop.png and docs/screenshot-mobile.png.
// Plays an Easy game as a guest, makes one correct guess with keyboard play, zooms to the game's
// streets and captures round 2 with its sign showing (score 10), on a desktop and on a phone.
//
//   CENTER=35.13,-106.55 node brand/screenshots.mjs      # staging, centered on CENTER
//   CENTER=... ZOOM=14,13 node brand/screenshots.mjs     # zoom on desktop, phone
//   CENTER=... URL=http://localhost:5000/ node brand/screenshots.mjs
//   CENTER=... FIT=0 node brand/screenshots.mjs          # keep the game's own whole-city view
//
// CENTER is required: the lat,lng the quiz circle is centered on.
// ZOOM: whole zoom levels (the map snaps to them). Each run prints the circle's radius, so a
// different zoom is easy to try. The phone's map is narrower, so it needs one level less for a
// circle of about the same size.
import { chromium, devices } from 'playwright';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, '..', '..', 'docs');
const URL_ = process.env.URL || 'https://staging.betterbearings.net/';
const center = (process.env.CENTER || '').split(',').map(Number);
if (center.length !== 2 || center.some((n) => !Number.isFinite(n))) {
  console.error('Set CENTER=lat,lng, the center of the quiz circle');
  process.exit(1);
}
const [desktopZoom, phoneZoom] = (process.env.ZOOM || '14,13').split(',').map(Number);

const shots = [
  {
    name: 'desktop',
    zoom: desktopZoom,
    options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  },
  // Pixel 7: 412 x 915 at 2.625x, a common Android phone. Chromium only, so no iPhone profile.
  { name: 'mobile', zoom: phoneZoom, options: devices['Pixel 7'] },
];

// Keeps a handle on every Leaflet map the page makes, so the script can move the selection map
// and find the answer's street on the game map. Runs before the app, so nothing in it changes.
function watchMaps() {
  let leaflet;
  Object.defineProperty(window, 'L', {
    configurable: true,
    get: () => leaflet,
    set(value) {
      leaflet = value;
      value.Map.addInitHook(function track() {
        window.__maps = (window.__maps || []).concat(this);
      });
    },
  });
}

const browser = await chromium.launch();
for (const shot of shots) {
  const context = await browser.newContext(shot.options);
  await context.addInitScript(watchMaps);
  const page = await context.newPage();
  const phone = !!shot.options.isMobile;

  await page.goto(URL_);
  await page.waitForSelector('.quiz-circle-label');
  await page.evaluate(
    ([lat, lng, zoom]) => window.__maps.at(-1).setView([lat, lng], zoom, { animate: false }),
    [...center, shot.zoom]
  );
  // Tiles and the circle catch up with the new view
  await page.waitForTimeout(1500);
  const radius = await page.textContent('.quiz-circle-label');

  if (phone) await page.click('.quiz-toggle');
  await page.click('.quiz-play');
  await page.waitForSelector('.game-street-name');
  await page.waitForTimeout(800);

  // Round 1, by keyboard play: Space moves the highlight one street at a time and Enter guesses.
  // Clicking a point on the line proved unreliable on real data. A highlighted street is drawn
  // 4 px wider than its resting weight, which is how the script sees which one it is on.
  const answer = await page.textContent('.game-street-name');
  await page.evaluate(() => document.activeElement?.blur());
  const highlighted = () =>
    page.evaluate(() => {
      let name = null;
      window.__maps.at(-1).eachLayer((layer) => {
        if (layer.streetName && layer.options.weight === layer.baseWeight + 4) {
          name = layer.streetName;
        }
      });
      return name;
    });
  let found = false;
  for (let i = 0; i < 400 && !found; i++) {
    await page.keyboard.press('Space');
    found = (await highlighted()) === answer;
  }
  if (!found) throw new Error(`Space never reached "${answer}"`);
  await page.keyboard.press('Enter');

  try {
    await page.waitForFunction(() => /Round:? 2\//.test(document.body.innerText), null, {
      timeout: 8000,
    });
  } catch (err) {
    await page.screenshot({ path: path.join(out, `debug-${shot.name}.png`) });
    const panel = await page.textContent('.question-panel').catch(() => '');
    console.error(`${shot.name}: no round 2 after guessing "${answer}". Panel: ${panel}`);
    throw err;
  }

  // The game map opens at a whole-city zoom. Zoom to the game's streets, as a player would,
  // keeping them clear of the question card (desktop) or the bottom panel (phone).
  if (process.env.FIT !== '0') {
    await page.evaluate(() => {
      const map = window.__maps.at(-1);
      const box = map.getContainer().getBoundingClientRect();
      const card = document.querySelector('.question-panel').getBoundingClientRect();
      const bounds = window.L.latLngBounds([]);
      map.eachLayer((layer) => {
        if (layer.streetName) bounds.extend(layer.getBounds());
      });
      const bottomSheet = card.width > box.width / 2;
      map.fitBounds(bounds, {
        animate: false,
        paddingTopLeft: [24, 24],
        paddingBottomRight: bottomSheet
          ? [24, box.bottom - card.top + 24]
          : [box.right - card.left + 24, 24],
      });
    });
  }
  // Tiles for the new view, and the round's sign
  await page.waitForTimeout(2500);
  const score = await page.evaluate(
    () => document.querySelector('.game-stat span, .question-stats span:last-child')?.textContent
  );
  const file = path.join(out, `screenshot-${shot.name}.png`);
  await page.screenshot({ path: file });
  console.log(
    `${shot.name}: zoom ${shot.zoom}, ${radius}, round 1 "${answer}", ${score} -> ${file}`
  );
  await context.close();
}
await browser.close();
