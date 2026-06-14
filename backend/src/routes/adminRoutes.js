const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  adminAuth,
  superAdminAuth,
  requirePermission,
  trackAdminActivity
} = require('../middlewares/adminMiddleware');
const adminController = require('../controllers/adminController');
const adminPaymentController = require('../controllers/adminPaymentController');
const paymentSettingsCtrl = require('../controllers/paymentSettingsController');

// ── Apply authentication to all admin routes ──────────────────
router.use(authMiddleware.protect);

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

router.post(
  '/users/:userId/one-time-password',
  adminAuth,
  requirePermission('manage_users'),
  trackAdminActivity('generated_one_time_password', 'user'),
  adminController.generateUserOneTimePassword
);

// ── SUBSCRIPTION MANAGEMENT ────────────────────────────────────
router.get(
  '/subscriptions',
  adminAuth,
  requirePermission('manage_users'),
  adminController.getSubscriptions
);

router.get(
  '/paystack-plan-mappings',
  adminAuth,
  superAdminAuth,
  adminController.getPaystackPlanMappings
);

router.patch(
  '/paystack-plan-mappings/:planId',
  adminAuth,
  superAdminAuth,
  trackAdminActivity('updated_paystack_plan_mapping', 'subscription_plan'),
  adminController.updatePaystackPlanMapping
);

// ── DIRECT PAYMENT MANAGEMENT ──────────────────────────────────
router.get(
  '/payments/direct/list',
  adminAuth,
  requirePermission('manage_billing'),
  adminPaymentController.listPayments
);

router.get(
  '/payments/direct/:submissionId',
  adminAuth,
  requirePermission('manage_billing'),
  adminPaymentController.getPaymentDetail
);

router.post(
  '/payments/direct/:submissionId/verify',
  adminAuth,
  requirePermission('manage_billing'),
  trackAdminActivity('verified_payment', 'direct_payment_submission'),
  adminPaymentController.verifyPayment
);

router.post(
  '/payments/direct/:submissionId/reject',
  adminAuth,
  requirePermission('manage_billing'),
  trackAdminActivity('rejected_payment', 'direct_payment_submission'),
  adminPaymentController.rejectPayment
);

router.get(
  '/payments/direct/stats/overview',
  adminAuth,
  requirePermission('manage_billing'),
  adminPaymentController.getPaymentStats
);

// ── BANK TRANSFER SETTINGS ─────────────────────────────────────
router.get(
  '/payment-settings/bank-transfer',
  adminAuth,
  requirePermission('manage_billing'),
  paymentSettingsCtrl.getBankTransferSettingsAdmin
);

router.put(
  '/payment-settings/bank-transfer',
  adminAuth,
  superAdminAuth,
  trackAdminActivity('updated_bank_transfer_settings', 'payment_settings'),
  paymentSettingsCtrl.updateBankTransferSettings
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

router.post(
  '/email/test',
  adminAuth,
  requirePermission('send_notifications'),
  adminController.sendTestEmail
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

// ── ACADEMY & EXAM PREP STATS ──────────────────────────────────
router.get(
  '/academy/stats',
  adminAuth,
  requirePermission('view_analytics'),
  adminController.getAcademyStats
);

router.get(
  '/exam-prep/stats',
  adminAuth,
  requirePermission('view_analytics'),
  adminController.getExamPrepStats
);

module.exports = router;
