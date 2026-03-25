/**
 * User Actions Controller
 * Admin endpoints for user account management and actions
 */

const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { logAdminActivity } = require('../middlewares/adminMiddleware');
const emailService = require('../services/emailService');
const billingAuditService = require('../services/billingAuditService');

/**
 * ─── USER ACCOUNT ACTIONS ───
 */

/**
 * Suspend user account
 */
exports.suspendUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Update user status
    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({
        subscription_status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Send notification email
    try {
      await emailService.sendAccountSuspended(user, reason);
    } catch (err) {
      logger.warn('Failed to send suspension email:', err);
    }

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'suspended_user',
      'user',
      userId,
      { reason, email: user.email },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('User suspended', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Unsuspend user account
 */
exports.unsuspendUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Restore to active status
    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Send notification email
    try {
      await emailService.sendAccountRestored(user);
    } catch (err) {
      logger.warn('Failed to send restoration email:', err);
    }

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'unsuspended_user',
      'user',
      userId,
      { email: user.email },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('User unsuspended', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Verify user account
 */
exports.verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('id', userId)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    await logAdminActivity(
      req.adminUser.id,
      'verified_user',
      'user',
      userId,
      { email: user.email },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('User verified', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * ─── SUBSCRIPTION MANAGEMENT ───
 */

/**
 * Override user subscription (change plan)
 */
exports.overrideSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { planId, billingCycle = 'monthly', expiresAt, reason } = req.body;

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json(error('Plan not found'));
    }

    // Get current user subscription info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, plan_id, subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Calculate expiry date
    const expiryDate = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Update subscription
    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({
        plan_id: planId,
        subscription_status: 'active',
        billing_cycle: billingCycle,
        subscription_expires_at: expiryDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*, subscription_plans(*)')
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'override_subscription',
      'subscription',
      userId,
      { newPlan: plan.name, billingCycle, expiresAt: expiryDate, reason },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Subscription overridden', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Extend user subscription
 */
exports.extendSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { days = 30, reason } = req.body;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Calculate new expiry
    const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + parseInt(days));

    // Update subscription
    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({
        subscription_expires_at: currentExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*, subscription_plans(*)')
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'extend_subscription',
      'subscription',
      userId,
      { days, newExpiryDate: currentExpiry.toISOString(), reason },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Subscription extended', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * Revoke subscription (downgrade to free)
 */
exports.revokeSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Get free plan
    const { data: freePlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'free')
      .single();

    if (planError || !freePlan) {
      return res.status(500).json(error('Free plan not found'));
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Downgrade to free plan
    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update({
        plan_id: freePlan.id,
        subscription_status: 'inactive',
        subscription_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*, subscription_plans(*)')
      .single();

    if (dbError) throw new Error(dbError.message);

    // Log activity
    await logAdminActivity(
      req.adminUser.id,
      'revoke_subscription',
      'subscription',
      userId,
      { reason, email: user.email },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Subscription revoked', { user: updated }));
  } catch (err) {
    next(err);
  }
};

/**
 * ─── REFUND & CREDIT MANAGEMENT ───
 */

/**
 * Create account credit/refund
 */
exports.issueCredit = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json(error('Amount must be greater than 0'));
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, account_credit')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(error('User not found'));
    }

    // Add account credit via billing audit service
    const creditResult = await billingAuditService.addAccountCredit(
      userId,
      amount,
      reason || `Manual credit: ${notes || 'Admin issued'}`
    );

    // Send notification email
    try {
      await emailService.sendCreditIssued(user, {
        amount,
        reason,
        newBalance: creditResult.new_balance
      });
    } catch (emailErr) {
      logger.warn('Failed to send credit notification email:', emailErr);
    }

    // Log admin activity
    await logAdminActivity(
      req.adminUser.id,
      'issued_credit',
      'user',
      userId,
      { amount, reason, notes, previousBalance: user.account_credit, newBalance: creditResult.new_balance },
      req
    );

    return res.json(success('Credit issued successfully', {
      userId,
      amount,
      reason,
      newBalance: creditResult.new_balance,
      issuedAt: new Date().toISOString()
    }));
  } catch (err) {
    logger.error('Error issuing credit:', err);
    next(err);
  }
};

/**
 * Process refund for user
 */
exports.processRefund = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { amount, reason, method } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json(error('Amount must be greater than 0'));
    }

    if (!method) {
      return res.status(400).json(error('Refund method required: original_payment, credit, or paystack'));
    }

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (subError || !subscription) {
      return res.status(404).json(error('Subscription not found'));
    }

    // Get the original payment transaction
    const { data: originalTx, error: txError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .eq('type', 'payment')
      .order('transaction_date', { ascending: false })
      .limit(1)
      .single();

    if (!originalTx) {
      return res.status(404).json(error('No payment transaction found for this subscription'));
    }

    // Process refund via billing audit service
    const refundTx = await billingAuditService.processRefund(
      subscription.user_id,
      subscriptionId,
      {
        amount,
        reason,
        method,
        originalTransactionReference: originalTx.paystack_reference
      }
    );

    // Send notification email
    try {
      const { data: user } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', subscription.user_id)
        .single();

      if (user) {
        await emailService.sendRefundNotification(user, {
          amount,
          reason,
          method
        });
      }
    } catch (emailErr) {
      logger.warn('Failed to send refund notification email:', emailErr);
    }

    // Log admin activity
    await logAdminActivity(
      req.adminUser.id,
      'processed_refund',
      'subscription',
      subscriptionId,
      { amount, reason, method, transactionId: refundTx.id },
      req
    );

    return res.json(success('Refund processed successfully', {
      refund: refundTx,
      subscriptionId,
      userId: subscription.user_id
    }));
  } catch (err) {
    logger.error('Error processing refund:', err);
    next(err);
  }
};

module.exports = exports;
