# Brand sources

Everything in `client/public` that carries the BetterBearings mark is built from here (KAN-42).
Change a source, rebuild, and commit the regenerated files.

| File | What it is |
| --- | --- |
| `mark.js` | The mark and colours: sign green `#0b6b4a`, white, sign yellow `#f5c400`. `map` (folded map with a pin) is current; `compass` is the alternative. |
| `build.mjs` | Writes `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `og-image.png` to `../public`. |
| `ico.py` | Packs the 16, 32 and 48 px drawings into `favicon.ico`. Called by `build.mjs`. |
| `og-render.mjs` | Captures `og-map.png`, the map behind the link preview, from the running site. |
| `og-map.png` | The current capture: central Albuquerque from staging, one zoom level in (Nov 13, 2026). |
| `fonts/` | Overpass Regular and Bold, used only in `og-image.png`. SIL Open Font License 1.1, see `fonts/OFL.txt`. |

The link preview credits the map in its corner: map data © OpenStreetMap contributors (ODbL), style by Protomaps.

## Rebuild

Needs Node, Python 3 with Pillow (`sudo dnf install python3-pillow`) and Playwright's Chromium. Playwright isn't a project dependency; install it without saving:

```bash
cd client
npm i --no-save playwright && npx playwright install chromium
node brand/build.mjs                 # icons and og-image.png into public/
node brand/og-render.mjs             # optional: a new og-map.png first (ZOOM_IN, PAN, URL; see the file)
```

`npm ci` removes Playwright again.
