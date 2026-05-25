/**
 * Subscription Management Service
 * Handles subscription lifecycle: activation, renewal, expiry, downgrade, audit
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const PLAN_LIMITS = {
  free: { projects: 5, calculators: 6, users: 1 },
  basic: { projects: 25, calculators: 54, users: 1 },
  pro: { projects: 100, calculators: 999, users: 5 },
  enterprise: { projects: 999, calculators: 9999, users: 50 },
};

const PLAN_PRICES = {
  free: { monthly: 0, annual: 0 },
  basic: { monthly: 5000, annual: 50000 },
  pro: { monthly: 15000, annual: 150000 },
  enterprise: { monthly: 50000, annual: 500000 },
};

/**
 * Resolve subscription plan ID from plan name
 */
async function resolvePlanId(planName) {
  const name = String(planName || '').toLowerCase();
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name')
    .in('name', name === 'student' ? ['basic', 'student'] : [name])
    .eq('is_active', true);
  if (!plans || plans.length === 0) return null;
  return plans.find(p => p.name === name) || plans.find(p => p.name === 'basic') || plans[0];
}

/**
 * Activate subscription after admin approval
 * Syncs both user_subscriptions and users tables for consistency
 * @param {string} userId - User ID
 * @param {string} planName - Plan name ('basic', 'pro', 'enterprise')
 * @param {string} billingInterval - 'monthly' or 'annual'
 * @param {object} paymentData - {paymentId, amountNgn, reference, triggeredBy}
 * @returns {Promise<object>} - Subscription record and audit entry
 */
exports.activateSubscription = async (userId, planName, billingInterval, paymentData = {}) => {
  try {
    const now = new Date();
    const expiresAt = new Date(now);

    if (billingInterval === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const graceUntil = new Date(expiresAt);
    graceUntil.setDate(graceUntil.getDate() + 7);

    const { data: currentSub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .maybeSingle();

    const oldPlanName = currentSub?.plan_name || 'free';

    // Upsert user_subscriptions
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_name: planName,
        billing_interval: billingInterval,
        subscription_status: 'active',
        subscription_started_at: now.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        grace_period_until: graceUntil.toISOString(),
        reminder_sent_7d: false,
        reminder_sent_3d: false,
        reminder_sent_1d: false,
        auto_renew: false,
        last_payment_id: paymentData.paymentId || null,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select('*')
      .single();

    if (subError) {
      logger.error('Error activating subscription', { userId, error: subError.message });
      throw subError;
    }

    // Sync legacy users table
    const planRow = await resolvePlanId(planName);
    if (planRow) {
      await supabase.from('users').update({
        plan_id: planRow.id,
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
        billing_cycle: billingInterval,
        updated_at: now.toISOString(),
      }).eq('id', userId);
    }

    await exports.logSubscriptionChange(userId, {
      action: 'subscription_activated',
      planFrom: oldPlanName,
      planTo: planName,
      details: {
        billingInterval,
        expiresAt: expiresAt.toISOString(),
        paymentReference: paymentData.reference || null,
        triggeredBy: paymentData.triggeredBy || 'user',
      },
      triggeredBy: paymentData.triggeredBy || null,
    });

    logger.info(`Subscription activated for user ${userId}`, {
      planName,
      billingInterval,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      subscription,
      expiresAt: expiresAt.toISOString(),
      graceUntil: graceUntil.toISOString(),
    };
  } catch (err) {
    logger.error('activateSubscription error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get active subscription for user
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} - Subscription or null
 */
exports.getActiveSubscription = async (userId) => {
  try {
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .maybeSingle();

    if (error) throw error;
    return subscription || null;
  } catch (err) {
    logger.error('getActiveSubscription error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Check if subscription has expired
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - True if expired
 */
exports.isSubscriptionExpired = async (userId) => {
  try {
    const subscription = await exports.getActiveSubscription(userId);
    if (!subscription) return true;

    const now = new Date();
    const expiresAt = new Date(subscription.subscription_expires_at);

    return now > expiresAt;
  } catch (err) {
    logger.error('isSubscriptionExpired error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Downgrade user to free tier
 * Syncs both user_subscriptions and users tables
 * @param {string} userId - User ID
 * @param {string} reason - Reason for downgrade
 * @returns {Promise<object>} - Updated subscription
 */
exports.downgradeToFreeTier = async (userId, reason = 'subscription_expired') => {
  try {
    const now = new Date();

    const { data: currentSub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .maybeSingle();

    if (!currentSub) {
      logger.warn('No active subscription to downgrade', { userId });
      return null;
    }

    const oldPlanName = currentSub.plan_name;

    // Mark existing active subscription as expired
    await supabase
      .from('user_subscriptions')
      .update({ subscription_status: 'expired', updated_at: now.toISOString() })
      .eq('user_id', userId)
      .eq('subscription_status', 'active');

    // Insert or update free subscription
    const { data: freeSub, error: downgradeError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_name: 'free',
        billing_interval: 'monthly',
        subscription_status: 'active',
        subscription_started_at: now.toISOString(),
        subscription_expires_at: null,
        grace_period_until: null,
        reminder_sent_7d: false,
        reminder_sent_3d: false,
        reminder_sent_1d: false,
        auto_renew: false,
      })
      .select('*')
      .single();

    if (downgradeError) {
      if (downgradeError.code === '23505') {
        const { data: updated, error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan_name: 'free',
            subscription_status: 'active',
            subscription_expires_at: null,
            reminder_sent_7d: false,
            reminder_sent_3d: false,
            reminder_sent_1d: false,
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId)
          .eq('plan_name', 'free')
          .select('*')
          .single();

        if (updateError) throw updateError;
        return updated;
      }
      throw downgradeError;
    }

    // Sync legacy users table - set to free plan
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'free')
      .single();

    if (freePlan) {
      await supabase.from('users').update({
        plan_id: freePlan.id,
        subscription_status: 'inactive',
        subscription_expires_at: null,
        billing_cycle: 'monthly',
        updated_at: now.toISOString(),
      }).eq('id', userId);
    }

    await exports.logSubscriptionChange(userId, {
      action: 'downgrade_to_free',
      planFrom: oldPlanName,
      planTo: 'free',
      details: { reason },
    });

    logger.info(`User ${userId} downgraded to free tier`, { reason, fromPlan: oldPlanName });

    return freeSub;
  } catch (err) {
    logger.error('downgradeToFreeTier error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Send subscription expiry reminder
 * @param {string} userId - User ID
 * @param {string} daysUntil - '7', '3', or '1'
 * @returns {Promise<boolean>} - True if reminder sent and marked
 */
exports.sendExpiryReminder = async (userId, daysUntil) => {
  try {
    const subscription = await exports.getActiveSubscription(userId);
    if (!subscription) {
      logger.warn('No active subscription to remind', { userId });
      return false;
    }

    const reminderField = `reminder_sent_${daysUntil}d`;
    const { data: updated, error } = await supabase
      .from('user_subscriptions')
      .update({ [reminderField]: true })
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .select('*')
      .single();

    if (error) {
      logger.error(`Error marking ${daysUntil}d reminder`, { userId, error: error.message });
      throw error;
    }

    // Record audit entry
    await exports.logSubscriptionChange(userId, {
      action: 'reminder_sent',
      details: { daysUntil },
    });

    logger.info(`${daysUntil}d reminder sent for user ${userId}`);
    return true;
  } catch (err) {
    logger.error('sendExpiryReminder error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get users with subscriptions expiring soon
 * @param {number} daysUntil - Days until expiry (e.g., 7, 3, 1)
 * @param {boolean} excludeReminded - Exclude already reminded users
 * @returns {Promise<array>} - Array of subscriptions
 */
exports.getExpiringSubscriptions = async (daysUntil, excludeReminded = true) => {
  try {
    const now = new Date();
    const expiresAfter = new Date(now.getTime() + (daysUntil - 1) * 24 * 3600 * 1000);
    const expiresBefore = new Date(now.getTime() + (daysUntil + 1) * 24 * 3600 * 1000);

    let query = supabase
      .from('user_subscriptions')
      .select('*, users:users!user_subscriptions_user_id_fkey(id, email, name)')
      .eq('subscription_status', 'active')
      .gt('subscription_expires_at', expiresAfter.toISOString())
      .lt('subscription_expires_at', expiresBefore.toISOString());

    if (excludeReminded) {
      const reminderField = `reminder_sent_${daysUntil}d`;
      query = query.eq(reminderField, false);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;
    return subscriptions || [];
  } catch (err) {
    logger.error('getExpiringSubscriptions error', { daysUntil, error: err.message });
    throw err;
  }
};

/**
 * Log subscription change to audit trail
 * @param {string} userId - User ID
 * @param {object} auditData - {action, planFrom, planTo, details, triggeredBy}
 * @returns {Promise<void>}
 */
exports.logSubscriptionChange = async (userId, auditData) => {
  try {
    const { action, planFrom, planTo, details, triggeredBy } = auditData;

    const { error } = await supabase.from('subscription_audit_log').insert({
      user_id: userId,
      action,
      plan_from: planFrom || null,
      plan_to: planTo || null,
      triggered_by: triggeredBy || null,
      details: details || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.warn('Error logging subscription change', {
        userId,
        action,
        error: error.message,
      });
    }
  } catch (err) {
    logger.error('logSubscriptionChange error', { userId, error: err.message });
  }
};

/**
 * Get subscription audit trail for a user
 * @param {string} userId - User ID
 * @param {number} limit - Max records to return
 * @returns {Promise<array>} - Array of audit entries
 */
exports.getSubscriptionAudit = async (userId, limit = 50) => {
  try {
    const { data: auditLog, error } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return auditLog || [];
  } catch (err) {
    logger.error('getSubscriptionAudit error', { userId, error: err.message });
    throw err;
  }
};

module.exports = exports;
