const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/classroomController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../utils/validators');

router.use(protect);

// ── Scene Types ─────────────────────────────────────────────
router.get('/scene-types', ctrl.getSceneTypes);

// ── Outline ─────────────────────────────────────────────────
router.post('/outline/generate', [
  body('topic').trim().notEmpty().withMessage('topic is required'),
  body('subject').optional().isString(),
  validate
], ctrl.generateOutline);

router.post('/outline/:outlineId/accept', [
  param('outlineId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid outline ID required'),
  validate
], ctrl.acceptOutline);

// ── Lessons ─────────────────────────────────────────────────
router.get('/lessons', ctrl.getLessons);

router.get('/lessons/:lessonId', [
  param('lessonId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid lesson ID required'),
  validate
], ctrl.getLesson);

router.get('/lessons/:lessonId/progress', [
  param('lessonId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid lesson ID required'),
  validate
], ctrl.getLessonProgress);

router.delete('/lessons/:lessonId', [
  param('lessonId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid lesson ID required'),
  validate
], ctrl.deleteLesson);

// ── Scenes ──────────────────────────────────────────────────
router.post('/scenes/:sceneId/generate', [
  param('sceneId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid scene ID required'),
  validate
], ctrl.generateSceneContent);

router.post('/scenes/:sceneId/submit', [
  param('sceneId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid scene ID required'),
  body('responses').notEmpty().withMessage('responses is required'),
  validate
], ctrl.submitSceneResponse);

// ── Discussion ──────────────────────────────────────────────
router.post('/scenes/:sceneId/discussion/start', [
  param('sceneId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid scene ID required'),
  validate
], ctrl.startDiscussion);

router.post('/scenes/:sceneId/discussion/continue', [
  param('sceneId').isString().isLength({ min: 1, max: 100 }).withMessage('Valid scene ID required'),
  body('session_id').trim().notEmpty().withMessage('session_id is required'),
  body('user_message').trim().notEmpty().withMessage('user_message is required'),
  validate
], ctrl.continueDiscussion);

// ── Analytics ───────────────────────────────────────────────
router.get('/analytics', ctrl.getAnalytics);

module.exports = router;
