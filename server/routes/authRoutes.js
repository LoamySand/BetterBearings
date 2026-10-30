const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

const toApiUser = (u) => ({ id: u.id, username: u.username, email: u.email });

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    const user = rows[0];
    res.status(201).json({
      message: 'User created successfully',
      token: signToken(user.id),
      user: toApiUser(user),
    });
  } catch (err) {
    if (err.code === '23505') {
      const message = err.constraint === 'users_email_key'
        ? 'Email already registered'
        : 'Username already taken';
      return res.status(400).json({ message });
    }
    req.log.error({ err }, 'Signup error');
    res.status(500).json({ message: 'Server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
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
    const { rows } = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: toApiUser(rows[0]) });
  } catch (err) {
    req.log.error({ err }, 'Me error');
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;