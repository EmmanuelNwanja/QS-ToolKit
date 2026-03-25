const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  adminAuth,
  superAdminAuth,
  requirePermission,
  trackAdminActivity
} = require('../middlewares/adminMiddleware');
const adminController = require('../controllers/adminController');

// ── Apply authentication to all admin routes ──────────────────
router.use(authMiddleware.auth);

// ── ADMIN VERIFICATION ────────────────────────────────────────
router.get(
  '/verify',
  adminAuth,
  adminController.verifyAdmin
);

// ── ADMIN USER MANAGEMENT (super_admin only) ──────────────────
router.post(
  '/admins',
  adminAuth,
  superAdminAuth,
  trackAdminActivity('created_admin', 'admin_user'),
  adminController.createAdmin
);

router.get(
  '/admins',
  adminAuth,
  adminController.getAdmins
);

router.patch(
  '/admins/:adminId',
  adminAuth,
  superAdminAuth,
  trackAdminActivity('updated_admin', 'admin_user'),
  adminController.updateAdminPermissions
);

router.delete(
  '/admins/:adminId',
  adminAuth,
  superAdminAuth,
  trackAdminActivity('removed_admin', 'admin_user'),
  adminController.removeAdmin
);

// ── PROMO CODE MANAGEMENT ──────────────────────────────────────
router.post(
  '/promo-codes',
  adminAuth,
  requirePermission('manage_promos'),
  trackAdminActivity('created_promo_code', 'promo_code'),
  adminController.createPromoCode
);

router.get(
  '/promo-codes',
  adminAuth,
  requirePermission('manage_promos'),
  adminController.getPromoCodes
);

router.get(
  '/promo-codes/:codeId',
  adminAuth,
  requirePermission('manage_promos'),
  adminController.getPromoCodeDetail
);

router.patch(
  '/promo-codes/:codeId',
  adminAuth,
  requirePermission('manage_promos'),
  trackAdminActivity('updated_promo_code', 'promo_code'),
  adminController.updatePromoCode
);

router.delete(
  '/promo-codes/:codeId',
  adminAuth,
  requirePermission('manage_promos'),
  trackAdminActivity('deleted_promo_code', 'promo_code'),
  adminController.deletePromoCode
);

// ── USER MANAGEMENT ────────────────────────────────────────────
router.get(
  '/users',
  adminAuth,
  requirePermission('manage_users'),
  adminController.getUsers
);

// ── SUBSCRIPTION MANAGEMENT ────────────────────────────────────
router.get(
  '/subscriptions',
  adminAuth,
  requirePermission('manage_users'),
  adminController.getSubscriptions
);

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
router.get(
  '/notifications',
  adminAuth,
  requirePermission('send_notifications'),
  adminController.getPushNotifications
);

router.post(
  '/notifications',
  adminAuth,
  requirePermission('send_notifications'),
  trackAdminActivity('sent_notification', 'push_notification'),
  adminController.sendPushNotification
);

// ── ACTIVITY LOGS ──────────────────────────────────────────────
router.get(
  '/activity-logs',
  adminAuth,
  adminController.getActivityLogs
);

// ── ANALYTICS & STATS ──────────────────────────────────────────
router.get(
  '/stats',
  adminAuth,
  requirePermission('view_analytics'),
  adminController.getDashboardStats
);

router.get(
  '/analytics',
  adminAuth,
  requirePermission('view_analytics'),
  adminController.getAnalytics
);

module.exports = router;
