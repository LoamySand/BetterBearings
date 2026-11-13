// BetterBearings marks (KAN-42), drawn in a 24-unit grid. Street-sign palette.
// map: a tri-fold paper map with a location pin. compass: a compass with the needle at 35 degrees.
export const COLORS = { green: '#0b6b4a', white: '#ffffff', yellow: '#f5c400' };

// `small` drops detail that blurs below about 24 px.
function compassBody({ color, accent, small }) {
  const ticks = small
    ? ''
    : `<path d="M12 3.4v1.6M12 19v1.6M3.4 12H5M19 12h1.6" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`;
  return `<circle cx="12" cy="12" r="8.6" fill="none" stroke="${color}" stroke-width="${small ? 2.2 : 1.6}"/>${ticks}
<g transform="rotate(35 12 12)"><path d="M12 ${small ? 4.6 : 5.6} 14.6 12H9.4z" fill="${accent}"/><path d="M12 ${small ? 19.4 : 18.4} 14.6 12H9.4z" fill="${color}" opacity=".85"/></g>`;
}

function mapBody({ color, accent, ground, small }) {
  // Three panels; the middle one sits in the fold's shadow. Streets are cut in the ground colour.
  const streets = small
    ? ''
    : `<g stroke="${ground}" stroke-width=".8" stroke-linecap="round" opacity=".55" fill="none"><path d="M3 13.4l5.6-1.7 6.6 2L21 12M5.9 6.4v13M18.1 6.4v13M3 17.2l5.6-1.8"/></g>`;
  // Pin: larger at small sizes so it still reads as a pin
  const pin = small
    ? `<path d="M15.6.9a5 5 0 0 1 5 5c0 3.7-5 8.6-5 8.6s-5-4.9-5-8.6a5 5 0 0 1 5-5z" fill="${accent}" stroke="${ground}" stroke-width="1.2"/><circle cx="15.6" cy="5.9" r="1.8" fill="${ground}"/>`
    : `<path d="M15.2 1.6a4.4 4.4 0 0 1 4.4 4.4c0 3.2-4.4 7.6-4.4 7.6s-4.4-4.4-4.4-7.6a4.4 4.4 0 0 1 4.4-4.4z" fill="${accent}" stroke="${ground}" stroke-width="1.1"/><circle cx="15.2" cy="6" r="1.6" fill="${ground}"/>`;
  return `<path d="M3 7.2 8.6 5v13.4L3 20.6z" fill="${color}"/>
<path d="M8.6 5l6.6 2.2v13.4l-6.6-2.2z" fill="${color}" opacity="${small ? 0.62 : 0.74}"/>
<path d="M15.2 7.2 21 5v13.4l-5.8 2.2z" fill="${color}"/>${streets}${pin}`;
}

const BODIES = { compass: compassBody, map: mapBody };

// The mark alone, e.g. white on the green sign. `ground` is the colour behind it.
export function markSvg({
  mark = 'map',
  size = 24,
  color = COLORS.white,
  accent = COLORS.yellow,
  ground = COLORS.green,
  small = false,
} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${BODIES[mark]({ color, accent, ground, small })}</svg>`;
}

// The mark on a green tile. Rounded by default; fullBleed fills the square for platforms that
// apply their own mask. `scale` is the mark's share of the tile.
export function tileSvg({
  mark = 'map',
  size,
  small = false,
  fullBleed = false,
  scale = 0.8,
} = {}) {
  const offset = (24 * (1 - scale)) / 2;
  const sizeAttrs = size ? ` width="${size}" height="${size}"` : '';
  const body = BODIES[mark]({
    color: COLORS.white,
    accent: COLORS.yellow,
    ground: COLORS.green,
    small,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg"${sizeAttrs} viewBox="0 0 24 24"><rect width="24" height="24"${fullBleed ? '' : ' rx="5"'} fill="${COLORS.green}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${body}</g></svg>`;
}
