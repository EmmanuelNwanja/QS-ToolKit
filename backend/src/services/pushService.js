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
    await ensureDeliveryRows(notification.id, userIds);

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
        total_recipients: userIds.length
      })
      .eq('id', notification.id);
    return { ...result, total: userIds.length };
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
    // Paginate users so all targeted recipients get inbox rows, even without active push subscriptions
    const PAGE_SIZE = 500;
    let page = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalRecipients = 0;

    const enterprisePlanIds = segment === 'enterprise'
      ? await getEnterprisePlanIds()
      : null;
    const basicOrStudentPlanIds = ['student', 'basic'].includes(segment)
      ? await getBasicStudentPlanIds()
      : null;

    let hasMorePages = true;
    while (hasMorePages) {
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
        case 'basic':
          if (basicOrStudentPlanIds.length) {
            usersQuery = usersQuery.in('plan_id', basicOrStudentPlanIds);
          } else {
            usersQuery = usersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
          break;
        case 'pro': {
          const proId = await getProPlanId();
          if (proId) usersQuery = usersQuery.eq('plan_id', proId);
          break;
        }
        case 'enterprise':
          if (enterprisePlanIds.length) {
            usersQuery = usersQuery.in('plan_id', enterprisePlanIds);
          } else {
            usersQuery = usersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
          break;
        case 'all':
        default:
          break;
      }

      const { data: users, error: usersErr } = await usersQuery.range(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1
      );
      if (usersErr) throw new Error(`Segment query failed: ${usersErr.message}`);
      if (!users || users.length === 0) {
        hasMorePages = false;
        break;
      }

      const userIds = users.map((u) => u.id);
      totalRecipients += userIds.length;

      // Make inbox durable: everyone targeted gets a pending delivery row.
      await ensureDeliveryRows(notification.id, userIds);

      const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, auth_key, p256dh_key')
        .eq('is_active', true)
        .in('user_id', userIds);

      if (subErr) throw new Error(`Subscription query failed: ${subErr.message}`);

      if (subs && subs.length > 0) {
        const result = await exports.sendToSubscriptions(subs, notification);
        totalSuccessful += result.successful;
        totalFailed += result.failed;
      }

      if (users.length < PAGE_SIZE) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    if (totalRecipients === 0) {
      logger.info(`sendToSegment(${segment}): no eligible users found`);
      return { successful: 0, failed: 0, total: 0 };
    }

    // Write final cumulative stats after all pages complete
    await supabase
      .from('push_notifications')
      .update({
        successful_sends: totalSuccessful,
        failed_sends: totalFailed,
        total_recipients: totalRecipients
      })
      .eq('id', notification.id);

    logger.info(`sendToSegment(${segment}): targeted ${totalRecipients} users — ${totalSuccessful} sent, ${totalFailed} failed`);
    return { successful: totalSuccessful, failed: totalFailed, total: totalRecipients };
  } catch (err) {
    logger.error('Failed to send notification to segment:', err);
    throw err;
  }
};

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

async function getBasicStudentPlanIds() {
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id')
    .in('name', ['basic', 'student']);
  return (plans || []).map((p) => p.id);
}

async function getEnterprisePlanIds() {
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id')
    .ilike('name', 'enterprise%');
  return (plans || []).map((p) => p.id);
}

async function ensureDeliveryRows(notificationId, userIds) {
  if (!userIds || userIds.length === 0) return;

  const { data: existingRows, error: existingErr } = await supabase
    .from('notification_deliveries')
    .select('user_id')
    .eq('notification_id', notificationId)
    .in('user_id', userIds);

  if (existingErr) throw new Error(`Delivery preload check failed: ${existingErr.message}`);

  const existing = new Set((existingRows || []).map((r) => r.user_id));
  const missing = userIds.filter((id) => !existing.has(id));
  if (missing.length === 0) return;

  const { error: insertErr } = await supabase
    .from('notification_deliveries')
    .insert(missing.map((user_id) => ({
      notification_id: notificationId,
      user_id,
      status: 'pending'
    })));

  if (insertErr) throw new Error(`Delivery preload insert failed: ${insertErr.message}`);
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

  const groupedByUser = new Map();
  for (const sub of subscriptions) {
    if (!groupedByUser.has(sub.user_id)) groupedByUser.set(sub.user_id, []);
    groupedByUser.get(sub.user_id).push(sub);
  }

  for (const [userId, userSubs] of groupedByUser.entries()) {
    let userSent = false;
    let lastError = null;

    for (const sub of userSubs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { auth: sub.auth_key, p256dh: sub.p256dh_key }
      };

      try {
        if (!vapidPublicKey || !vapidPrivateKey) {
          throw new Error('Push notifications not configured on server (missing VAPID keys)');
        }

        await webpush.sendNotification(pushSubscription, payload);
        userSent = true;
      } catch (err) {
        lastError = err;
        if (err.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id);
        }
        logger.error(`Push delivery failed for user ${userId}:`, err.message);
      }
    }

    if (userSent) {
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('notification_id', notification.id)
        .eq('user_id', userId);
      successful++;
    } else {
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: lastError?.message?.substring(0, 255) || 'Delivery failed'
        })
        .eq('notification_id', notification.id)
        .eq('user_id', userId)
        .neq('status', 'sent');
      failed++;
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
