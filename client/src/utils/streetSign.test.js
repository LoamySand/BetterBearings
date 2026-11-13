import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signParts } from './streetSign.js';

const parts = (name) => {
  const { prefix, main, suffix } = signParts(name);
  return [prefix, main, suffix];
};

test('street type and quadrant go small and abbreviated', () => {
  assert.deepEqual(parts('Central Avenue Southeast'), ['', 'Central', 'Ave SE']);
  assert.deepEqual(parts('Montgomery Boulevard Northeast'), ['', 'Montgomery', 'Blvd NE']);
  assert.deepEqual(parts('Gold Avenue'), ['', 'Gold', 'Ave']);
  assert.deepEqual(parts('4th Street Northwest'), ['', '4th', 'St NW']);
});

test('a leading direction is a small prefix', () => {
  assert.deepEqual(parts('North Diamond Drive'), ['N', 'Diamond', 'Dr']);
});

test('names without a type stay whole', () => {
  assert.deepEqual(parts('Paseo del Norte'), ['', 'Paseo del Norte', '']);
  assert.deepEqual(parts('Tramway'), ['', 'Tramway', '']);
  assert.deepEqual(parts('Interstate 40'), ['', 'Interstate 40', '']);
});

test('a word that is all the name is left alone', () => {
  // The type or direction would leave nothing to print large
  assert.deepEqual(parts('North Street'), ['', 'North', 'St']);
  assert.deepEqual(parts('Avenue'), ['', 'Avenue', '']);
  assert.deepEqual(parts('West'), ['', 'West', '']);
});

test('types only count at the end', () => {
  assert.deepEqual(parts('Avenue 20 EW'), ['', 'Avenue 20 EW', '']);
  assert.deepEqual(parts('Camino de la Sierra'), ['', 'Camino de la Sierra', '']);
});

test('extra spaces and empty input', () => {
  assert.deepEqual(parts('  Gold   Avenue  '), ['', 'Gold', 'Ave']);
  assert.deepEqual(parts(''), ['', '', '']);
  assert.deepEqual(parts(undefined), ['', '', '']);
});
