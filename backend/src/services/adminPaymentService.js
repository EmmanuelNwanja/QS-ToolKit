/**
 * Admin Payment Service
 * Handles admin review, verification, and rejection of direct bank transfer submissions
 */

const supabase = require('../config/supabase');
const subscriptionManagementService = require('./subscriptionManagementService');
const logger = require('../utils/logger');

/**
 * List pending and processed payment submissions for admin
 * @param {object} filters - {status, page, limit}
 * @returns {Promise<object>} - {submissions, total, page, limit}
 */
exports.listPaymentSubmissions = async (filters = {}) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = filters;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('direct_payment_submissions')
      .select(
        '*, user:users!user_id(id, name, email), reviewed_by_user:users!reviewed_by(id, name, email)',
        { count: 'exact' }
      )
      .order('submitted_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: submissions, error, count } = await query;

    if (error) throw error;

    return {
      submissions: submissions || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
    };
  } catch (err) {
    logger.error('listPaymentSubmissions error', { error: err.message });
    throw err;
  }
};

/**
 * Get detailed payment submission for review
 * @param {string} submissionId - Submission ID
 * @returns {Promise<object>} - Submission with user details
 */
exports.getPaymentSubmissionDetail = async (submissionId) => {
  try {
    const { data: submission, error } = await supabase
      .from('direct_payment_submissions')
      .select(
        '*, user:users!user_id(id, name, email, created_at), reviewed_by_user:users!reviewed_by(id, name, email)'
      )
      .eq('id', submissionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    // Get user's subscription history
    const { data: auditLog } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .eq('user_id', submission.user_id)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      ...submission,
      auditLog: auditLog || [],
    };
  } catch (err) {
    logger.error('getPaymentSubmissionDetail error', { submissionId, error: err.message });
    throw err;
  }
};

/**
 * Verify (approve) a payment submission and activate subscription
 * @param {string} submissionId - Submission ID
 * @param {string} adminUserId - Admin user ID
 * @param {string} adminNote - Optional admin note
 * @returns {Promise<object>} - {submission, subscription}
 */
exports.verifyPaymentSubmission = async (submissionId, adminUserId, adminNote = '') => {
  try {
    // Get submission
    const submission = await exports.getPaymentSubmissionDetail(submissionId);
    if (!submission) {
      throw new Error('Payment submission not found');
    }

    if (submission.status !== 'pending') {
      throw new Error(`Cannot verify submission with status: ${submission.status}`);
    }

    const now = new Date().toISOString();

    // Update submission status to verified
    const { error: updateError } = await supabase
      .from('direct_payment_submissions')
      .update({
        status: 'verified',
        reviewed_by: adminUserId,
        reviewed_at: now,
        admin_note: adminNote || null,
        updated_at: now,
      })
      .eq('id', submissionId);

    if (updateError) throw updateError;

    // Create billing transaction record for audit trail
    const { data: transaction, error: txError } = await supabase
      .from('billing_transactions')
      .insert({
        user_id: submission.user_id,
        amount: submission.amount_ngn,
        currency: 'NGN',
        type: 'payment',
        status: 'completed',
        description: `Direct transfer payment for ${submission.plan_name.toUpperCase()} plan (${submission.billing_interval})`,
        payment_channel: 'direct_transfer',
        bank_reference: submission.reference_note,
        bank_confirmed_at: now,
        admin_upgraded_by: adminUserId,
        metadata: {
          plan_name: submission.plan_name,
          billing_interval: submission.billing_interval,
          receipt_url: submission.receipt_url,
          submission_id: submissionId,
        },
      })
      .select('*')
      .single();

    if (txError) {
      logger.warn('Error creating transaction record', {
        submissionId,
        error: txError.message,
      });
    }

    // Activate subscription
    let subscriptionResult;
    if (submission.plan_name === 'academy_weekly') {
      subscriptionResult = await activateAcademySubscription(
        submission.user_id,
        adminUserId,
        submissionId
      );
    } else if (submission.plan_name === 'exam_prep_weekly') {
      subscriptionResult = await activateExamPrepSubscription(
        submission.user_id,
        adminUserId,
        submissionId
      );
    } else {
      subscriptionResult = await subscriptionManagementService.activateSubscription(
        submission.user_id,
        submission.plan_name,
        submission.billing_interval,
        {
          paymentId: transaction?.id || null,
          reference: `bank-${submissionId}`,
          triggeredBy: adminUserId,
        }
      );
    }

    // Send notification to user
    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      type: 'payment',
      title: `${submission.plan_name.toUpperCase()} Subscription Activated`,
      message: `Your direct bank transfer has been verified and your ${submission.plan_name.toUpperCase()} subscription is now active.`,
      data: {
        source: 'direct_payment_verified',
        submission_id: submissionId,
        plan: submission.plan_name,
        expiresAt: subscriptionResult.expiresAt,
      },
    }).then(() => {
      logger.info(`Verification notification sent to user ${submission.user_id}`);
    }).catch(err => {
      logger.warn('Failed to send verification notification', {
        userId: submission.user_id,
        error: err.message,
      });
    });

    logger.info(`Payment submission verified by admin ${adminUserId}`, {
      submissionId,
      userId: submission.user_id,
      planName: submission.plan_name,
    });

    return {
      submission: {
        id: submissionId,
        status: 'verified',
        verifiedAt: now,
      },
      subscription: subscriptionResult.subscription,
      expiresAt: subscriptionResult.expiresAt,
    };
  } catch (err) {
    logger.error('verifyPaymentSubmission error', { submissionId, error: err.message });
    throw err;
  }
};

/**
 * Reject a payment submission
 * @param {string} submissionId - Submission ID
 * @param {string} adminUserId - Admin user ID
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<object>} - Updated submission
 */
exports.rejectPaymentSubmission = async (submissionId, adminUserId, rejectionReason = '') => {
  try {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('Rejection reason is required');
    }

    // Get submission
    const { data: submission, error: getError } = await supabase
      .from('direct_payment_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (getError) throw getError;
    if (!submission) throw new Error('Submission not found');

    if (submission.status !== 'pending') {
      throw new Error(`Cannot reject submission with status: ${submission.status}`);
    }

    const now = new Date().toISOString();

    // Update submission
    const { data: updated, error: updateError } = await supabase
      .from('direct_payment_submissions')
      .update({
        status: 'rejected',
        reviewed_by: adminUserId,
        reviewed_at: now,
        admin_note: rejectionReason.trim(),
        rejection_reason: rejectionReason.trim(),
        updated_at: now,
      })
      .eq('id', submissionId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Send rejection notification
    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      type: 'payment_failed',
      title: 'Payment Submission Rejected',
      message: `Your payment submission has been reviewed and rejected. Reason: ${rejectionReason.trim()}`,
      data: {
        source: 'direct_payment_rejected',
        submission_id: submissionId,
        reason: rejectionReason.trim(),
      },
    }).then(() => {
      logger.info(`Rejection notification sent to user ${submission.user_id}`);
    }).catch(err => {
      logger.warn('Failed to send rejection notification', {
        userId: submission.user_id,
        error: err.message,
      });
    });

    // Log audit entry
    await subscriptionManagementService.logSubscriptionChange(submission.user_id, {
      action: 'payment_submission_rejected',
      details: {
        submissionId,
        reason: rejectionReason.trim(),
        rejectedBy: adminUserId,
      },
      triggeredBy: adminUserId,
    });

    logger.info(`Payment submission rejected by admin ${adminUserId}`, {
      submissionId,
      userId: submission.user_id,
      reason: rejectionReason.trim(),
    });

    return updated;
  } catch (err) {
    logger.error('rejectPaymentSubmission error', { submissionId, error: err.message });
    throw err;
  }
};

/**
 * Get payment statistics for dashboard
 * @returns {Promise<object>} - Payment stats
 */
exports.getPaymentStats = async () => {
  try {
    const [
      pendingCount,
      verifiedCount,
      rejectedCount,
      totalAmount,
    ] = await Promise.all([
      supabase
        .from('direct_payment_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('direct_payment_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'verified'),
      supabase
        .from('direct_payment_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      supabase
        .from('direct_payment_submissions')
        .select('amount_ngn')
        .eq('status', 'verified'),
    ]);

    const totalRevenue = (totalAmount.data || []).reduce(
      (sum, row) => sum + (Number(row.amount_ngn) || 0),
      0
    );

    return {
      pending: pendingCount.count || 0,
      verified: verifiedCount.count || 0,
      rejected: rejectedCount.count || 0,
      totalRevenueNgn: totalRevenue,
    };
  } catch (err) {
    logger.error('getPaymentStats error', { error: err.message });
    throw err;
  }
};

/**
 * Activate academy subscription (7 days from verification)
 */
async function activateAcademySubscription(userId, adminUserId, submissionId) {
  const now = new Date();

  // Read billing cycle from the payment submission
  let billingCycle = 'weekly';
  if (submissionId) {
    const { data: submission } = await supabase
      .from('direct_payment_submissions')
      .select('billing_interval')
      .eq('id', submissionId)
      .maybeSingle();
    if (submission?.billing_interval) billingCycle = submission.billing_interval;
  }

  const durationMs = { weekly: 7, monthly: 30, annual: 365 }[billingCycle] || 7;
  const expiresAt = new Date(now.getTime() + durationMs * 24 * 60 * 60 * 1000);

  const { data: existing } = await supabase
    .from('academy_subscriptions')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', now.toISOString())
    .maybeSingle();

  let finalExpiresAt = expiresAt;
  if (existing && new Date(existing.expires_at) > now) {
    finalExpiresAt = new Date(new Date(existing.expires_at).getTime() + durationMs * 24 * 60 * 60 * 1000);
  }

  if (existing) {
    await supabase
      .from('academy_subscriptions')
      .update({ expires_at: finalExpiresAt.toISOString(), updated_at: now.toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('academy_subscriptions')
      .insert({
        user_id: userId,
        status: 'active',
        billing_cycle: billingCycle,
        started_at: now.toISOString(),
        expires_at: finalExpiresAt.toISOString(),
        created_at: now.toISOString(),
      });
  }

  await subscriptionManagementService.logSubscriptionChange(userId, {
    action: 'academy_subscription_activated',
    planTo: `academy_${billingCycle}`,
    details: {
      billingInterval: billingCycle,
      expiresAt: finalExpiresAt.toISOString(),
      submissionId,
    },
    triggeredBy: adminUserId,
  });

  return {
    subscription: { plan_name: `academy_${billingCycle}`, status: 'active' },
    expiresAt: finalExpiresAt.toISOString(),
  };
}

/**
 * Activate exam prep subscription (7 days from verification)
 */
async function activateExamPrepSubscription(userId, adminUserId, submissionId) {
  const now = new Date();

  // Read billing cycle from the payment submission
  let billingCycle = 'weekly';
  if (submissionId) {
    const { data: submission } = await supabase
      .from('direct_payment_submissions')
      .select('billing_interval')
      .eq('id', submissionId)
      .maybeSingle();
    if (submission?.billing_interval) billingCycle = submission.billing_interval;
  }

  const durationMs = { weekly: 7, monthly: 30, annual: 365 }[billingCycle] || 7;
  const expiresAt = new Date(now.getTime() + durationMs * 24 * 60 * 60 * 1000);

  const { data: existing } = await supabase
    .from('exam_prep_subscriptions')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', now.toISOString())
    .maybeSingle();

  let finalExpiresAt = expiresAt;
  if (existing && new Date(existing.expires_at) > now) {
    finalExpiresAt = new Date(new Date(existing.expires_at).getTime() + durationMs * 24 * 60 * 60 * 1000);
  }

  if (existing) {
    await supabase
      .from('exam_prep_subscriptions')
      .update({ expires_at: finalExpiresAt.toISOString(), updated_at: now.toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('exam_prep_subscriptions')
      .insert({
        user_id: userId,
        status: 'active',
        billing_cycle: billingCycle,
        started_at: now.toISOString(),
        expires_at: finalExpiresAt.toISOString(),
        created_at: now.toISOString(),
      });
  }

  await subscriptionManagementService.logSubscriptionChange(userId, {
    action: 'exam_prep_subscription_activated',
    planTo: `exam_prep_${billingCycle}`,
    details: {
      billingInterval: billingCycle,
      expiresAt: finalExpiresAt.toISOString(),
      submissionId,
    },
    triggeredBy: adminUserId,
  });

  return {
    subscription: { plan_name: 'exam_prep_weekly', status: 'active' },
    expiresAt: finalExpiresAt.toISOString(),
  };
}

module.exports = exports;
