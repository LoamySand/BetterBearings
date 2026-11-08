// Map tile source, read from env at runtime so a provider switch is an .env edit plus restart,
// not a client rebuild. GET /api/config serves it to the client; app.js builds the CSP from it.
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function readTileConfig(env = process.env) {
  // compose passes unset values as empty strings, so treat '' as unset
  const url = env.TILE_URL || DEFAULT_TILE_URL;
  const attribution = env.TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION;

  if (!['{z}', '{x}', '{y}'].every((p) => url.includes(p))) {
    throw new Error('TILE_URL must contain {z}, {x} and {y}');
  }

  // A path such as /tiles/{z}/{x}/{y}.mvt is same-origin and already covered by 'self'
  if (url.startsWith('/')) return { url, attribution, origin: null };

  let parsed;
  try {
    parsed = new URL(url.replace(/\{[a-z]+\}/g, '0'));
  } catch {
    throw new Error('TILE_URL must be an absolute https URL or a path starting with /');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('TILE_URL must use https');
  }
  return { url, attribution, origin: parsed.origin };
}

module.exports = { readTileConfig, DEFAULT_TILE_URL, DEFAULT_TILE_ATTRIBUTION };
