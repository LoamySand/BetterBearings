// Picks a game's questions from a pool of streets, once, before the first round.
//
// Rules (KAN-70):
// - No street is asked twice: questions are drawn without replacement.
// - The pool has at least 2x as many streets as questions, so the last question isn't
//   answered by elimination. A smaller pool caps the question count.
// - Every street in the pool is drawn on the map as an option, not only the questions.

export const MIN_POOL = 2;

// Quiz This Area levels to the per-street labels saved in a set (KAN-73): 1 Easy, 2 Medium, 3 Hard.
export const LEVELS = { easy: 1, medium: 2, hard: 3 };

// Cumulative, like Tourist/Resident/Taxi Driver: Medium plays Easy and Medium streets.
// A street with no label counts as Hard, so it only shows up when everything is allowed.
export function filterByLevel(streets, level) {
  const max = LEVELS[level] ?? LEVELS.hard;
  return (Array.isArray(streets) ? streets : []).filter(
    (s) => (s.difficulty ?? LEVELS.hard) <= max
  );
}

// Fisher-Yates on a copy. `random` is injectable so tests can make it deterministic.
export function shuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Most questions a pool of `poolSize` streets allows under the 2x rule.
export function maxQuestionsFor(poolSize) {
  return Math.floor(Math.max(0, poolSize) / MIN_POOL);
}

/**
 * @param {Array} pool streets that can appear in this game
 * @param {number} requested question count the player chose
 * @returns {{ options: Array, questions: Array, count: number, requested: number, capped: boolean }}
 *   `options` is `pool` itself (same array), so a replay of the same pool doesn't redraw the map.
 *   `count` is 0 when the pool is too small to play.
 */
export function planGame(pool, requested, random = Math.random) {
  const streets = Array.isArray(pool) ? pool : [];
  const wanted = Math.max(1, Math.floor(Number(requested) || 0));
  const count = Math.min(wanted, maxQuestionsFor(streets.length));
  return {
    options: streets,
    questions: shuffle(streets, random).slice(0, count),
    count,
    requested: wanted,
    capped: count < wanted,
  };
}
