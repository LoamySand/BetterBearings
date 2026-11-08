// Cache headers for the built client (KAN-71). Uses a throwaway dist folder, so no build or database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { serveClient } = require('../clientStatic');

let dist;
let app;

before(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1);');
  fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *');
  app = express();
  serveClient(app, dist);
});

after(() => fs.rmSync(dist, { recursive: true, force: true }));

test('hashed assets are cached for a year as immutable', async () => {
  const res = await request(app).get('/assets/index-abc123.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
  assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('a missing asset is a 404, not index.html', async () => {
  const res = await request(app).get('/assets/index-old999.js');
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.text, /id="root"/);
});
test('/ serves index.html with no-cache', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /html/);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('client routes serve index.html with no-cache', async () => {
  const res = await request(app).get('/street-sets/5');
  assert.equal(res.status, 200);
  assert.match(res.text, /id="root"/);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('unhashed root files keep the revalidating default', async () => {
  const res = await request(app).get('/robots.txt');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'public, max-age=0');
});

test('/api paths are not answered with index.html', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
});
