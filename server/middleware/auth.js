const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Tokens issued under Mongo carry an ObjectId, not a numeric id
  if (!/^\d+$/.test(String(req.user.userId))) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // A password reset signs out every device: tokens issued in an earlier second than the
  // change stop working (KAN-69). A deleted account's tokens stop working too.
  try {
    const { rows } = await pool.query(
      // floor, not a cast: ::bigint rounds, which would reject a login made in the second of the reset
      'SELECT floor(extract(epoch FROM password_changed_at))::bigint AS changed FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    const changed = rows[0].changed === null ? null : Number(rows[0].changed);
    if (changed !== null && req.user.iat < changed) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } catch (err) {
    req.log.error({ err }, 'Auth check error');
    return res.status(500).json({ message: 'Server error' });
  }

  next();
}

module.exports = { authenticateToken };
