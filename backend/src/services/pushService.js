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
  try {
    if (!userIds || userIds.length === 0) {
      return { successful: 0, failed: 0, total: 0 };
    }

    // Get active push subscriptions for the target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (subError) throw new Error(subError.message);

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

    for (const sub of subscriptions || []) {
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
        // HTTP 410 Gone means the subscription was deleted on the browser side — deactivate it
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

    // Update campaign stats
    await supabase
      .from('push_notifications')
      .update({
        successful_sends: successful,
        failed_sends: failed,
        total_recipients: subscriptions?.length || 0
      })
      .eq('id', notification.id);

    return { successful, failed, total: subscriptions?.length || 0 };
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
    let query = supabase.from('users').select('id');

    switch (segment) {
      case 'free':
        query = query.eq('subscription_status', 'inactive');
        break;
      case 'paid':
        query = query.in('subscription_status', ['active', 'trial']);
        break;
      case 'student':
      case 'basic':
        query = query.eq('plan_id', (await getBasicPlanId()));
        break;
      case 'pro':
        query = query.eq('plan_id', (await getProPlanId()));
        break;
      case 'all':
      default:
        // All users
        break;
    }

    const { data: users } = await query;
    const userIds = users?.map(u => u.id) || [];

    return await exports.sendToUsers(userIds, notification);
  } catch (err) {
    logger.error('Failed to send notification to segment:', err);
    throw err;
  }
};

/**
 * Helper: Get basic plan ID
 */
async function getBasicPlanId() {
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
