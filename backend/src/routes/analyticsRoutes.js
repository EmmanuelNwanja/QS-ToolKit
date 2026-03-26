const router = require('express').Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middlewares/authMiddleware');
const { adminAuth, requirePermission } = require('../middlewares/adminMiddleware');

// All analytics routes require admin auth and view_analytics permission
router.use(authMiddleware.protect);
router.use(adminAuth);
router.use(requirePermission('view_analytics'));

/**
 * User growth metrics
 * GET /api/analytics/growth
 * Query: startDate, endDate, groupBy ('day'|'week'|'month')
 */
router.get('/growth', analyticsController.getUserGrowth);

/**
 * Revenue trends and forecast
 * GET /api/analytics/revenue
 * Query: startDate, endDate, groupBy ('day'|'week'|'month')
 */
router.get('/revenue', analyticsController.getRevenueTrend);

/**
 * Subscription conversion and churn rates
 * GET /api/analytics/subscriptions
 * Query: startDate, endDate
 */
router.get('/subscriptions', analyticsController.getSubscriptionMetrics);

/**
 * Cohort analysis - retention by signup cohort
 * GET /api/analytics/cohorts
 * Query: startDate, endDate
 */
router.get('/cohorts', analyticsController.getCohortAnalysis);

/**
 * Comprehensive dashboard summary
 * GET /api/analytics/summary
 * Query: startDate, endDate
 */
router.get('/summary', analyticsController.getDashboardSummary);

module.exports = router;
