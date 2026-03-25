const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const paystackAPI = require('../config/paystack');

/**
 * Billing Audit Service
 * Tracks all payment transactions, refunds, subscription changes, and generates financial reports
 */

/**
 * Record a payment transaction
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {object} transactionData - {amount, currency, type, status, stripeTransactionId, description}
 */
exports.recordTransaction = async (userId, subscriptionId, transactionData) => {
  try {
    const { data, error } = await supabase
      .from('billing_transactions')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        amount: transactionData.amount,
        currency: transactionData.currency || 'USD',
        type: transactionData.type, // 'payment', 'refund', 'credit', 'adjustment'
        status: transactionData.status || 'completed',
        stripe_transaction_id: transactionData.stripeTransactionId,
        description: transactionData.description,
        metadata: transactionData.metadata || {},
        transaction_date: new Date().toISOString()
      });

    if (error) {
      logger.error('Error recording transaction:', error);
      throw new Error(`Failed to record transaction: ${error.message}`);
    }

    logger.info(`Transaction recorded for user ${userId}:`, transactionData);
    return data[0];
  } catch (err) {
    logger.error('Error in recordTransaction:', err);
    throw err;
  }
};

/**
 * Record a refund and update transaction/subscription status
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {object} refundData - {amount, reason, method, originalTransactionReference}
 */
exports.processRefund = async (userId, subscriptionId, refundData) => {
  try {
    const { amount, reason, method, originalTransactionReference } = refundData;

    // Get original transaction
    const { data: originalTransaction, error: txError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('paystack_reference', originalTransactionReference)
      .single();

    if (txError || !originalTransaction) {
      // If not found in DB, try to verify with Paystack
      try {
        const paystackTx = await paystackAPI.verifyTransaction(originalTransactionReference);
        if (!paystackTx) {
          throw new Error('Transaction not found');
        }
      } catch (err) {
        throw new Error(`Original transaction not found: ${err.message}`);
      }
    }

    // Validate refund amount doesn't exceed original
    if (originalTransaction && amount > originalTransaction.amount) {
      throw new Error('Refund amount exceeds original transaction amount');
    }

    // Process refund based on method
    let paystackRefundId = null;
    if (method === 'paystack' && originalTransactionReference) {
      try {
        const refund = await paystackAPI.createRefund(originalTransactionReference, amount);
        paystackRefundId = refund.reference;
        logger.info(`Paystack refund created: ${refund.reference}`);
      } catch (err) {
        throw new Error(`Paystack refund failed: ${err.message}`);
      }
    }

    // Record refund transaction
    const { data: refundTx, error: refundError } = await supabase
      .from('billing_transactions')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        amount: -Math.abs(amount), // Negative for refunds
        currency: originalTransaction?.currency || 'NGN',
        type: 'refund',
        status: 'completed',
        paystack_reference: paystackRefundId,
        description: `Refund: ${reason}`,
        metadata: {
          original_transaction_reference: originalTransactionReference,
          refund_method: method,
          refund_reason: reason,
          refunded_at: new Date().toISOString()
        },
        transaction_date: new Date().toISOString()
      });

    if (refundError) {
      throw new Error(`Failed to record refund: ${refundError.message}`);
    }

    // If method is 'credit', add to user's account balance
    if (method === 'credit') {
      await exports.addAccountCredit(userId, amount, `Refund: ${reason}`);
    }

    // Update original transaction to link refund
    if (originalTransaction) {
      await supabase
        .from('billing_transactions')
        .update({ related_refund_id: refundTx[0].id })
        .eq('id', originalTransaction.id);
    }

    logger.info(`Refund processed for user ${userId}: ₦${amount}`);
    return refundTx[0];
  } catch (err) {
    logger.error('Error in processRefund:', err);
    throw err;
  }
};

/**
 * Add account credit for a user
 * @param {string} userId - User ID
 * @param {number} amount - Credit amount
 * @param {string} reason - Reason for credit
 */
exports.addAccountCredit = async (userId, amount, reason) => {
  try {
    // Get current balance
    const { data: user, error: readError } = await supabase
      .from('users')
      .select('account_credit')
      .eq('id', userId)
      .single();

    if (readError) throw new Error(`Failed to fetch user: ${readError.message}`);

    const newBalance = (user.account_credit || 0) + amount;

    // Update balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ account_credit: newBalance })
      .eq('id', userId);

    if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`);

    // Record as transaction
    await exports.recordTransaction(userId, null, {
      amount: amount,
      type: 'credit',
      status: 'completed',
      description: reason
    });

    logger.info(`Added $${amount} credit to user ${userId}: ${reason}`);
    return { new_balance: newBalance };
  } catch (err) {
    logger.error('Error in addAccountCredit:', err);
    throw err;
  }
};

/**
 * Get billing transactions for a user
 * @param {string} userId - User ID
 * @param {object} filters - {startDate, endDate, type, status, limit, offset}
 */
exports.getUserTransactions = async (userId, filters = {}) => {
  try {
    let query = supabase
      .from('billing_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });

    if (filters.startDate) {
      query = query.gte('transaction_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error('Error in getUserTransactions:', err);
    throw err;
  }
};

/**
 * Get subscription lifecycle audit - all changes to a subscription
 * @param {string} subscriptionId - Subscription ID
 */
exports.getSubscriptionAudit = async (subscriptionId) => {
  try {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .or(`resource_data->subscription_id.eq.${subscriptionId},resource_type.eq.subscription,resource_id.eq.${subscriptionId}`)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Get all transactions for this subscription
    const { data: transactions, error: txError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('transaction_date', { ascending: false });

    if (txError) throw txError;

    return {
      activities: data || [],
      transactions: transactions || []
    };
  } catch (err) {
    logger.error('Error in getSubscriptionAudit:', err);
    throw err;
  }
};

/**
 * Generate revenue report by subscription plan
 * @param {object} filters - {startDate, endDate, groupBy}
 */
exports.getRevenueReport = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();

    // Get all transactions in date range
    const { data: transactions, error } = await supabase
      .from('billing_transactions')
      .select('*,users(*),user_subscriptions(subscription_plans(name))')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('type', 'payment');

    if (error) throw error;

    // Aggregate by plan
    const byPlan = {};
    let totalRevenue = 0;
    let totalTransactions = 0;

    transactions.forEach((tx) => {
      const planName = tx.user_subscriptions?.[0]?.subscription_plans?.name || 'unknown';
      if (!byPlan[planName]) {
        byPlan[planName] = { revenue: 0, count: 0, transactions: [] };
      }
      byPlan[planName].revenue += tx.amount;
      byPlan[planName].count += 1;
      byPlan[planName].transactions.push(tx);
      totalRevenue += tx.amount;
      totalTransactions += 1;
    });

    // Get refund totals
    const { data: refunds, error: refundError } = await supabase
      .from('billing_transactions')
      .select('*')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('type', 'refund');

    if (refundError) throw refundError;

    let totalRefunds = 0;
    refunds.forEach((tx) => {
      totalRefunds += Math.abs(tx.amount);
    });

    return {
      period: { start: startDate, end: endDate },
      total_revenue: totalRevenue,
      total_refunds: totalRefunds,
      net_revenue: totalRevenue - totalRefunds,
      total_transactions: totalTransactions,
      refund_count: refunds.length,
      refund_rate: totalTransactions > 0 ? (refunds.length / totalTransactions * 100).toFixed(2) : 0,
      by_plan: byPlan,
      daily_breakdown: aggregateDaily(transactions)
    };
  } catch (err) {
    logger.error('Error in getRevenueReport:', err);
    throw err;
  }
};

/**
 * Get churn analysis - users losing subscriptions in period
 * @param {object} filters - {startDate, endDate}
 */
exports.getChurnAnalysis = async (filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();

    // Get all revoked subscriptions
    const { data: revokedSubs, error } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .eq('action_type', 'revoked_subscription')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    if (error) throw error;

    // Get all expired subscriptions
    const { data: expiredSubs, error: expiredError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .lte('subscription_end_date', endDate)
      .gte('subscription_end_date', startDate)
      .is('renewed_at', null);

    if (expiredError) throw expiredError;

    const totalChurned = (revokedSubs?.length || 0) + (expiredSubs?.length || 0);

    return {
      period: { start: startDate, end: endDate },
      revoked_subscriptions: revokedSubs || [],
      expired_subscriptions: expiredSubs || [],
      total_churned: totalChurned,
      revoked_count: revokedSubs?.length || 0,
      expired_count: expiredSubs?.length || 0
    };
  } catch (err) {
    logger.error('Error in getChurnAnalysis:', err);
    throw err;
  }
};

/**
 * Get subscription lifecycle summary
 * @param {string} subscriptionId - Subscription ID
 */
exports.getSubscriptionSummary = async (subscriptionId) => {
  try {
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*,users(*),subscription_plans(*)')
      .eq('id', subscriptionId)
      .single();

    if (error) throw error;

    // Get all transactions for this subscription
    const { data: transactions } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('transaction_date', { ascending: false });

    const totalPaid = transactions?.reduce((sum, tx) => {
      if (tx.type === 'payment') return sum + tx.amount;
      if (tx.type === 'refund') return sum + Math.abs(tx.amount);
      return sum;
    }, 0) || 0;

    const totalRefunded = transactions?.filter(tx => tx.type === 'refund')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0;

    return {
      subscription,
      total_paid: totalPaid,
      total_refunded: totalRefunded,
      net_paid: totalPaid - totalRefunded,
      transaction_count: transactions?.length || 0,
      transactions: transactions || []
    };
  } catch (err) {
    logger.error('Error in getSubscriptionSummary:', err);
    throw err;
  }
};

/**
 * Helper: Aggregate transactions by day
 */
function aggregateDaily(transactions) {
  const daily = {};
  transactions.forEach((tx) => {
    const date = tx.transaction_date.split('T')[0];
    if (!daily[date]) daily[date] = { revenue: 0, count: 0 };
    daily[date].revenue += tx.amount;
    daily[date].count += 1;
  });
  return daily;
}
