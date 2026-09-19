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
  body('email').optional().isEmail().normalizeEmail(),
  body('payment_method').optional().isIn(['flutterwave', 'bank_transfer', 'card']).withMessage('Invalid payment_method'),
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
router.post('/modules/complete', [
  body('pathway_slug').trim().notEmpty().withMessage('pathway_slug is required'),
  body('module_id').trim().notEmpty().withMessage('module_id is required'),
  validate
], ctrl.completeModule);
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
router.get('/contests', ctrl.getContests);
router.get('/contests/:id', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid contest ID required'),
  validate
], ctrl.getContestById);
router.post('/contests', [
  // Accept either title or topic (at least one required)
  body('title').optional().trim().isString(),
  body('topic').optional().trim().isString(),
  body('description').optional().isString(),
  body('question_count').optional().isInt({ min: 1, max: 50 }).withMessage('question_count must be 1-50'),
  body('time_limit').optional().isInt({ min: 1, max: 60 }).withMessage('time_limit must be 1-60 minutes'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('difficulty must be easy, medium, or hard'),
  body('contest_type').optional().isIn(['duel', 'group', 'scheduled']).withMessage('contest_type must be duel, group, or scheduled'),
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

// ── AI Lessons ─────────────────────────────────────────────────
router.post('/lessons/generate', [
  body('pathway_id').isUUID().withMessage('Valid pathway_id required'),
  body('module_id').trim().notEmpty().withMessage('module_id is required'),
  body('topic').trim().notEmpty().withMessage('topic is required'),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  validate
], ctrl.generateLesson);
router.get('/lessons', [
  query('pathway_id').optional().isUUID(),
  query('module_id').optional().isString(),
  query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  validate
], ctrl.getLessons);
router.get('/lessons/progress', ctrl.getLessonProgress);
router.get('/lessons/:id', [
  param('id').isUUID().withMessage('Valid lesson ID required'),
  validate
], ctrl.getLesson);
router.post('/lessons/:id/complete', [
  param('id').isUUID().withMessage('Valid lesson ID required'),
  body('quiz_score').optional().isFloat({ min: 0, max: 100 }),
  body('time_spent_seconds').optional().isInt({ min: 0 }),
  validate
], ctrl.completeLesson);

// ── Simulations ────────────────────────────────────────────────
router.post('/simulations/generate', [
  body('pathway_id').isUUID().withMessage('Valid pathway_id required'),
  body('simulation_type').isIn(['boq_scenario', 'rate_analysis', 'measurement_takeoff', 'cost_plan']).withMessage('Invalid simulation_type'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
  validate
], ctrl.generateSim);
router.get('/simulations', [
  query('pathway_id').optional().isUUID(),
  query('simulation_type').optional().isIn(['boq_scenario', 'rate_analysis', 'measurement_takeoff', 'cost_plan']),
  validate
], ctrl.getSims);
router.post('/simulations/:id/start', [
  param('id').isUUID().withMessage('Valid simulation ID required'),
  validate
], ctrl.startSim);
router.post('/simulations/:id/submit', [
  param('id').isUUID().withMessage('Valid simulation ID required'),
  body('attempt_id').isUUID().withMessage('Valid attempt_id required'),
  body('answers').isObject().withMessage('answers must be an object'),
  validate
], ctrl.submitSim);

// ── Whiteboard ─────────────────────────────────────────────────
router.post('/whiteboard/save', [
  body('lesson_id').optional().isUUID(),
  body('simulation_id').optional().isUUID(),
  body('title').optional().isString(),
  body('drawing_data').optional().isArray(),
  validate
], ctrl.saveWhiteboard);
router.get('/whiteboard/:lessonId', [
  param('lessonId').isUUID().withMessage('Valid lesson ID required'),
  validate
], ctrl.getWhiteboard);

module.exports = router;
