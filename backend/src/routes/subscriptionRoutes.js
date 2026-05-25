const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/subscriptionController');
const paymentSettingsCtrl = require('../controllers/paymentSettingsController');
const { protect } = require('../middlewares/authMiddleware');
const { webhookLimiter, paymentLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../utils/validators');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'));
    }
  },
});

// Public
router.get('/plans',           ctrl.getPlans);
router.post('/webhook',        webhookLimiter, ctrl.webhook);
router.get('/bank-transfer/settings', paymentSettingsCtrl.getBankTransferSettings);

// Protected
router.use(protect);
router.get('/my',              ctrl.mySubscription);
router.post('/initiate',       paymentLimiter, [
  body('plan_name').trim().notEmpty().withMessage('plan_name is required'),
  body('billing_cycle').isIn(['monthly', 'annual']).withMessage('billing_cycle must be monthly or annual'),
  validate
], ctrl.initiate);
router.get('/verify',          ctrl.verify);
router.post('/validate-promo', [
  body('code').trim().notEmpty().withMessage('Promo code is required'),
  body('plan_name').trim().notEmpty().withMessage('plan_name is required'),
  validate
], ctrl.validatePromo);
router.post('/philanthropist', paymentLimiter, [
  body('beneficiary_email').isEmail().normalizeEmail().withMessage('Valid beneficiary email required'),
  body('plan_name').trim().notEmpty().withMessage('plan_name is required'),
  body('donor_email').isEmail().normalizeEmail().withMessage('Valid donor email required'),
  validate
], ctrl.initiatePhilanthropist);
router.post('/cancel',         ctrl.cancelMySubscription);
router.post('/renew',          paymentLimiter, [
  body('billing_cycle').isIn(['monthly', 'annual']).withMessage('billing_cycle must be monthly or annual'),
  validate
], ctrl.renewMySubscription);
router.patch('/auto-renew',    ctrl.setAutoRenew);

// Direct payment submission endpoints
router.post('/direct/submit-payment', paymentLimiter, [
  body('planName').trim().notEmpty().withMessage('planName is required'),
  body('amountNgn').isNumeric().withMessage('amountNgn must be a number'),
  validate
], upload.single('receipt'), ctrl.submitBankTransferPayment);
router.get('/direct/my-submissions',  paymentSettingsCtrl.getMyPaymentSubmissions);
router.get('/status/current',         ctrl.getMySubscriptionStatus);
router.get('/audit/history',          ctrl.getMySubscriptionAudit);

module.exports = router;
