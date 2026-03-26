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

    const nowIso = new Date().toISOString();
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id, subscription_expires_at')
      .eq('subscription_status', 'active')
      .lte('created_at', endDate);

    const activeUsersCount = (activeUsers || []).filter((u) => {
      return !u.subscription_expires_at || u.subscription_expires_at > nowIso;
    }).length;

    return {
      period: { start: startDate, end: endDate },
      total_users: totalUsers?.length || 0,
      active_users: activeUsersCount,
      growth_trend: cumulativeGrowth,
      grouping: groupBy,
      generated_at: nowIso
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
      .eq('status', 'completed')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    // Get refunds for net revenue
    const { data: refunds, error: refundError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('type', 'refund')
      .eq('status', 'completed')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (refundError) throw refundError;

    // Aggregate by time period
    const groupedRevenue = aggregateByTimePeriod(transactions, 'transaction_date', groupBy, 'amount');
    const groupedRefunds = aggregateByTimePeriod(refunds, 'transaction_date', groupBy, 'amount');

    // Calculate net revenue trend
    const allPeriods = new Set([
      ...Object.keys(groupedRevenue),
      ...Object.keys(groupedRefunds)
    ]);

    const revenueTrend = Array.from(allPeriods).sort().map((period) => {
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
      average_transaction: transactions.length > 0 ? (totalGrossRevenue / transactions.length) : 0,
      revenue_trend: revenueTrend,
      forecast_next_7_days: forecast,
      grouping: groupBy,
      generated_at: new Date().toISOString()
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

    // Users currently on any paid plan (snapshot for plan breakdown)
    const { data: subscriptions, error: subError } = await supabase
      .from('users')
      .select('id, subscription_plans(name), subscription_status, subscription_expires_at, plan_id')
      .not('plan_id', 'is', null)
      .lte('created_at', endDate);

    if (subError) throw subError;

    // Users with successful payments in range represent actual paid conversions.
    const { data: paymentTx, error: txError } = await supabase
      .from('billing_transactions')
      .select('user_id')
      .eq('type', 'payment')
      .eq('status', 'completed')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (txError) throw txError;

    // Churn events from admin activity log (action column, created_at column)
    const { data: churnEvents, error: churnError } = await supabase
      .from('admin_activity_logs')
      .select('id')
      .eq('action', 'revoked_subscription')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (churnError) throw churnError;

    // Natural churn: subscriptions that expired in range and are now inactive.
    const { data: expiredInactive, error: expiryError } = await supabase
      .from('users')
      .select('id')
      .not('plan_id', 'is', null)
      .eq('subscription_status', 'inactive')
      .gte('subscription_expires_at', startDate)
      .lte('subscription_expires_at', endDate);

    if (expiryError) throw expiryError;

    // Calculate metrics
    const payingUsers = new Set((paymentTx || []).map((tx) => tx.user_id).filter(Boolean));
    const freeToPayingConverted = payingUsers.size;

    const totalChurnEvents = (churnEvents?.length || 0) + (expiredInactive?.length || 0);

    const conversionRate = users.length > 0
      ? ((freeToPayingConverted / users.length) * 100).toFixed(2)
      : 0;

    const churnRate = subscriptions.length > 0
      ? ((totalChurnEvents / subscriptions.length) * 100).toFixed(2)
      : 0;

    // Breakdown by plan
    const nowIso = new Date().toISOString();
    const byPlan = {};
    subscriptions.forEach((sub) => {
      const planName = sub.subscription_plans?.name || 'unknown';
      if (!byPlan[planName]) {
        byPlan[planName] = { count: 0, active: 0, churned: 0 };
      }
      byPlan[planName].count += 1;
      const isActive = sub.subscription_status === 'active'
        && (!sub.subscription_expires_at || sub.subscription_expires_at > nowIso);
      if (isActive) {
        byPlan[planName].active += 1;
      } else {
        byPlan[planName].churned += 1;
      }
    });

    return {
      period: { start: startDate, end: endDate },
      conversion_rate: `${conversionRate}%`,
      churn_rate: `${churnRate}%`,
      free_users: users.length,
      free_to_paying_converted: freeToPayingConverted,
      total_subscriptions: subscriptions.length,
      churn_events: totalChurnEvents,
      by_plan: byPlan,
      generated_at: new Date().toISOString()
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
      .from('users')
      .select('id, updated_at, subscription_status, plan_id');

    if (subError) throw subError;

    // Create index of subscription data by user id
    const subsByUser = {};
    subscriptions.forEach((sub) => {
      subsByUser[sub.id] = sub;
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
        if (sub.subscription_status === 'active' && sub.plan_id) {
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
        cohortData.length
          ? (cohortData.reduce((sum, c) => sum + parseFloat(c.active_rate), 0) / cohortData.length)
          : 0
      ).toFixed(1),
      generated_at: new Date().toISOString()
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
      supabase.from('users')
        .select('id, subscription_expires_at')
        .eq('subscription_status', 'active')
    ]);

    const nowIso = new Date().toISOString();
    const activeSubscriptionCount = (activeSubscriptions || []).filter((u) => {
      return !u.subscription_expires_at || u.subscription_expires_at > nowIso;
    }).length;

    return {
      period: { start: startDate, end: endDate },
      summary: {
        total_users: totalUsers?.length || 0,
        total_revenue: revenueTrend.total_net_revenue,
        active_subscriptions: activeSubscriptionCount,
        conversion_rate: subscriptionMetrics.conversion_rate,
        churn_rate: subscriptionMetrics.churn_rate
      },
      user_growth: userGrowth.growth_trend,
      revenue_trend: revenueTrend.revenue_trend,
      subscription_breakdown: subscriptionMetrics.by_plan,
      forecast: revenueTrend.forecast_next_7_days,
      generated_at: new Date().toISOString()
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
      period = `${date.getFullYear()}-W${week + 1}`;
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

  // Deterministic linear-regression forecast over recent points.
  const recent = revenueTrend.slice(-Math.min(14, revenueTrend.length));
  const n = recent.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = Number(recent[i].net_revenue || 0);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX) - (sumX * sumX);
  const slope = denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (slope * sumX)) / Math.max(n, 1);

  // Residual error drives confidence.
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const y = Number(recent[i].net_revenue || 0);
    const yHat = intercept + (slope * i);
    residual += Math.abs(y - yHat);
  }
  const meanY = sumY / Math.max(n, 1);
  const errorRatio = meanY > 0 ? (residual / Math.max(n, 1)) / meanY : 0;
  const confidence = errorRatio < 0.2 ? 'high' : errorRatio < 0.5 ? 'medium' : 'low';

  const forecast = [];
  for (let i = 1; i <= days; i++) {
    const projected = Math.max(0, intercept + (slope * (n - 1 + i)));
    forecast.push({
      day_ahead: i,
      forecasted_revenue: parseFloat(projected.toFixed(2)),
      confidence
    });
  }

  return forecast;
}

module.exports = exports;
