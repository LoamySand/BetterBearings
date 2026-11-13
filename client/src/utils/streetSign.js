// Splits a street name the way a US street-name sign prints it (KAN-81): the name large, the
// street type and the quadrant small and abbreviated. "Central Avenue Southeast" becomes
// { prefix: '', main: 'Central', suffix: 'Ave SE' }.
// Abbreviations are USPS Publication 28's. OpenStreetMap spells names out in full, so the map
// data never has them abbreviated already.

const TYPES = {
  Alley: 'Aly',
  Avenue: 'Ave',
  Boulevard: 'Blvd',
  Circle: 'Cir',
  Court: 'Ct',
  Crossing: 'Xing',
  Drive: 'Dr',
  Expressway: 'Expy',
  Freeway: 'Fwy',
  Highway: 'Hwy',
  Lane: 'Ln',
  Loop: 'Loop',
  Parkway: 'Pkwy',
  Place: 'Pl',
  Plaza: 'Plz',
  Road: 'Rd',
  Square: 'Sq',
  Street: 'St',
  Terrace: 'Ter',
  Trail: 'Trl',
  Way: 'Way',
};

const DIRECTIONS = {
  North: 'N',
  South: 'S',
  East: 'E',
  West: 'W',
  Northeast: 'NE',
  Northwest: 'NW',
  Southeast: 'SE',
  Southwest: 'SW',
};

export function signParts(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const small = [];

  // A trailing direction ("... Northeast"), then a trailing street type ("... Avenue").
  // Each only counts if a name is left in front of it, so "Avenue" on its own stays whole.
  if (words.length > 1 && DIRECTIONS[words.at(-1)]) small.unshift(DIRECTIONS[words.pop()]);
  if (words.length > 1 && TYPES[words.at(-1)]) small.unshift(TYPES[words.pop()]);

  // A leading direction ("North Main Street")
  let prefix = '';
  if (words.length > 1 && DIRECTIONS[words[0]]) prefix = DIRECTIONS[words.shift()];

  return { prefix, main: words.join(' '), suffix: small.join(' ') };
}
