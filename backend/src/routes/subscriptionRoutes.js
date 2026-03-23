const router = require('express').Router();
const ctrl = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/authMiddleware');

// Public
router.get('/plans',        ctrl.getPlans);
router.post('/webhook',     ctrl.webhook);  // Paystack webhook (no auth)

// Protected
router.use(protect);
router.get('/my',           ctrl.mySubscription);
router.post('/initiate',    ctrl.initiate);
router.get('/verify',       ctrl.verify);

module.exports = router;
