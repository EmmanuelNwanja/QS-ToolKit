const router = require('express').Router();
const { body, query } = require('express-validator');
const ctrl = require('../controllers/giftingController');
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
  body('recipient_emails').isArray({ min: 1, max: 100 }).withMessage('recipient_emails must be a non-empty array (max 100)'),
  body('recipient_emails.*').isEmail().normalizeEmail(),
  body('plan_name').isIn(['basic', 'student', 'pro']).withMessage('Gifting is available for Starter and Pro plans'),
  body('billing_cycle').isIn(['monthly', 'annual']).withMessage('billing_cycle must be monthly or annual'),
  body('is_anonymous').optional().isBoolean(),
  body('donor_email').optional().isEmail().normalizeEmail(),
  validate,
], ctrl.initiateGift);

router.get('/confirm', [
  query('reference').trim().notEmpty().withMessage('reference is required'),
  validate,
], ctrl.confirmGift);

// ── Admin analytics ───────────────────────────────────────────
router.get('/admin/analytics', adminAuth, requirePermission('view_analytics'), ctrl.adminGiftAnalytics);

module.exports = router;
