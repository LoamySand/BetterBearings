const { test, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { pool } = require('./helpers');
const { DEFAULT_TILE_URL } = require('../tileConfig');

after(() => pool.end());

const saved = { url: process.env.TILE_URL, attribution: process.env.TILE_ATTRIBUTION };
afterEach(() => {
  for (const [key, value] of [
    ['TILE_URL', saved.url],
    ['TILE_ATTRIBUTION', saved.attribution],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const csp = (res) => res.headers['content-security-policy'];
const directive = (res, name) =>
  csp(res)
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(name));

test('GET /api/config defaults to OSM and revalidates every load', async () => {
  delete process.env.TILE_URL;
  delete process.env.TILE_ATTRIBUTION;
  const res = await request(createApp()).get('/api/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.tiles.url, DEFAULT_TILE_URL);
  assert.match(res.body.tiles.attribution, /OpenStreetMap contributors/);
  assert.equal(res.headers['cache-control'], 'no-cache');
  assert.match(directive(res, 'img-src'), /https:\/\/tile\.openstreetmap\.org/);
});

test('TILE_URL and TILE_ATTRIBUTION change the config and the CSP together', async () => {
  process.env.TILE_URL = 'https://tiles.example.net/nm/{z}/{x}/{y}.mvt';
  process.env.TILE_ATTRIBUTION = 'Protomaps &copy; OpenStreetMap contributors';
  const res = await request(createApp()).get('/api/config');
  assert.equal(res.body.tiles.url, process.env.TILE_URL);
  assert.equal(res.body.tiles.attribution, process.env.TILE_ATTRIBUTION);
  assert.match(directive(res, 'img-src'), /https:\/\/tiles\.example\.net/);
  assert.match(directive(res, 'connect-src'), /https:\/\/tiles\.example\.net/);
  assert.doesNotMatch(csp(res), /tile\.openstreetmap\.org/);
});

test('empty TILE_URL (compose passes unset as "") falls back to the default', async () => {
  process.env.TILE_URL = '';
  const res = await request(createApp()).get('/api/config');
  assert.equal(res.body.tiles.url, DEFAULT_TILE_URL);
});

test('a same-origin path adds nothing to the CSP', async () => {
  process.env.TILE_URL = '/tiles/{z}/{x}/{y}.mvt';
  const res = await request(createApp()).get('/api/config');
  assert.equal(directive(res, 'img-src'), "img-src 'self' data:");
});

test('a bad TILE_URL fails startup', () => {
  for (const bad of [
    'http://tiles.example.net/{z}/{x}/{y}.png',
    'https://tiles.example.net/{z}/{x}.png',
    'tiles/{z}/{x}/{y}',
  ]) {
    process.env.TILE_URL = bad;
    assert.throws(() => createApp(), /TILE_URL/, bad);
  }
});
