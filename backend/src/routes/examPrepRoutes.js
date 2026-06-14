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
router.post('/subscribe', paymentLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  validate
], ctrl.subscribe);

// ── Exams ──────────────────────────────────────────────────────
router.get('/exams', [
  query('category').optional().isString(),
  query('exam_name').optional().isString(),
  validate
], ctrl.getExams);
router.get('/exams/:id/questions', [
  param('id').isUUID().withMessage('Valid exam ID required'),
  query('question_count').optional().isInt({ min: 1, max: 200 }).withMessage('question_count must be 1-200'),
  validate
], ctrl.getExamQuestions);
router.post('/exams/:id/start', [
  param('id').isUUID().withMessage('Valid exam ID required'),
  validate
], ctrl.startExam);
router.post('/exams/:id/submit', [
  param('id').isUUID().withMessage('Valid exam ID required'),
  body('answers').isArray().withMessage('answers must be an array'),
  validate
], ctrl.submitExam);

// ── Attempts ───────────────────────────────────────────────────
router.get('/attempts', ctrl.getAttempts);
router.get('/attempts/:id', [
  param('id').isUUID().withMessage('Valid attempt ID required'),
  validate
], ctrl.getAttempt);

// ── Universities & Past Questions ──────────────────────────────
router.get('/universities', ctrl.getUniversities);
router.get('/universities/:id/courses', [
  param('id').isUUID().withMessage('Valid university ID required'),
  validate
], ctrl.getUniversityCourses);
router.get('/past-questions', [
  query('university').optional().isString(),
  query('course').optional().isString(),
  query('year').optional().isInt({ min: 2000, max: 2030 }),
  query('category').optional().isString(),
  validate
], ctrl.getPastQuestions);

module.exports = router;
