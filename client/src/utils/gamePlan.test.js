import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planGame, maxQuestionsFor, shuffle, filterByLevel } from './gamePlan.js';

const pool = (n) => Array.from({ length: n }, (_, i) => ({ name: `Street ${i + 1}` }));

test('never asks the same street twice', () => {
  const streets = pool(12);
  for (let run = 0; run < 1000; run++) {
    const { questions } = planGame(streets, 5);
    const names = questions.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `repeat in run ${run}: ${names}`);
  }
});

test('the pool is at least twice the question count', () => {
  for (let n = 0; n <= 40; n++) {
    for (const requested of [1, 5, 10, 20]) {
      const { count, options } = planGame(pool(n), requested);
      assert.ok(options.length >= 2 * count, `pool ${n}, requested ${requested}, count ${count}`);
    }
  }
});

test('a pool large enough gives the requested count, uncapped', () => {
  const plan = planGame(pool(10), 5);
  assert.equal(plan.count, 5);
  assert.equal(plan.questions.length, 5);
  assert.equal(plan.capped, false);
});

test('a small pool caps the count and says so', () => {
  const plan = planGame(pool(7), 5);
  assert.equal(plan.count, 3);
  assert.equal(plan.questions.length, 3);
  assert.equal(plan.capped, true);
  assert.equal(plan.requested, 5);
});

test('a pool under 2 streets cannot be played', () => {
  for (const n of [0, 1]) {
    const plan = planGame(pool(n), 5);
    assert.equal(plan.count, 0);
    assert.deepEqual(plan.questions, []);
  }
  assert.deepEqual(planGame(null, 5).questions, []);
});

test('every option in the pool is offered, and questions come from it', () => {
  const streets = pool(20);
  const plan = planGame(streets, 5);
  assert.equal(plan.options, streets, 'options is the pool itself');
  for (const q of plan.questions) assert.ok(streets.includes(q));
});

test('the pool array is not mutated', () => {
  const streets = pool(10);
  const before = streets.map((s) => s.name);
  planGame(streets, 5);
  assert.deepEqual(
    streets.map((s) => s.name),
    before
  );
});

test('maxQuestionsFor is half the pool, rounded down', () => {
  assert.deepEqual([0, 1, 2, 3, 20, 21].map(maxQuestionsFor), [0, 0, 1, 1, 10, 10]);
});

test('shuffle reaches every position (not a biased sort)', () => {
  // Each of 4 items should land first about 25% of the time over 4000 shuffles.
  const counts = new Map();
  for (let i = 0; i < 4000; i++) {
    const first = shuffle(['a', 'b', 'c', 'd'])[0];
    counts.set(first, (counts.get(first) || 0) + 1);
  }
  for (const item of ['a', 'b', 'c', 'd']) {
    const share = (counts.get(item) || 0) / 4000;
    assert.ok(share > 0.2 && share < 0.3, `${item} first ${(share * 100).toFixed(1)}%`);
  }
});

test('requested counts below 1 or non-numeric become 1', () => {
  assert.equal(planGame(pool(10), 0).count, 1);
  assert.equal(planGame(pool(10), 'abc').count, 1);
});

test('filterByLevel is cumulative: easy, then easy + medium, then all', () => {
  const streets = [1, 2, 3, 1, 2, undefined].map((difficulty, i) => ({
    name: `S${i}`,
    difficulty,
  }));
  const names = (level) => filterByLevel(streets, level).map((s) => s.name);
  assert.deepEqual(names('easy'), ['S0', 'S3']);
  assert.deepEqual(names('medium'), ['S0', 'S1', 'S3', 'S4']);
  assert.deepEqual(names('hard'), ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
  assert.equal(filterByLevel(streets, 'unknown').length, 6, 'unknown level plays everything');
  assert.deepEqual(filterByLevel(null, 'easy'), []);
});
