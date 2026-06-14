const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/academyController');
const { protect } = require('../middlewares/authMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../utils/validators');

// All routes require authentication
router.use(protect);

// ── Subscription & Access ──────────────────────────────────────
router.get('/status', ctrl.getStatus);
router.get('/bank-transfer-settings', ctrl.getBankTransferSettings);
router.post('/subscribe', paymentLimiter, [
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required if paying via Paystack'),
  body('payment_method').optional().isIn(['paystack', 'bank_transfer']).withMessage('payment_method must be paystack or bank_transfer'),
  validate
], ctrl.subscribe);

// ── Profile ────────────────────────────────────────────────────
router.get('/profile', ctrl.getProfile);
router.post('/profile', [
  body('strengths').isArray({ min: 1 }).withMessage('strengths must be a non-empty array'),
  body('weaknesses').isArray({ min: 1 }).withMessage('weaknesses must be a non-empty array'),
  validate
], ctrl.saveProfile);

// ── Admission Test ─────────────────────────────────────────────
router.post('/admission/start', ctrl.startAdmission);
router.post('/admission/submit', [
  body('answers').isArray({ min: 1 }).withMessage('answers must be a non-empty array'),
  validate
], ctrl.submitAdmission);
router.get('/admission/result', ctrl.getAdmissionResult);

// ── Pathways ───────────────────────────────────────────────────
router.get('/pathways', ctrl.getPathways);
router.get('/pathways/progress', ctrl.getPathwayProgress);
router.get('/pathways/:slug', [
  param('slug').trim().notEmpty().withMessage('slug is required'),
  validate
], ctrl.getPathwayDetail);
router.post('/pathways/:slug/enroll', [
  param('slug').trim().notEmpty().withMessage('slug is required'),
  validate
], ctrl.enrollPathway);

// ── Resources ──────────────────────────────────────────────────
router.get('/resources', [
  query('pathway').optional().isString(),
  query('category').optional().isString(),
  query('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  query('type').optional().isIn(['video', 'article', 'quiz', 'worksheet']),
  validate
], ctrl.getResources);
router.get('/resources/:id', [
  param('id').isUUID().withMessage('Valid resource ID required'),
  validate
], ctrl.getResource);

// ── Contests ───────────────────────────────────────────────────
router.post('/contests', [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('description').optional().isString(),
  body('scheduled_at').optional().isISO8601().withMessage('scheduled_at must be a valid ISO date'),
  body('duration_minutes').optional().isInt({ min: 5, max: 180 }).withMessage('duration_minutes must be 5-180'),
  validate
], ctrl.createContest);
router.get('/contests', ctrl.getContests);
router.post('/contests/:id/join', [
  param('id').isUUID().withMessage('Valid contest ID required'),
  validate
], ctrl.joinContest);
router.post('/contests/:id/submit', [
  param('id').isUUID().withMessage('Valid contest ID required'),
  body('answers').isArray().withMessage('answers must be an array'),
  validate
], ctrl.submitContest);
router.get('/contests/:id/results', [
  param('id').isUUID().withMessage('Valid contest ID required'),
  validate
], ctrl.getContestResults);

// ── Tokens & Analytics ─────────────────────────────────────────
router.get('/tokens', ctrl.getTokens);
router.get('/analytics', ctrl.getAnalytics);

module.exports = router;
