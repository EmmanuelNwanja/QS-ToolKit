const router = require('express').Router();
const ctrl = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/authMiddleware');
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
router.post('/webhook',        ctrl.webhook);

// Protected
router.use(protect);
router.get('/my',              ctrl.mySubscription);
router.post('/initiate',       ctrl.initiate);
router.get('/verify',          ctrl.verify);
router.post('/validate-promo', ctrl.validatePromo);
router.post('/philanthropist', ctrl.initiatePhilanthropist);
router.post('/cancel',         ctrl.cancelMySubscription);
router.post('/renew',          ctrl.renewMySubscription);
router.patch('/auto-renew',    ctrl.setAutoRenew);

// Direct payment submission endpoints
router.post('/direct/submit-payment', upload.single('receipt'), ctrl.submitBankTransferPayment);
router.get('/direct/my-submissions',  ctrl.getMyPaymentSubmissions);
router.get('/status/current',         ctrl.getMySubscriptionStatus);
router.get('/audit/history',          ctrl.getMySubscriptionAudit);

module.exports = router;
