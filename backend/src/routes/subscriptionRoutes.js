const router = require('express').Router();
const ctrl = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/authMiddleware');

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

module.exports = router;
