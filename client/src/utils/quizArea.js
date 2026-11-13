// The Current Location quiz area (KAN-76). The circle on the selection map and the Play
// button both come from quizAreaFor, so the circle shows exactly what will be quizzed.

// /api/streets accepts up to 5000 m (server/routes/schema.js), the same limit as set creation
export const MAX_RADIUS = 5000;
// Smaller areas rarely hold the 2 streets a game needs
export const MIN_RADIUS = 500;

// The circle fills this share of the distance to the nearest map edge, so it stays on screen
export const FIT = 0.9;

/**
 * Center of the map and a radius that keeps the circle inside the visible map:
 * FIT x the distance to the nearest edge, capped at MAX_RADIUS. Zoomed out, the cap holds and
 * the circle shrinks on screen; zoomed in, the radius shrinks with the view.
 * @param map a Leaflet map (getBounds, getCenter, distance)
 * @returns {{ center: { lat: number, lng: number }, radius: number, tooSmall: boolean }}
 */
export function quizAreaFor(map) {
  const bounds = map.getBounds();
  // The visual center; the bounds midpoint drifts from it on a Mercator map when zoomed out
  const center = map.getCenter();
  const nearestEdge = Math.min(
    map.distance(center, { lat: bounds.getNorth(), lng: center.lng }),
    map.distance(center, { lat: bounds.getSouth(), lng: center.lng }),
    map.distance(center, { lat: center.lat, lng: bounds.getEast() }),
    map.distance(center, { lat: center.lat, lng: bounds.getWest() })
  );
  const radius = Math.min(FIT * nearestEdge, MAX_RADIUS);
  return {
    center: { lat: center.lat, lng: center.lng },
    radius,
    tooSmall: radius < MIN_RADIUS,
  };
}

/**
 * Size label for the circle: meters under 1 km, one decimal under 10 km, whole km above.
 * 800 -> "800 m", 999 -> "1 km", 2449 -> "2.4 km", 5000 -> "5 km"
 */
export function formatRadius(meters) {
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1000) return `${rounded} m`;
  if (meters < 10000) {
    const km = Math.round(meters / 100) / 10;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Math.round(meters / 1000)} km`;
}

/** Text of the label on the circle */
export function circleLabel({ radius, tooSmall }) {
  return tooSmall ? `Zoom out: min ${formatRadius(MIN_RADIUS)}` : `${formatRadius(radius)} radius`;
}
