const router = require('express').Router();
const ctrl = require('../controllers/referralController');
const { protect } = require('../middlewares/authMiddleware');
const { adminAuth, superAdminAuth, requirePermission } = require('../middlewares/adminMiddleware');

// ─── User routes (auth required) ─────────────────────────────
router.use(protect);

router.get('/my-link', ctrl.getMyLink);
router.get('/my-stats', ctrl.getMyStats);
router.get('/my-income', ctrl.getMyIncome);
router.get('/my-signups', ctrl.getMySignups);

// ─── Admin routes ─────────────────────────────────────────────
router.get('/admin/users-lookup', adminAuth, requirePermission('manage_users'), ctrl.adminUserLookup);
router.get('/admin/discounts', adminAuth, requirePermission('manage_users'), ctrl.adminListDiscounts);
router.get('/admin/stats', adminAuth, requirePermission('view_analytics'), ctrl.adminGetReferralStats);
router.post('/admin/discounts', adminAuth, superAdminAuth, ctrl.adminAssignDiscount);
router.patch('/admin/discounts/:id', adminAuth, superAdminAuth, ctrl.adminUpdateDiscount);
router.delete('/admin/discounts/:id', adminAuth, superAdminAuth, ctrl.adminRevokeDiscount);

router.get('/admin/income-rates', adminAuth, requirePermission('manage_users'), ctrl.adminListIncomeRates);
router.post('/admin/income-rates', adminAuth, superAdminAuth, ctrl.adminSetIncomeRate);
router.patch('/admin/income-rates/:id', adminAuth, superAdminAuth, ctrl.adminUpdateIncomeRate);
router.delete('/admin/income-rates/:id', adminAuth, superAdminAuth, ctrl.adminRevokeIncomeRate);

module.exports = router;
