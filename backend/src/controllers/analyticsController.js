const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');
const { logAdminActivity } = require('../middlewares/authMiddleware');

/**
 * Get user growth metrics and trends
 */
exports.getUserGrowth = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const growth = await analyticsService.getUserGrowth({
      startDate,
      endDate,
      groupBy: groupBy || 'day'
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_user_growth', 'analytics', 'all', {
      startDate,
      endDate,
      groupBy
    }, req);

    res.json({
      success: true,
      data: growth
    });
  } catch (err) {
    logger.error('Error fetching user growth:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch user growth data'
    });
  }
};

/**
 * Get revenue trends and forecasts
 */
exports.getRevenueTrend = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const trend = await analyticsService.getRevenueTrend({
      startDate,
      endDate,
      groupBy: groupBy || 'day'
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_revenue_trend', 'analytics', 'all', {
      startDate,
      endDate,
      groupBy
    }, req);

    res.json({
      success: true,
      data: trend
    });
  } catch (err) {
    logger.error('Error fetching revenue trend:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch revenue trend'
    });
  }
};

/**
 * Get subscription conversion and churn metrics
 */
exports.getSubscriptionMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await analyticsService.getSubscriptionMetrics({
      startDate,
      endDate
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_subscription_metrics', 'analytics', 'all', {
      startDate,
      endDate
    }, req);

    res.json({
      success: true,
      data: metrics
    });
  } catch (err) {
    logger.error('Error fetching subscription metrics:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch subscription metrics'
    });
  }
};

/**
 * Get cohort analysis (retention by signup cohort)
 */
exports.getCohortAnalysis = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const cohorts = await analyticsService.getCohortAnalysis({
      startDate,
      endDate
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_cohort_analysis', 'analytics', 'all', {
      startDate,
      endDate
    }, req);

    res.json({
      success: true,
      data: cohorts
    });
  } catch (err) {
    logger.error('Error fetching cohort analysis:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch cohort analysis'
    });
  }
};

/**
 * Get comprehensive dashboard summary
 */
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const summary = await analyticsService.getDashboardSummary({
      startDate,
      endDate
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_analytics_dashboard', 'analytics', 'all', {
      startDate,
      endDate
    }, req);

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    logger.error('Error fetching dashboard summary:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch analytics summary'
    });
  }
};

module.exports = exports;
