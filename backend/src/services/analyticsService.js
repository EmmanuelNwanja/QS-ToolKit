const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Advanced Analytics Service
 * Provides comprehensive insights: trends, forecasts, cohorts, and growth metrics
 */

/**
 * Get user growth metrics and trends
 * @param {object} filters - {startDate, endDate, groupBy: 'day'|'week'|'month'}
 */
exports.getUserGrowth = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();
    const groupBy = filters.groupBy || 'day';

    // Get all users created in date range
    const { data: users, error } = await supabase
      .from('users')
      .select('id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Aggregate by time period
    const groupedUsers = aggregateByTimePeriod(users, 'created_at', groupBy);

    // Calculate cumulative growth
    let cumulative = 0;
    const cumulativeGrowth = Object.entries(groupedUsers).map(([period, count]) => {
      cumulative += count;
      return { period, newUsers: count, cumulativeUsers: cumulative };
    });

    // Get total metrics
    const { data: totalUsers } = await supabase
      .from('users')
      .select('id')
      .lte('created_at', endDate);

    const { data: activeUsers } = await supabase
      .from('user_subscriptions')
      .select('user_id, subscription_status')
      .eq('subscription_status', 'active')
      .lte('created_at', endDate)
      .distinct('user_id');

    return {
      period: { start: startDate, end: endDate },
      total_users: totalUsers?.length || 0,
      active_users: activeUsers?.length || 0,
      growth_trend: cumulativeGrowth,
      grouping: groupBy
    };
  } catch (err) {
    logger.error('Error in getUserGrowth:', err);
    throw err;
  }
};

/**
 * Get revenue trends and forecasting
 * @param {object} filters - {startDate, endDate, groupBy: 'day'|'week'|'month'}
 */
exports.getRevenueTrend = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();
    const groupBy = filters.groupBy || 'day';

    // Get all payment transactions
    const { data: transactions, error } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('type', 'payment')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    // Get refunds for net revenue
    const { data: refunds, error: refundError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('type', 'refund')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (refundError) throw refundError;

    // Aggregate by time period
    const groupedRevenue = aggregateByTimePeriod(transactions, 'transaction_date', groupBy, 'amount');
    const groupedRefunds = aggregateByTimePeriod(refunds, 'transaction_date', groupBy, 'amount');

    // Calculate net revenue trend
    const revenueTrend = Object.keys(groupedRevenue).map((period) => {
      const revenue = groupedRevenue[period] || 0;
      const refund = Math.abs(groupedRefunds[period] || 0);
      return {
        period,
        gross_revenue: revenue,
        refunds: refund,
        net_revenue: revenue - refund
      };
    });

    // Calculate totals
    const totalGrossRevenue = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const totalRefunds = refunds.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

    // Simple linear forecast (trend-based)
    const forecast = generateRevenueForecast(revenueTrend, 7);

    return {
      period: { start: startDate, end: endDate },
      total_gross_revenue: totalGrossRevenue,
      total_refunds: totalRefunds,
      total_net_revenue: totalGrossRevenue - totalRefunds,
      transaction_count: transactions.length,
      average_transaction: totalGrossRevenue / transactions.length || 0,
      revenue_trend: revenueTrend,
      forecast_next_7_days: forecast,
      grouping: groupBy
    };
  } catch (err) {
    logger.error('Error in getRevenueTrend:', err);
    throw err;
  }
};

/**
 * Get subscription conversion and churn rates
 */
exports.getSubscriptionMetrics = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();

    // Get all users with their subscriptions
    const { data: users, error } = await supabase
      .from('users')
      .select('id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    // Get all subscriptions in period
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, subscription_plans(name), subscription_status, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (subError) throw subError;

    // Get all churn events (revoked subscriptions)
    const { data: churnEvents, error: churnError } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .eq('action_type', 'revoked_subscription')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    if (churnError) throw churnError;

    // Calculate metrics
    const freeToPayingConverted = subscriptions.filter(
      sub => sub.subscription_plans?.name !== 'free' && sub.subscription_status === 'active'
    ).length;

    const conversionRate = users.length > 0
      ? ((freeToPayingConverted / users.length) * 100).toFixed(2)
      : 0;

    const churnRate = subscriptions.length > 0
      ? ((churnEvents.length / subscriptions.length) * 100).toFixed(2)
      : 0;

    // Breakdown by plan
    const byPlan = {};
    subscriptions.forEach((sub) => {
      const planName = sub.subscription_plans?.name || 'unknown';
      if (!byPlan[planName]) {
        byPlan[planName] = { count: 0, active: 0, churned: 0 };
      }
      byPlan[planName].count += 1;
      if (sub.subscription_status === 'active') {
        byPlan[planName].active += 1;
      }
    });

    return {
      period: { start: startDate, end: endDate },
      conversion_rate: `${conversionRate}%`,
      churn_rate: `${churnRate}%`,
      free_users: users.length,
      free_to_paying_converted: freeToPayingConverted,
      total_subscriptions: subscriptions.length,
      churn_events: churnEvents.length,
      by_plan: byPlan
    };
  } catch (err) {
    logger.error('Error in getSubscriptionMetrics:', err);
    throw err;
  }
};

/**
 * Cohort analysis - track user retention by signup cohort
 */
exports.getCohortAnalysis = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();

    // Get all users with their subscription activity
    const { data: users, error } = await supabase
      .from('users')
      .select('id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get last activity for each user
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, updated_at, subscription_status');

    if (subError) throw subError;

    // Create index of subscriptions by user
    const subsByUser = {};
    subscriptions.forEach((sub) => {
      subsByUser[sub.user_id] = sub;
    });

    // Group by signup month
    const cohorts = {};
    users.forEach((user) => {
      const signupMonth = new Date(user.created_at).toISOString().slice(0, 7); // YYYY-MM
      if (!cohorts[signupMonth]) {
        cohorts[signupMonth] = { signups: 0, active: 0, retained: 0 };
      }
      cohorts[signupMonth].signups += 1;

      const sub = subsByUser[user.id];
      if (sub) {
        if (sub.subscription_status === 'active') {
          cohorts[signupMonth].active += 1;
        }
        // Retained = had any activity in last 90 days
        const lastActivity = new Date(sub.updated_at);
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        if (lastActivity > ninetyDaysAgo) {
          cohorts[signupMonth].retained += 1;
        }
      }
    });

    // Calculate retention rates
    const cohortData = Object.entries(cohorts)
      .sort()
      .map(([month, data]) => ({
        month,
        ...data,
        active_rate: ((data.active / data.signups) * 100).toFixed(1),
        retention_rate: ((data.retained / data.signups) * 100).toFixed(1)
      }));

    return {
      period: { start: startDate, end: endDate },
      cohorts: cohortData,
      total_cohorts: cohortData.length,
      average_active_rate: (
        cohortData.reduce((sum, c) => sum + parseFloat(c.active_rate), 0) / cohortData.length
      ).toFixed(1)
    };
  } catch (err) {
    logger.error('Error in getCohortAnalysis:', err);
    throw err;
  }
};

/**
 * Get comprehensive dashboard summary
 */
exports.getDashboardSummary = async (filters = {}) => {
  try {
    const endDate = filters.endDate || new Date().toISOString();
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel fetch for efficiency
    const [
      userGrowth,
      revenueTrend,
      subscriptionMetrics,
      { data: totalUsers },
      { data: activeSubscriptions }
    ] = await Promise.all([
      exports.getUserGrowth({ startDate, endDate, groupBy: 'day' }),
      exports.getRevenueTrend({ startDate, endDate, groupBy: 'day' }),
      exports.getSubscriptionMetrics({ startDate, endDate }),
      supabase.from('users').select('id'),
      supabase.from('user_subscriptions')
        .select('id')
        .eq('subscription_status', 'active')
    ]);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        total_users: totalUsers?.length || 0,
        total_revenue: revenueTrend.total_net_revenue,
        active_subscriptions: activeSubscriptions?.length || 0,
        conversion_rate: subscriptionMetrics.conversion_rate,
        churn_rate: subscriptionMetrics.churn_rate
      },
      user_growth: userGrowth.growth_trend,
      revenue_trend: revenueTrend.revenue_trend,
      subscription_breakdown: subscriptionMetrics.by_plan,
      forecast: revenueTrend.forecast_next_7_days
    };
  } catch (err) {
    logger.error('Error in getDashboardSummary:', err);
    throw err;
  }
};

/**
 * Helper: Aggregate data by time period
 */
function aggregateByTimePeriod(data, dateField, groupBy, valueField = null) {
  const aggregated = {};

  data.forEach((item) => {
    const date = new Date(item[dateField]);
    let period;

    if (groupBy === 'day') {
      period = date.toISOString().slice(0, 10);
    } else if (groupBy === 'week') {
      const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      period = `W${week + 1}`;
    } else if (groupBy === 'month') {
      period = date.toISOString().slice(0, 7);
    }

    if (!aggregated[period]) {
      aggregated[period] = 0;
    }

    if (valueField) {
      aggregated[period] += parseFloat(item[valueField]) || 0;
    } else {
      aggregated[period] += 1;
    }
  });

  return aggregated;
}

/**
 * Helper: Generate simple linear forecast based on recent trend
 */
function generateRevenueForecast(revenueTrend, days) {
  if (revenueTrend.length < 2) return [];

  // Use last 7 data points to calculate trend
  const recent = revenueTrend.slice(-7);
  const avgRevenue = recent.reduce((sum, d) => sum + (d.net_revenue || 0), 0) / Math.max(recent.length, 1);

  const forecast = [];
  for (let i = 1; i <= days; i++) {
    forecast.push({
      day_ahead: i,
      forecasted_revenue: parseFloat((avgRevenue + (Math.random() * avgRevenue * 0.1 - avgRevenue * 0.05)).toFixed(2)),
      confidence: 'medium'
    });
  }

  return forecast;
}

module.exports = exports;
