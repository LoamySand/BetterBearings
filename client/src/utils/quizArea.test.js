import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quizAreaFor, formatRadius, circleLabel, MAX_RADIUS, MIN_RADIUS, FIT } from './quizArea.js';

// A fake Leaflet map. halfHeight and halfWidth are the meters from the center to the
// north/south and east/west edges; distance() is flat meters, which is all quizAreaFor needs.
const M_PER_DEG = 111_320;
const fakeMap = ({ halfHeight, halfWidth }) => {
  const center = { lat: 35.0844, lng: -106.6504 };
  const dLat = halfHeight / M_PER_DEG;
  const dLng = halfWidth / M_PER_DEG;
  return {
    getCenter: () => center,
    getBounds: () => ({
      getNorth: () => center.lat + dLat,
      getSouth: () => center.lat - dLat,
      getEast: () => center.lng + dLng,
      getWest: () => center.lng - dLng,
    }),
    distance: (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng) * M_PER_DEG,
  };
};

test('radius fits inside the nearest edge', () => {
  // Phone in portrait: the side edges are nearest
  const area = quizAreaFor(fakeMap({ halfHeight: 3000, halfWidth: 1500 }));
  assert.equal(FIT, 0.9);
  assert.ok(Math.abs(area.radius - 1350) < 1, `radius ${area.radius}`);
  assert.deepEqual(area.center, { lat: 35.0844, lng: -106.6504 });
  assert.equal(area.tooSmall, false);
});

test('a wide map is limited by its height', () => {
  const area = quizAreaFor(fakeMap({ halfHeight: 2000, halfWidth: 4000 }));
  assert.ok(Math.abs(area.radius - 1800) < 1, `radius ${area.radius}`);
});

test('radius is capped at 5000 m when zoomed out', () => {
  assert.equal(MAX_RADIUS, 5000);
  assert.equal(quizAreaFor(fakeMap({ halfHeight: 30000, halfWidth: 15000 })).radius, 5000);
});

test('under 500 m is too small', () => {
  assert.equal(MIN_RADIUS, 500);
  // 0.9 x 550 = 495
  assert.equal(quizAreaFor(fakeMap({ halfHeight: 1000, halfWidth: 550 })).tooSmall, true);
  // 0.9 x 560 = 504
  assert.equal(quizAreaFor(fakeMap({ halfHeight: 1000, halfWidth: 560 })).tooSmall, false);
});

test('formats meters, one decimal, then whole km', () => {
  assert.equal(formatRadius(500), '500 m');
  assert.equal(formatRadius(804), '800 m');
  assert.equal(formatRadius(999), '1 km');
  assert.equal(formatRadius(1000), '1 km');
  assert.equal(formatRadius(2449), '2.4 km');
  assert.equal(formatRadius(5000), '5 km');
  assert.equal(formatRadius(9949), '9.9 km');
  assert.equal(formatRadius(12400), '12 km');
});

test('circle label', () => {
  assert.equal(circleLabel({ radius: 5000, tooSmall: false }), '5 km radius');
  assert.equal(circleLabel({ radius: 320, tooSmall: true }), 'Zoom out: min 500 m');
});
