const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db/pool'); // Postgres Connection



const app = express();

// Comma-separated list, e.g. "https://betterbearings.net,https://www.betterbearings.net"
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  console.error('CORS_ORIGINS must be set in production');
  process.exit(1);
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header: same-origin GETs, curl, health checks
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false); // browser blocks it; no 500
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// Security middleware with CSP configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
        connectSrc: [
          "'self'",
          "https://backofyourhand.herokuapp.com",
          "https://*.tile.openstreetmap.org",
          "https://overpass-api.de",
          "https://*.overpass-api.de",
          "https://lz4.overpass-api.de",
          "http://localhost:5000",

        ],
        fontSrc: ["'self'", "data:"],
      },
    },
  })
);

// Increase payload size limit for street set data with coordinates
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting - skip OPTIONS requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Relaxed limit for development
  message: 'Too many authentication attempts, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
});

// Force HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') === 'http') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
  });
}

// Increase payload size limit for street set data with coordinates
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Basic Route
app.get('/api', (req, res) => {
  res.json({ message: 'How local are you?' });
});

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/street-sets', require('./routes/streetSetRoutes'));

// Serve static files from the frontend build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(buildPath));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

const PORT = process.env.PORT || 5000;

pool.query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Postgres connection failed:', err.message);
    process.exit(1);
  });
