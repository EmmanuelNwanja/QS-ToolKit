const router = require('express').Router();
const { param } = require('express-validator');
const ctrl = require('../controllers/migrationController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../utils/validators');

router.use(protect);

router.get('/status', ctrl.getMigrationStatus);

router.post('/exam-prep/:attemptId', [
  param('attemptId').isUUID().withMessage('Valid attempt ID required'),
  validate
], ctrl.migrateExamPrepAttempt);

router.post('/academy-lesson/:lessonId', [
  param('lessonId').isUUID().withMessage('Valid lesson ID required'),
  validate
], ctrl.migrateAcademyLesson);

router.post('/academy-sim/:simId', [
  param('simId').isUUID().withMessage('Valid simulation ID required'),
  validate
], ctrl.migrateAcademySimulation);

router.post('/bulk', ctrl.bulkMigrate);

module.exports = router;
