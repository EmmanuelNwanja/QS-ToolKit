const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/examPrepController');
const { protect } = require('../middlewares/authMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../utils/validators');

// All routes require authentication
router.use(protect);

// ── Subscription ───────────────────────────────────────────────
router.get('/status', ctrl.getStatus);
router.get('/bank-transfer-settings', ctrl.getBankTransferSettings);
router.post('/subscribe', paymentLimiter, [
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required if paying via Paystack'),
  body('payment_method').optional().isIn(['paystack', 'bank_transfer']).withMessage('payment_method must be paystack or bank_transfer'),
  validate
], ctrl.subscribe);

// ── Exams ──────────────────────────────────────────────────────
router.get('/exams', [
  query('category').optional().isString(),
  query('exam_name').optional().isString(),
  validate
], ctrl.getExams);
router.get('/exams/:id/questions', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid exam ID required'),
  query('question_count').optional().isInt({ min: 1, max: 200 }).withMessage('question_count must be 1-200'),
  validate
], ctrl.getExamQuestions);
router.post('/exams/:id/start', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid exam ID required'),
  validate
], ctrl.startExam);
router.post('/exams/:id/submit', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid exam ID required'),
  body('answers').isArray().withMessage('answers must be an array'),
  validate
], ctrl.submitExam);
router.post('/exams/:id/explain', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid exam ID required'),
  body('question_text').trim().notEmpty().withMessage('question_text is required'),
  body('correct_answer').trim().notEmpty().withMessage('correct_answer is required'),
  body('user_answer').optional().isString(),
  validate
], ctrl.explainQuestion);

// ── Personalized Practice ──────────────────────────────────────
router.post('/practice/generate', [
  body('category').optional().isString(),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
  body('question_count').optional().isInt({ min: 5, max: 20 }).withMessage('question_count must be 5-20'),
  validate
], ctrl.generatePracticeExam);

// ── Attempts ───────────────────────────────────────────────────
router.get('/attempts', ctrl.getAttempts);
router.get('/attempts/:id', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid attempt ID required'),
  validate
], ctrl.getAttempt);

// ── Universities & Past Questions ──────────────────────────────
router.get('/universities', [
  query('search').optional().isString(),
  validate
], ctrl.getUniversities);
router.get('/universities/:id/courses', [
  param('id').isString().isLength({ min: 1, max: 100 }).withMessage('Valid university ID required'),
  validate
], ctrl.getUniversityCourses);
router.get('/past-questions', [
  query('university').optional().isString(),
  query('course').optional().isString(),
  query('year').optional().isInt({ min: 2000, max: 2030 }),
  query('category').optional().isString(),
  query('search').optional().isString(),
  validate
], ctrl.getPastQuestions);
router.get('/search', [
  query('q').optional().isString(),
  query('type').optional().isIn(['universities', 'courses', 'exams', 'all']),
  validate
], ctrl.globalSearch);
router.post('/search/log', [
  body('query').trim().notEmpty().withMessage('query is required'),
  body('type').optional().isString(),
  body('results_count').optional().isInt({ min: 0 }),
  validate
], ctrl.logSearch);

module.exports = router;
