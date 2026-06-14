const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  adminAuth,
  requirePermission,
  trackAdminActivity
} = require('../middlewares/adminMiddleware');
const userActionsController = require('../controllers/userActionsController');

// ── Apply authentication to all routes ──────────────────────
router.use(authMiddleware.protect);
router.use(adminAuth);

// ── USER ACCOUNT ACTIONS ────────────────────────────────────

/**
 * Suspend user account
 */
router.post(
  '/:userId/suspend',
  requirePermission('manage_users'),
  trackAdminActivity('suspended_user', 'user'),
  userActionsController.suspendUser
);

/**
 * Unsuspend user account
 */
router.post(
  '/:userId/unsuspend',
  requirePermission('manage_users'),
  trackAdminActivity('unsuspended_user', 'user'),
  userActionsController.unsuspendUser
);

/**
 * Verify user account
 */
router.post(
  '/:userId/verify',
  requirePermission('manage_users'),
  trackAdminActivity('verified_user', 'user'),
  userActionsController.verifyUser
);

// ── SUBSCRIPTION MANAGEMENT ─────────────────────────────────

/**
 * Override user subscription
 */
router.post(
  '/:userId/subscription/override',
  requirePermission('manage_users'),
  trackAdminActivity('override_subscription', 'subscription'),
  userActionsController.overrideSubscription
);

/**
 * Extend user subscription
 */
router.post(
  '/:userId/subscription/extend',
  requirePermission('manage_users'),
  trackAdminActivity('extend_subscription', 'subscription'),
  userActionsController.extendSubscription
);

/**
 * Revoke subscription (downgrade to free)
 */
router.post(
  '/:userId/subscription/revoke',
  requirePermission('manage_users'),
  trackAdminActivity('revoke_subscription', 'subscription'),
  userActionsController.revokeSubscription
);

// ── ACADEMY SUBSCRIPTION MANAGEMENT ────────────────────────

/**
 * Get all subscriptions for a user (core + academy + exam prep)
 */
router.get(
  '/:userId/subscriptions',
  requirePermission('manage_users'),
  userActionsController.getUserSubscriptions
);

/**
 * Grant Academy subscription
 */
router.post(
  '/:userId/academy/grant',
  requirePermission('manage_users'),
  trackAdminActivity('granted_academy_subscription', 'subscription'),
  userActionsController.grantAcademySubscription
);

/**
 * Extend Academy subscription
 */
router.post(
  '/:userId/academy/extend',
  requirePermission('manage_users'),
  trackAdminActivity('extended_academy_subscription', 'subscription'),
  userActionsController.extendAcademySubscription
);

/**
 * Revoke Academy subscription
 */
router.post(
  '/:userId/academy/revoke',
  requirePermission('manage_users'),
  trackAdminActivity('revoked_academy_subscription', 'subscription'),
  userActionsController.revokeAcademySubscription
);

// ── EXAM PREP SUBSCRIPTION MANAGEMENT ──────────────────────

/**
 * Grant Exam Prep subscription
 */
router.post(
  '/:userId/exam-prep/grant',
  requirePermission('manage_users'),
  trackAdminActivity('granted_exam_prep_subscription', 'subscription'),
  userActionsController.grantExamPrepSubscription
);

/**
 * Extend Exam Prep subscription
 */
router.post(
  '/:userId/exam-prep/extend',
  requirePermission('manage_users'),
  trackAdminActivity('extended_exam_prep_subscription', 'subscription'),
  userActionsController.extendExamPrepSubscription
);

/**
 * Revoke Exam Prep subscription
 */
router.post(
  '/:userId/exam-prep/revoke',
  requirePermission('manage_users'),
  trackAdminActivity('revoked_exam_prep_subscription', 'subscription'),
  userActionsController.revokeExamPrepSubscription
);

// ── REFUND & CREDIT MANAGEMENT ──────────────────────────────

/**
 * Issue credit to user
 */
router.post(
  '/:userId/credit',
  requirePermission('manage_billing'),
  trackAdminActivity('issued_credit', 'user_credit'),
  userActionsController.issueCredit
);

/**
 * Process refund (by subscription ID — legacy)
 */
router.post(
  '/refund/:subscriptionId',
  requirePermission('manage_billing'),
  trackAdminActivity('processed_refund', 'refund'),
  userActionsController.processRefund
);

/**
 * Process refund by user ID
 */
router.post(
  '/:userId/refund',
  requirePermission('manage_billing'),
  trackAdminActivity('processed_refund', 'refund'),
  userActionsController.processRefundByUser
);

module.exports = router;
