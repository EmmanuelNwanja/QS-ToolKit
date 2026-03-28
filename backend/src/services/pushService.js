const webpush = require('web-push');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Web Push Notifications Service
 * Handles subscription management and push delivery
 */

// VAPID public/private keys (should be in env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:support@qs.solnuv.com';

// Configure web-push with VAPID keys when both are available
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

/**
 * Save or update push subscription for a user
 */
exports.subscribeUser = async (userId, subscription) => {
  try {
    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      return await supabase
        .from('push_subscriptions')
        .update({
          auth_key: subscription.keys.auth,
          p256dh_key: subscription.keys.p256dh,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create new subscription
      return await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint: subscription.endpoint,
          auth_key: subscription.keys.auth,
          p256dh_key: subscription.keys.p256dh,
          is_active: true
        })
        .select()
        .single();
    }
  } catch (err) {
    logger.error('Failed to subscribe user:', err);
    throw err;
  }
};

/**
 * Unsubscribe user from push notifications
 */
exports.unsubscribeUser = async (userId, endpoint) => {
  try {
    return await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  } catch (err) {
    logger.error('Failed to unsubscribe user:', err);
    throw err;
  }
};

/**
 * Get VAPID public key for client
 */
exports.getVapidPublicKey = () => {
  return vapidPublicKey;
};

/**
 * Send notification to specific users via web-push
 */
exports.sendToUsers = async (userIds, notification) => {
  if (!userIds || userIds.length === 0) {
    return { successful: 0, failed: 0, total: 0 };
  }

  try {
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (subError) throw new Error(subError.message);
    const result = await exports.sendToSubscriptions(subscriptions || [], notification);
    // Write stats for callers that use sendToUsers directly
    await supabase
      .from('push_notifications')
      .update({
        successful_sends: result.successful,
        failed_sends: result.failed,
        total_recipients: (subscriptions || []).length
      })
      .eq('id', notification.id);
    return result;
  } catch (err) {
    logger.error('Failed to send notifications to users:', err);
    throw err;
  }
};

/**
 * Send notification to plan segment
 */
exports.sendToSegment = async (segment, notification) => {
  try {
    // Build a targeted user-ID list for non-'all' segments
    let targetUserIds = null; // null = everyone with an active subscription

    if (segment !== 'all') {
      let usersQuery = supabase
        .from('users')
        .select('id')
        .not('account_status', 'eq', 'deleted')
        .not('account_status', 'eq', 'hibernated');

      switch (segment) {
        case 'free':
          usersQuery = usersQuery.eq('subscription_status', 'inactive');
          break;
        case 'paid':
          usersQuery = usersQuery.in('subscription_status', ['active', 'trial']);
          break;
        case 'student':
        case 'basic': {
          const { data: plans } = await supabase
            .from('subscription_plans')
            .select('id')
            .in('name', ['basic', 'student']);
          const planIds = (plans || []).map(p => p.id);
          if (planIds.length) usersQuery = usersQuery.in('plan_id', planIds);
          break;
        }
        case 'pro': {
          const proId = await getProPlanId();
          if (proId) usersQuery = usersQuery.eq('plan_id', proId);
          break;
        }
        case 'enterprise': {
          const { data: plans } = await supabase
            .from('subscription_plans')
            .select('id')
            .ilike('name', 'enterprise%');
          const planIds = (plans || []).map(p => p.id);
          if (planIds.length) usersQuery = usersQuery.in('plan_id', planIds);
          break;
        }
        default:
          break;
      }

      const { data: users, error: usersErr } = await usersQuery;
      if (usersErr) throw new Error(`Segment query failed: ${usersErr.message}`);
      targetUserIds = (users || []).map(u => u.id);

      if (targetUserIds.length === 0) {
        logger.info(`sendToSegment(${segment}): no eligible users found`);
        return { successful: 0, failed: 0, total: 0 };
      }
    }

    // Paginate push_subscriptions in batches of 500 to avoid Supabase's 1000-row default cap
    const PAGE_SIZE = 500;
    let page = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalProcessed = 0;

    while (true) {
      let subQuery = supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, auth_key, p256dh_key')
        .eq('is_active', true)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (targetUserIds !== null) {
        subQuery = subQuery.in('user_id', targetUserIds);
      }

      const { data: subs, error: subErr } = await subQuery;
      if (subErr) throw new Error(`Subscription query failed: ${subErr.message}`);
      if (!subs || subs.length === 0) break;

      const result = await exports.sendToSubscriptions(subs, notification);
      totalSuccessful += result.successful;
      totalFailed += result.failed;
      totalProcessed += subs.length;

      if (subs.length < PAGE_SIZE) break; // last page
      page++;
    }

    // Write final cumulative stats after all pages complete
    await supabase
      .from('push_notifications')
      .update({
        successful_sends: totalSuccessful,
        failed_sends: totalFailed,
        total_recipients: totalProcessed
      })
      .eq('id', notification.id);

    logger.info(`sendToSegment(${segment}): processed ${totalProcessed} — ${totalSuccessful} ok, ${totalFailed} failed`);
    return { successful: totalSuccessful, failed: totalFailed, total: totalProcessed };
  } catch (err) {
    logger.error('Failed to send notification to segment:', err);
    throw err;
  }
};

/**
 * Helper: Get basic plan ID
 */
async function getBasicPlanId() {
  // Kept for legacy callers; prefer querying both 'basic' and 'student' together
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'basic')
    .single();
  return plan?.id;
}

/**
 * Helper: Get pro plan ID
 */
async function getProPlanId() {
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'pro')
    .single();
  return plan?.id;
}

/**
 * Schedule notification for later delivery
 */
/**
 * Send push payloads to a list of subscription rows.
 * Shared by both sendToUsers (legacy) and sendToSegment (paginated).
 */
exports.sendToSubscriptions = async (subscriptions, notification) => {
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      actionUrl: notification.action_url || '/',
      notificationId: notification.id
    }
  });

  let successful = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { auth: sub.auth_key, p256dh: sub.p256dh_key }
    };

    try {
      if (vapidPublicKey && vapidPrivateKey) {
        await webpush.sendNotification(pushSubscription, payload);
      }

      await supabase.from('notification_deliveries').insert({
        notification_id: notification.id,
        user_id: sub.user_id,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      successful++;
    } catch (err) {
      // HTTP 410 Gone — subscription expired on the browser side; deactivate it
      if (err.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
      }

      await supabase.from('notification_deliveries').insert({
        notification_id: notification.id,
        user_id: sub.user_id,
        status: 'failed',
        error_message: err.message?.substring(0, 255)
      });

      failed++;
      logger.error(`Push delivery failed for user ${sub.user_id}:`, err.message);
    }
  }

  return { successful, failed };
};

exports.scheduleNotification = async (notificationId) => {
  try {
    // In production, use a job queue (Bull, Agenda, etc.)
    // For now, this is just a placeholder
    logger.info(`Scheduled notification ${notificationId} for delivery`);
  } catch (err) {
    logger.error('Failed to schedule notification:', err);
    throw err;
  }
};

module.exports = exports;
