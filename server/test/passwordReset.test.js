const { describe, test, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { mailer } = require('../email');
const { pool, resetDb, createUser, bearer, PASSWORD } = require('./helpers');

const app = createApp();
const NEW_PASSWORD = 'a-brand-new-passphrase';
const REPLY = /If that address has an account/;

// Records emails instead of sending them
let sent = [];
const realSend = mailer.send;
beforeEach(async () => {
  await resetDb();
  sent = [];
  mailer.send = async (msg) => {
    sent.push(msg);
    return { id: 'fake' };
  };
});
afterEach(() => {
  mailer.send = realSend;
});
after(() => pool.end());

const forgot = (email) => request(app).post('/api/auth/forgot').send({ email });
const reset = (token, password = NEW_PASSWORD) =>
  request(app).post('/api/auth/reset').send({ token, password });
const login = (password, email = 'lane@example.com') =>
  request(app).post('/api/auth/login').send({ email, password });
const tokens = async () =>
  (await pool.query('SELECT * FROM password_reset_tokens ORDER BY id')).rows;
const tokenFrom = (msg) => msg.text.match(/#token=([A-Za-z0-9_-]{43})/)[1];
const sha256 = (t) => crypto.createHash('sha256').update(t).digest();

describe('POST /api/auth/forgot', () => {
  test('an unknown address gets the same reply, and no email', async () => {
    const res = await forgot('nobody@example.com');
    assert.equal(res.status, 200);
    assert.match(res.body.message, REPLY);
    assert.equal(sent.length, 0);
    assert.equal((await tokens()).length, 0);
  });

  test('a known address gets an email with a link; only the hash is stored', async () => {
    await createUser(app);
    const res = await forgot('  Lane@Example.com ');
    assert.equal(res.status, 200);
    assert.match(res.body.message, REPLY);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'lane@example.com');
    assert.match(sent[0].subject, /Reset your BetterBearings password/);
    assert.match(sent[0].text, /http:\/\/localhost:3000\/reset-password#token=/);
    assert.match(sent[0].html, /href="http:\/\/localhost:3000\/reset-password#token=/);

    const token = tokenFrom(sent[0]);
    const [row] = await tokens();
    assert.deepEqual(row.token_hash, sha256(token));
    assert.ok(!row.token_hash.toString('latin1').includes(token));
    const minutes = (row.expires_at - row.created_at) / 60000;
    assert.ok(minutes > 29.9 && minutes < 30.1, `expires in ${minutes} min`);
  });

  test('a second request within 2 minutes sends nothing more', async () => {
    await createUser(app);
    await forgot('lane@example.com');
    const res = await forgot('lane@example.com');
    assert.equal(res.status, 200);
    assert.match(res.body.message, REPLY);
    assert.equal(sent.length, 1);
    assert.equal((await tokens()).length, 1);
  });

  test('a later request replaces the earlier link', async () => {
    await createUser(app);
    await forgot('lane@example.com');
    await pool.query("UPDATE password_reset_tokens SET created_at = now() - interval '3 minutes'");
    await forgot('lane@example.com');
    assert.equal(sent.length, 2);
    assert.equal((await tokens()).length, 1);
    assert.equal((await reset(tokenFrom(sent[0]))).status, 400);
    assert.equal((await reset(tokenFrom(sent[1]))).status, 200);
  });

  test('a failed send still gets the same reply', async () => {
    await createUser(app);
    mailer.send = async () => {
      throw new Error('provider down');
    };
    const res = await forgot('lane@example.com');
    assert.equal(res.status, 200);
    assert.match(res.body.message, REPLY);
  });

  test('a malformed address is a 400', async () => {
    const res = await request(app).post('/api/auth/forgot').send({});
    assert.equal(res.status, 400);
  });
});

describe('POST /api/auth/reset', () => {
  const askForLink = async () => {
    await forgot('lane@example.com');
    return tokenFrom(sent.at(-1));
  };

  test('sets the new password; the old one stops working', async () => {
    await createUser(app);
    const res = await reset(await askForLink());
    assert.equal(res.status, 200);
    assert.match(res.body.message, /Password changed/);
    assert.equal((await login(PASSWORD)).status, 401);
    assert.equal((await login(NEW_PASSWORD)).status, 200);
  });

  test('a link works once', async () => {
    await createUser(app);
    const token = await askForLink();
    assert.equal((await reset(token)).status, 200);
    const again = await reset(token, 'yet-another-passphrase');
    assert.equal(again.status, 400);
    assert.equal(again.body.message, 'This reset link is invalid or has expired');
    assert.equal((await login(NEW_PASSWORD)).status, 200);
  });

  test('an expired link is refused', async () => {
    await createUser(app);
    const token = await askForLink();
    await pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second'");
    assert.equal((await reset(token)).status, 400);
    assert.equal((await login(PASSWORD)).status, 200);
  });

  test('an unknown or malformed token is refused', async () => {
    await createUser(app);
    assert.equal((await reset(crypto.randomBytes(32).toString('base64url'))).status, 400);
    assert.equal((await reset('short')).status, 400);
  });

  test('the new password follows the signup rules', async () => {
    await createUser(app);
    const res = await reset(await askForLink(), 'too-short');
    assert.equal(res.status, 400);
    assert.equal((await login(PASSWORD)).status, 200);
  });

  test("a deleted account's link is gone with it", async () => {
    const { token: jwtToken } = await createUser(app);
    const token = await askForLink();
    await request(app).delete('/api/auth/me').set(bearer(jwtToken)).send({ password: PASSWORD });
    assert.equal((await reset(token)).status, 400);
  });
});

describe('signing out other devices', () => {
  test('logins from before the reset stop working; new ones work', async () => {
    const { user } = await createUser(app);
    // Issued 10 s ago, so it's from an earlier second than the reset
    const old = jwt.sign(
      { userId: user.id, iat: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET
    );
    assert.equal((await request(app).get('/api/auth/me').set(bearer(old))).status, 200);

    await forgot('lane@example.com');
    assert.equal((await reset(tokenFrom(sent[0]))).status, 200);

    assert.equal((await request(app).get('/api/auth/me').set(bearer(old))).status, 401);
    assert.equal((await request(app).get('/api/street-sets').set(bearer(old))).status, 401);
    const fresh = (await login(NEW_PASSWORD)).body.token;
    assert.equal((await request(app).get('/api/auth/me').set(bearer(fresh))).status, 200);
  });

  test("a deleted account's login stops working everywhere", async () => {
    const { token } = await createUser(app);
    await pool.query('DELETE FROM users');
    const res = await request(app).get('/api/street-sets').set(bearer(token));
    assert.equal(res.status, 401);
  });
});

describe('production settings', () => {
  const saved = {};
  const keys = ['NODE_ENV', 'RESEND_API_KEY', 'APP_URL', 'CORS_ORIGINS'];
  beforeEach(() => keys.forEach((k) => (saved[k] = process.env[k])));
  afterEach(() =>
    keys.forEach((k) =>
      saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])
    )
  );

  test('production refuses to start without RESEND_API_KEY or a valid APP_URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://betterbearings.net';
    process.env.APP_URL = 'https://betterbearings.net';
    delete process.env.RESEND_API_KEY;
    assert.throws(() => createApp(), /RESEND_API_KEY/);
    process.env.RESEND_API_KEY = 're_test';
    for (const bad of ['', 'http://betterbearings.net', 'https://betterbearings.net/']) {
      process.env.APP_URL = bad;
      assert.throws(() => createApp(), /APP_URL/);
    }
    process.env.APP_URL = 'https://betterbearings.net';
    assert.doesNotThrow(() => createApp());
  });
});
