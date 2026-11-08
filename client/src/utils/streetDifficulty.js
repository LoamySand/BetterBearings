// Per-street difficulty inside a saved set (KAN-72): 1 Easy, 2 Medium, 3 Hard.
// The label means "how hard to find compared with the rest of this set", so it's relative:
// line the streets up from easiest to find to hardest and cut the line into thirds.
// Easiest = bigger road class first, then longer first (a long street crosses more of the map).
// StreetSetDetail shows and sorts by it; gameplay doesn't read it.

const CLASS_RANK = {
  motorway: 0,
  trunk: 0,
  primary: 0,
  secondary: 1,
  tertiary: 2,
};
const SMALLEST_CLASS = 3; // residential, service, unclassified, cycleway, and anything new

const classRank = (type) => CLASS_RANK[type] ?? SMALLEST_CLASS;

/**
 * Returns a copy of `streets` with `difficulty` set on each, in the original order.
 * When the count doesn't divide by 3, Easy gets the extra first, then Medium (4 -> 2/1/1).
 */
export function assignDifficulty(streets) {
  const order = streets
    .map((street, index) => ({ index, rank: classRank(street.type), length: street.length || 0 }))
    .sort((a, b) => a.rank - b.rank || b.length - a.length);

  const n = order.length;
  const easyEnd = Math.ceil(n / 3);
  const mediumEnd = easyEnd + Math.ceil((n - easyEnd) / 2);

  const difficulties = new Array(n);
  order.forEach(({ index }, position) => {
    difficulties[index] = position < easyEnd ? 1 : position < mediumEnd ? 2 : 3;
  });
  return streets.map((street, index) => ({ ...street, difficulty: difficulties[index] }));
}
