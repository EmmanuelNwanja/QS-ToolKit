const rateLimit = require('express-rate-limit');

exports.generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: { success: false, message: 'Too many requests, please slow down.' }
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  trustProxy: true,
  message: { success: false, message: 'Too many auth attempts, try again later.' }
});

exports.paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  trustProxy: true,
  message: { success: false, message: 'Too many payment attempts, please slow down.' }
});

exports.webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  trustProxy: true,
  message: { success: false, message: 'Too many requests.' }
});
