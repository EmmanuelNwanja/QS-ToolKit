const router = require('express').Router();
const billingController = require('../controllers/billingController');
const { adminAuth, requirePermission } = require('../middlewares/adminMiddleware');

// All billing audit endpoints require admin auth and manage_billing permission
router.use(adminAuth);

/**
 * User transaction history
 * GET /api/billing/users/:userId/transactions
 * Query params: startDate, endDate, type, status, limit, offset
 */
router.get(
  '/users/:userId/transactions',
  requirePermission('manage_billing'),
  billingController.getUserTransactions
);

/**
 * Subscription audit trail - all changes to a subscription
 * GET /api/billing/subscriptions/:subscriptionId/audit
 */
router.get(
  '/subscriptions/:subscriptionId/audit',
  requirePermission('manage_billing'),
  billingController.getSubscriptionAudit
);

/**
 * Subscription summary with transaction history
 * GET /api/billing/subscriptions/:subscriptionId/summary
 */
router.get(
  '/subscriptions/:subscriptionId/summary',
  requirePermission('manage_billing'),
  billingController.getSubscriptionSummary
);

/**
 * Revenue report by subscription plan
 * GET /api/billing/reports/revenue
 * Query params: startDate, endDate
 */
router.get(
  '/reports/revenue',
  requirePermission('view_analytics'),
  billingController.getRevenueReport
);

/**
 * Churn analysis - users losing subscriptions
 * GET /api/billing/reports/churn
 * Query params: startDate, endDate
 */
router.get(
  '/reports/churn',
  requirePermission('view_analytics'),
  billingController.getChurnAnalysis
);

/**
 * Record manual transaction (adjustment, manual refund, etc)
 * POST /api/billing/users/:userId/subscriptions/:subscriptionId/transaction
 * Body: {amount, type, reason}
 */
router.post(
  '/users/:userId/subscriptions/:subscriptionId/transaction',
  requirePermission('manage_billing'),
  billingController.recordTransaction
);

/**
 * Export transaction data to CSV
 * GET /api/billing/export
 * Query params: startDate, endDate, userId
 */
router.get(
  '/export',
  requirePermission('manage_billing'),
  billingController.exportTransactions
);

module.exports = router;
