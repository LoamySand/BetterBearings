const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
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

  next();
}

module.exports = { authenticateToken };