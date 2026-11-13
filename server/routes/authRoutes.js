const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  signupSchema,
  loginSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./schema');
const { mailer } = require('../email');
const router = express.Router();

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

const toApiUser = (u) => ({ id: u.id, username: u.username, email: u.email });

router.post('/signup', validate(signupSchema), async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, hash]
    );

    const user = rows[0];
    res.status(201).json({
      message: 'User created successfully',
      token: signToken(user.id),
      user: toApiUser(user),
    });
  } catch (err) {
    if (err.code === '23505') {
      const message =
        err.constraint === 'users_email_key'
          ? 'Email already registered'
          : 'Username already taken';
      return res.status(400).json({ message });
    }
    req.log.error({ err }, 'Signup error');
    res.status(500).json({ message: 'Server error during signup' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ message: 'Login successful', token: signToken(user.id), user: toApiUser(user) });
  } catch (err) {
    req.log.error({ err }, 'Login error');
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [
      req.user.userId,
    ]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    res.json({ user: toApiUser(rows[0]) });
  } catch (err) {
    req.log.error({ err }, 'Me error');
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/me', authenticateToken, validate(deleteAccountSchema), async (req, res) => {
  const { userId } = req.user;
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    if (!(await bcrypt.compare(req.body.password, rows[0].password_hash))) {
      return res.status(403).json({ message: 'Incorrect password' });
    }
    // Street sets and their streets go with it via ON DELETE CASCADE
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    req.log.info({ userId }, 'Account deleted');
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Delete account error');
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Password reset (KAN-69) ----

const RESET_MINUTES = 30;
// One email per address per 2 minutes, silently: stops inbox flooding and protects the
// provider's 100-a-day free quota
const RESET_THROTTLE_MINUTES = 2;
const FORGOT_REPLY =
  "If that address has an account, we've sent a link to reset the password. It works for 30 minutes.";

const sha256 = (token) => crypto.createHash('sha256').update(token).digest();
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function resetEmail(username, link) {
  const text = [
    `Hi ${username},`,
    '',
    'Someone asked to reset the password for your BetterBearings account. Open this link',
    `within ${RESET_MINUTES} minutes to choose a new one:`,
    '',
    link,
    '',
    "If you didn't ask, ignore this email. Your password stays the same.",
  ].join('\n');
  const html = `<p>Hi ${escapeHtml(username)},</p>
<p>Someone asked to reset the password for your BetterBearings account. Open this link within ${RESET_MINUTES} minutes to choose a new one:</p>
<p><a href="${escapeHtml(link)}">Reset your password</a></p>
<p>If you didn't ask, ignore this email. Your password stays the same.</p>`;
  return { subject: 'Reset your BetterBearings password', text, html };
}

// Always the same reply, whether or not the address has an account. The email itself is sent
// after the reply, so the response time doesn't give that away either.
router.post('/forgot', validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await pool.query('SELECT id, username FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (user) {
      const recent = await pool.query(
        `SELECT 1 FROM password_reset_tokens
         WHERE user_id = $1 AND created_at > now() - make_interval(mins => $2)`,
        [user.id, RESET_THROTTLE_MINUTES]
      );
      if (recent.rows.length === 0) {
        const token = crypto.randomBytes(32).toString('base64url');
        // A new link replaces any earlier unused one
        await pool.query(
          'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
          [user.id]
        );
        await pool.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + make_interval(mins => $3))`,
          [user.id, sha256(token), RESET_MINUTES]
        );
        // In the fragment, not the query: browsers never send it to the server, so it stays
        // out of request logs, and out of Referer headers
        const link = `${appUrl()}/reset-password#token=${token}`;
        mailer
          .send({ to: email, ...resetEmail(user.username, link) })
          .then(() => req.log.info({ userId: user.id }, 'Password reset email sent'))
          .catch((err) => req.log.error({ err, userId: user.id }, 'Password reset email failed'));
      }
    }
    res.json({ message: FORGOT_REPLY });
  } catch (err) {
    req.log.error({ err }, 'Forgot password error');
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE: two requests with the same link can't both use it
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [sha256(token)]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This reset link is invalid or has expired' });
    }
    const { id, user_id: userId } = rows[0];
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2',
      [hash, userId]
    );
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id]);
    await client.query('COMMIT');
    req.log.info({ userId }, 'Password reset');
    res.json({ message: 'Password changed. Log in with your new password.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    req.log.error({ err }, 'Reset password error');
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
