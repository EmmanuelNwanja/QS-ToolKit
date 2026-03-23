const router = require('express').Router();
const ctrl  = require('../controllers/calculatorController');
const ctrl2 = require('../controllers/calculatorController2');
const { protect } = require('../middlewares/authMiddleware');
const { checkCalculatorLimit } = require('../middlewares/subscriptionMiddleware');

// All calculator routes require auth + limit check
router.use(protect, checkCalculatorLimit);

// ── Original 8 calculators ────────────────────────────────────────
router.post('/concrete',    ctrl.concrete);
router.post('/masonry',     ctrl.masonry);
router.post('/plastering',  ctrl.plastering);
router.post('/paint',       ctrl.paint);
router.post('/roofing',     ctrl.roofing);
router.post('/steel',       ctrl.steel);
router.post('/earthwork',   ctrl.earthwork);
router.post('/tiling',      ctrl.tiling);

// ── New 5 calculators ─────────────────────────────────────────────
router.post('/carpentry',       ctrl2.carpentry);
router.post('/formwork',        ctrl2.formwork);
router.post('/roof-accessories',ctrl2.roofAccessories);
router.post('/door-window',     ctrl2.doorWindow);
router.post('/brc-dpm',         ctrl2.brcDpm);

// ── Saved calculations ────────────────────────────────────────────
router.post('/save',  ctrl.save);
router.get('/saved',  ctrl.getSaved);

module.exports = router;
