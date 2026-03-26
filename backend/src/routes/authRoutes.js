const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../utils/validators');

router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('user_type').isIn(['student', 'professional', 'company']).withMessage('Invalid user type'),
  validate
], ctrl.register);

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate
], ctrl.login);

router.post('/verify-email', authLimiter, ctrl.verifyEmail);
router.post('/resend-verification', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  validate
], ctrl.resendVerification);

router.post('/google', ctrl.googleCallback);
router.post('/onboarding', protect, ctrl.completeOnboarding);
router.get('/me', protect, ctrl.me);

module.exports = router;
