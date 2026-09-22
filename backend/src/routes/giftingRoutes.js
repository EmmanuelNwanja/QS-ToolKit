const router = require('express').Router();
const { body, query, oneOf } = require('express-validator');
const ctrl = require('../controllers/giftingController');
const { protect } = require('../middlewares/authMiddleware');
const { adminAuth, requirePermission } = require('../middlewares/adminMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../utils/validators');

// ── Public (guests allowed — e-commerce checkout style) ───────
router.get('/directory', [
  query('account_type').optional().isIn(['student', 'professional']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
], ctrl.listGiftable);

router.post('/lookup', paymentLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  validate,
], ctrl.lookupByEmail);

router.post('/initiate', paymentLimiter, [
  // At least one recipient via directory IDs or pasted emails — never both
  // required. The browser directory flow sends recipient_ids (directory cards
  // carry masked emails only); the email-paste flow sends recipient_emails.
  oneOf([
    body('recipient_ids').isArray({ min: 1, max: 100 }),
    body('recipient_emails').isArray({ min: 1, max: 100 }),
  ], 'At least one recipient is required (recipient_ids or recipient_emails)'),
  // Parent arrays are optional (absent = flow not used); wildcards are NOT
  // optional — express-validator applies the optional modifier per-element,
  // so .optional() on a wildcard would reject valid arrays.
  body('recipient_ids').optional().isArray({ max: 100 }),
  body('recipient_ids.*').isUUID().withMessage('recipient_ids must be valid user IDs'),
  body('recipient_emails').optional().isArray({ max: 100 }),
  body('recipient_emails.*').isEmail().normalizeEmail(),
  body('plan_name').isIn(['basic', 'student', 'pro']).withMessage('Gifting is available for Starter and Pro plans'),
  body('billing_cycle').optional().isIn(['monthly', 'annual']).withMessage('billing_cycle must be monthly or annual'),
  body('is_anonymous').optional().isBoolean(),
  body('donor_email').optional().isEmail().normalizeEmail(),
  validate,
], ctrl.initiateGift);

router.get('/confirm', [
  query('reference').trim().notEmpty().withMessage('reference is required'),
  validate,
], ctrl.confirmGift);

// ── Admin analytics ───────────────────────────────────────────
router.get('/admin/analytics', protect, adminAuth, requirePermission('view_analytics'), ctrl.adminGiftAnalytics);

module.exports = router;
