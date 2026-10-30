const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db/pool'); // Postgres Connection
const logger = require('./logger');
const pinoHttp = require('pino-http');
const app = express();

function createApp() {
  // Fail on startup if missing secret
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }
  // Proxies in front of Express: 0 locally, 1 behind the Cloudflare Tunnel.
  // Only safe if Express is reachable solely through that proxy; otherwise X-Forwarded-For is spoofable.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  // TRUST_PROXY check: throw instead of exit
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error('TRUST_PROXY must be a non-negative integer');
  }
  app.set('trust proxy', trustProxy);

  const isProd = process.env.NODE_ENV === 'production';

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' }, // ready for KAN-28
      customProps: (req) => ({ ip: req.ip }), // the client IP resolved through trust proxy, not the tunnel's
      customLogLevel: (req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    })
  );

  // Comma-separated list, e.g. "https://betterbearings.net,https://www.betterbearings.net"
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // CORS check: throw instead of exit
  if (isProd && !process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must be set in production');
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

  // HTTPS only reaches us through the tunnel (TRUST_PROXY > 0). A local production run is plain http,
  // where upgrade-insecure-requests would rewrite asset URLs to https and break the page.
  const servedOverHttps = isProd && trustProxy > 0;

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
          connectSrc: [
            "'self'",
            // Overpass endpoints, tried in order by client/src/utils/overpassFetcher.js
            'https://overpass-api.de',
            'https://overpass.private.coffee',
            'https://maps.mail.ru',
          ],
          fontSrc: ["'self'"],
          upgradeInsecureRequests: servedOverHttps ? [] : null, // null removes helmet's default
        },
      },
      strictTransportSecurity: servedOverHttps
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  const limiterDefaults = {
    windowMs: 15 * 60 * 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  };
  const tooMany = (message) => ({ message }); // JSON body, which the client can parse

  // All API traffic: 300 per 15 min (20/min) per IP
  const apiLimiter = rateLimit({
    ...limiterDefaults,
    limit: 300,
    skip: (req) => req.method === 'OPTIONS',
    message: tooMany('Too many requests, please try again later.'),
  });

  // Street-set writes: each can be ~1 MB and hundreds of inserted rows
  const writeLimiter = rateLimit({
    ...limiterDefaults,
    limit: isProd ? 30 : 300,
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
    message: tooMany('Too many saves, please try again later.'),
  });

  // Login and signup: only failed attempts count
  const authLimiter = rateLimit({
    ...limiterDefaults,
    limit: isProd ? 10 : 100,
    skipSuccessfulRequests: true,
    skip: (req) => req.method === 'OPTIONS',
    message: tooMany('Too many failed attempts, please try again in 15 minutes.'),
  });

  app.use('/api/', apiLimiter);
  app.use(['/api/auth/login', '/api/auth/signup'], authLimiter);
  app.use('/api/street-sets', writeLimiter);
  app.delete('/api/auth/me', authLimiter); // password re-check; GET /me stays unthrottled

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
  app.use('/api/street-sets', express.json({ limit: '1.5mb' })); // set from measurement
  app.use(express.json({ limit: '10kb' }));

  // Health check for the Cloudflare Tunnel and container. Outside /api, so no rate limit.
  app.get('/healthz', async (req, res) => {
    let timer;
    res.set('Cache-Control', 'no-store');
    try {
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database check timed out')), 2000);
        }),
      ]);
      res.json({ status: 'ok' });
    } catch (err) {
      req.log.warn({ err }, 'Health check failed');
      res.status(503).json({ status: 'unavailable' });
    } finally {
      clearTimeout(timer);
    }
  });

  // Basic Route
  app.get('/api', (req, res) => {
    res.json({ message: 'How local are you?' });
  });

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/street-sets', require('./routes/streetSetRoutes'));

  // Serve static files from the frontend build in production
  if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(buildPath));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
  }

  // Body-parser errors are client errors, not 500s
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body too large' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Malformed JSON' });
    }
    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ message: 'Server error' });
  });
  return app;
}

module.exports = { createApp };