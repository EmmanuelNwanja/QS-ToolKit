const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.url, method: req.method });

  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An unexpected error occurred'
    : err.message || 'Server error';

  res.status(statusCode).json({ success: false, message, code, statusCode });
};
