require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { generalLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

const app = express();

// ── Trust Proxy ───────────────────────────────────────────────
// Required for rate limiting and IP identification in production (Render, AWS, etc.)
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet());

// Build allowed origins from env + hardcoded production domains
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,          // set in Render dashboard
  'http://localhost:3000',
  'https://qs.solnuv.com',           // current live frontend
  'https://server.solnuv.com',
  'https://qstoolkit.com',           // future primary domain
  'https://www.qstoolkit.com'
].filter(Boolean);                   // remove any undefined/null entries

app.use(cors({
  origin: (incomingOrigin, callback) => {
    // Allow server-to-server / Postman / cron (no Origin header)
    if (!incomingOrigin) return callback(null, true);
    // Allow any Vercel preview deployment automatically
    if (incomingOrigin.endsWith('.vercel.app')) return callback(null, true);
    // Allow whitelisted origins
    if (ALLOWED_ORIGINS.includes(incomingOrigin)) return callback(null, true);
    // Block everything else
    callback(new Error(`CORS blocked: origin ${incomingOrigin} not allowed`));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Rate Limiting ─────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'QSToolkit API' });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;