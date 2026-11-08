// The one place that knows where map tiles come from. main.jsx loads /api/config before render;
// every map calls addBaseLayer.
// A TILE_URL ending in .mvt or .pbf is our self-hosted vector tiles (KAN-54), drawn by
// protomaps-leaflet with street labels removed (KAN-55). Anything else is a raster tile URL,
// such as the OSM default.
import { leafletLayer, paintRules, labelRules } from 'protomaps-leaflet';
import { namedFlavor } from '@protomaps/basemaps';
import { API_URL } from '../config';

// The NM archive stops at z15; above that the renderer redraws the z15 data, so it stays sharp
const MAX_DATA_ZOOM = 15;
const MAX_ZOOM = 19;

let tiles = null;

export async function loadTileConfig() {
  try {
    const res = await fetch(`${API_URL}/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    tiles = body?.tiles?.url ? body.tiles : null;
  } catch (err) {
    console.error('Tile config unavailable; maps will have no base layer', err);
  }
}

export function isVectorTileUrl(url) {
  return /\.(mvt|pbf)(\?|$)/.test(url);
}

// Street names are the answers, so drop the "roads" label rules (names and highway shields).
// Place and water labels stay: they help players orient without naming any street.
function labelRulesWithoutStreets(flavor) {
  return labelRules(flavor, 'en').filter((rule) => rule.dataLayer !== 'roads');
}

export function addBaseLayer(map) {
  if (!tiles) return null;

  if (isVectorTileUrl(tiles.url)) {
    const flavor = namedFlavor('light');
    return leafletLayer({
      url: tiles.url,
      maxDataZoom: MAX_DATA_ZOOM,
      maxZoom: MAX_ZOOM,
      attribution: tiles.attribution,
      paintRules: paintRules(flavor),
      labelRules: labelRulesWithoutStreets(flavor),
      backgroundColor: flavor.background,
    }).addTo(map);
  }

  return window.L.tileLayer(tiles.url, {
    maxZoom: MAX_ZOOM,
    attribution: tiles.attribution,
  }).addTo(map);
}
