import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  networkError,
  responseError,
  emptyError,
  describeStreetError,
  StreetLoadError,
} from './streetErrors.js';

test('a failed fetch is offline, with Retry', () => {
  const err = networkError();
  assert.ok(err instanceof StreetLoadError);
  const d = describeStreetError(err);
  assert.equal(d.kind, 'offline');
  assert.equal(d.title, "Can't reach BetterBearings");
  assert.equal(d.action, 'retry');
});

test('429 says to wait; 503 keeps the server message', () => {
  const limited = describeStreetError(
    responseError(429, { message: 'Too many requests, please try again later.' })
  );
  assert.equal(limited.kind, 'rate-limit');
  assert.match(limited.message, /Wait a few minutes/);
  assert.equal(limited.action, 'retry');

  const notReady = describeStreetError(
    responseError(503, { message: 'Street data is not available yet' })
  );
  assert.equal(notReady.kind, 'unavailable');
  assert.equal(notReady.message, 'Street data is not available yet');
});

test('other 5xx hide the server message', () => {
  const d = describeStreetError(responseError(500, { message: 'Server error' }));
  assert.equal(d.kind, 'server');
  assert.equal(d.message, 'Try again in a moment.');
  assert.equal(d.action, 'retry');
  assert.equal(describeStreetError(responseError(502)).kind, 'server');
});

test('400 asks for a different area', () => {
  const d = describeStreetError(responseError(400, { message: 'radius: Too big' }));
  assert.equal(d.kind, 'invalid');
  assert.equal(d.message, 'radius: Too big');
  assert.equal(d.action, 'new-area');
});

test('empty list: outside coverage vs nothing at this level', () => {
  const outside = describeStreetError(emptyError(false));
  assert.equal(outside.kind, 'outside');
  assert.match(outside.message, /New Mexico/);
  assert.equal(outside.action, 'new-area');

  const empty = describeStreetError(emptyError(true));
  assert.equal(empty.kind, 'empty');
  assert.equal(empty.action, 'new-area');
  // An older server without hasData reads as "nothing at this level", not "outside"
  assert.equal(describeStreetError(emptyError(undefined)).kind, 'empty');
});

test('an unknown kind falls back to a generic server error', () => {
  const d = describeStreetError({ kind: 'weird', message: 'x' });
  assert.equal(d.kind, 'server');
  assert.equal(d.action, 'retry');
});
