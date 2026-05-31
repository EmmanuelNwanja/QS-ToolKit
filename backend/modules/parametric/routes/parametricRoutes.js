const router = require('express').Router();
const { protect } = require('../../../src/middlewares/authMiddleware');
const { adminAuth } = require('../../../src/middlewares/adminMiddleware');
const { checkCalculatorLimit } = require('../../../src/middlewares/subscriptionMiddleware');
const ctrl = require('../controllers/parametricController');
const adminCtrl = require('../controllers/adminController');

router.use(protect, checkCalculatorLimit);

router.post('/calculate',              ctrl.calculate);
router.post('/calculate/compare',      ctrl.compare);
router.post('/calculate/circular',     ctrl.calculateCircular);
router.post('/calculate/cylindrical',  ctrl.calculateCylindrical);
router.post('/calculate/curved',       ctrl.calculateCurved);
router.post('/calculate/dome',         ctrl.calculateDome);

router.get('/typologies',              ctrl.listTypologies);
router.get('/standards/:code/rules',   ctrl.getStandardRules);

router.post('/calculations/:id/inject-boq', ctrl.injectBoq);
router.put('/calculations/:id/override',    ctrl.applyOverride);

// ── Admin toggle (guarded by adminAuth) ────────────────────────
router.get('/admin/status',  protect, adminAuth, adminCtrl.getStatus);
router.post('/admin/toggle', protect, adminAuth, adminCtrl.toggle);
router.post('/admin/reset',  protect, adminAuth, adminCtrl.reset);

module.exports = router;
