// The one place that knows where map tiles come from. main.jsx loads /api/config before render;
// every map calls addBaseLayer. T3 swaps the raster layer for a vector one here.
import { API_URL } from '../config';

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

export function addBaseLayer(map) {
  if (!tiles) return null;
  return window.L.tileLayer(tiles.url, {
    maxZoom: 19,
    attribution: tiles.attribution,
  }).addTo(map);
}
