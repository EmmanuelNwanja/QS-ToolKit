const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.url, method: req.method });

  // Capture non-operational errors to Sentry (skip 4xx client errors)
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err, {
        extra: { url: req.url, method: req.method, userId: req.user?.id },
      });
    } catch {}
  }

  const code = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An unexpected error occurred'
    : err.message || 'Server error';

  res.status(statusCode).json({ success: false, message, code, statusCode });
};
