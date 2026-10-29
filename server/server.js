const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS configuration - MUST come first
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://www.backofyourhand.org',
  'https://backofyourhand.org',
  'https://backofyourhand-7074dc055b01.herokuapp.com',
  'https://backofyourhandstg-f59e2db931c3.herokuapp.com',
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS request from origin:', origin);
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS: No origin header, allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('CORS ALLOWED:', origin);
      callback(null, true);
    } else {
      console.log('CORS BLOCKED:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  preflightContinue: false,
  optionsSuccessStatus: 204
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
// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-startup', {})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
