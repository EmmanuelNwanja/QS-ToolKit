const billingAuditService = require('../services/billingAuditService');
const logger = require('../utils/logger');
const { logAdminActivity } = require('../middlewares/authMiddleware');

/**
 * Get transaction history for a user
 */
exports.getUserTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type, status, limit, offset } = req.query;

    const transactions = await billingAuditService.getUserTransactions(userId, {
      startDate,
      endDate,
      type,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_user_transactions', 'billing', userId, {
      startDate,
      endDate,
      type,
      status
    }, req);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (err) {
    logger.error('Error fetching user transactions:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch transactions'
    });
  }
};

/**
 * Get subscription audit trail
 */
exports.getSubscriptionAudit = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;

    const audit = await billingAuditService.getSubscriptionAudit(subscriptionId);

    await logAdminActivity(req.adminUser?.id, 'viewed_subscription_audit', 'subscription', subscriptionId, {}, req);

    res.json({
      success: true,
      data: audit
    });
  } catch (err) {
    logger.error('Error fetching subscription audit:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch subscription audit'
    });
  }
};

/**
 * Get subscription summary with transaction history
 */
exports.getSubscriptionSummary = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;

    const summary = await billingAuditService.getSubscriptionSummary(subscriptionId);

    await logAdminActivity(req.adminUser?.id, 'viewed_subscription_summary', 'subscription', subscriptionId, {}, req);

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    logger.error('Error fetching subscription summary:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch subscription summary'
    });
  }
};

/**
 * Get revenue report by plan
 */
exports.getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const report = await billingAuditService.getRevenueReport({
      startDate,
      endDate
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_revenue_report', 'billing', 'all', {
      startDate,
      endDate
    }, req);

    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    logger.error('Error generating revenue report:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate revenue report'
    });
  }
};

/**
 * Get churn analysis
 */
exports.getChurnAnalysis = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const analysis = await billingAuditService.getChurnAnalysis({
      startDate,
      endDate
    });

    await logAdminActivity(req.adminUser?.id, 'viewed_churn_analysis', 'billing', 'all', {
      startDate,
      endDate
    }, req);

    res.json({
      success: true,
      data: analysis
    });
  } catch (err) {
    logger.error('Error generating churn analysis:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate churn analysis'
    });
  }
};

/**
 * Record a manual transaction (adjustments, refunds, credits)
 */
exports.recordTransaction = async (req, res, next) => {
  try {
    const { userId, subscriptionId } = req.params;
    const { amount, type, reason } = req.body;

    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, type'
      });
    }

    const transaction = await billingAuditService.recordTransaction(userId, subscriptionId, {
      amount: parseFloat(amount),
      type,
      status: 'completed',
      description: reason || `Manual ${type} adjustment`
    });

    await logAdminActivity(req.adminUser?.id, 'recorded_transaction', 'billing', subscriptionId, {
      amount,
      type,
      reason
    }, req);

    res.json({
      success: true,
      data: transaction,
      message: `${type} recorded successfully`
    });
  } catch (err) {
    logger.error('Error recording transaction:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to record transaction'
    });
  }
};

/**
 * Export transaction data (CSV)
 */
exports.exportTransactions = async (req, res, next) => {
  try {
    const { startDate, endDate, userId } = req.query;

    let query = 'SELECT * FROM billing_transactions WHERE 1=1';
    const params = [];

    if (startDate) {
      query += ` AND transaction_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND transaction_date <= $${params.length + 1}`;
      params.push(endDate);
    }
    if (userId) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(userId);
    }

    query += ' ORDER BY transaction_date DESC';

    // Execute raw query via Supabase RPC or fetch
    const { data, error } = await require('../config/supabase')
      .from('billing_transactions')
      .select('*')
      .gte('transaction_date', startDate || new Date(0).toISOString())
      .lte('transaction_date', endDate || new Date().toISOString());

    if (error) throw error;

    if (userId) {
      const filtered = data.filter(tx => tx.user_id === userId);
      data.length = 0;
      data.push(...filtered);
    }

    // Convert to CSV
    const csv = convertToCSV(data);

    await logAdminActivity(req.adminUser?.id, 'exported_transactions', 'billing', 'all', {
      startDate,
      endDate,
      userId,
      count: data.length
    }, req);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('Error exporting transactions:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to export transactions'
    });
  }
};

/**
 * Helper: Convert array of objects to CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.map(h => `"${h}"`).join(',');

  const rows = data.map(row => {
    return headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return `"${JSON.stringify(value)}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [csvHeaders, ...rows].join('\n');
}
