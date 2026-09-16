const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/curriculumController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../utils/validators');

router.use(protect);

// ── Course Catalog ───────────────────────────────────────────
router.get('/courses', ctrl.getCourses);

router.get('/courses/:courseId/progress', [
  param('courseId').isUUID().withMessage('Valid course ID required'),
  validate
], ctrl.getCourseProgress);

router.post('/courses/:courseId/start', [
  param('courseId').isUUID().withMessage('Valid course ID required'),
  validate
], ctrl.startCourse);

router.get('/courses/:courseId/next-lesson', [
  param('courseId').isUUID().withMessage('Valid course ID required'),
  validate
], ctrl.getNextLesson);

router.post('/courses/:courseId/complete-level', [
  param('courseId').isUUID().withMessage('Valid course ID required'),
  validate
], ctrl.completeLevel);

// ── Custom Learning ──────────────────────────────────────────
router.post('/lessons/generate-custom', [
  body('topic').trim().notEmpty().withMessage('topic is required'),
  body('difficulty').optional().isIn(['easy','medium','hard','expert']),
  validate
], ctrl.generateCustomLesson);

module.exports = router;
