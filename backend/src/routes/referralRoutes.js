const router = require('express').Router();
const ctrl = require('../controllers/referralController');
const { protect } = require('../middlewares/authMiddleware');
const { adminAuth, superAdminAuth, requirePermission } = require('../middlewares/adminMiddleware');

// ─── User routes (auth required) ─────────────────────────────
router.use(protect);

router.get('/my-link', ctrl.getMyLink);
router.get('/my-stats', ctrl.getMyStats);

// ─── Admin routes ─────────────────────────────────────────────
router.get('/admin/discounts', adminAuth, requirePermission('manage_users'), ctrl.adminListDiscounts);
router.get('/admin/stats', adminAuth, requirePermission('view_analytics'), ctrl.adminGetReferralStats);
router.post('/admin/discounts', adminAuth, superAdminAuth, ctrl.adminAssignDiscount);
router.patch('/admin/discounts/:id', adminAuth, superAdminAuth, ctrl.adminUpdateDiscount);
router.delete('/admin/discounts/:id', adminAuth, superAdminAuth, ctrl.adminRevokeDiscount);

module.exports = router;
