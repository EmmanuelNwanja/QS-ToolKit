const router = require('express').Router();
const crypto = require('crypto');
const { runAllJobs } = require('../services/schedulerService');
const logger = require('../utils/logger');

function normalizeSecret(raw) {
  if (!raw) return '';
  // Remove accidental wrapping quotes and trim whitespace/newlines.
  return String(raw).trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(a || '', 'utf8');
  const right = Buffer.from(b || '', 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Secured cron endpoint - called by GitHub Actions
router.post('/run', async (req, res) => {
  const authHeader = req.headers.authorization;
  const xCronSecret = req.headers['x-cron-secret'];

  const providedToken = normalizeSecret(
    authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : (authHeader?.startsWith('Token ')
        ? authHeader.slice('Token '.length)
        : (xCronSecret || ''))
  );

  const validSecrets = (process.env.CRON_SECRETS || process.env.CRON_SECRET || '')
    .split(/[\s,;]+/)
    .map((s) => normalizeSecret(s))
    .filter(Boolean);

  const tokenIsValid = providedToken && validSecrets.some((secret) => safeEqual(secret, providedToken));

  if (!tokenIsValid) {
    logger.warn(`Cron auth failed. Provided token length: ${providedToken?.length || 0}, configured secrets: ${validSecrets.length}`);
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    await runAllJobs();
    return res.json({ success: true, message: 'Jobs completed', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Cron run error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
