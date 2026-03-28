const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const pushService = require('../services/pushService');

/**
 * ─── USER PUSH SUBSCRIPTION MANAGEMENT ───
 * Users opt-in to Web Push Notifications
 */

/**
 * Subscribe user to push notifications
 * Endpoint: GET /push-notifications/keys (get VAPID key for client)
 */
exports.getVapidKey = async (req, res, next) => {
  try {
    const key = pushService.getVapidPublicKey();
    if (!key) {
      return res.status(503).json(error('Push notifications not configured'));
    }
    return res.json(success('VAPID key retrieved', { key }));
  } catch (err) {
    next(err);
  }
};

/**
 * Subscribe user to push notifications
 * Endpoint: POST /push-notifications/subscribe
 */
exports.subscribe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;

    // Validate subscription format
    if (!subscription.endpoint || !subscription.keys) {
      return res.status(400).json(error('Invalid subscription format'));
    }

    const { data: pushSub, error: dbError } = await pushService.subscribeUser(userId, subscription);

    if (dbError || !pushSub) {
      throw new Error(dbError?.message || 'Failed to save subscription');
    }

    return res.status(201).json(success('Successfully subscribed to push notifications', {
      subscription: pushSub
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Unsubscribe user from push notifications
 * Endpoint: POST /push-notifications/unsubscribe
 */
exports.unsubscribe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json(error('Endpoint required'));
    }

    await pushService.unsubscribeUser(userId, endpoint);

    return res.json(success('Successfully unsubscribed from push notifications'));
  } catch (err) {
    next(err);
  }
};

/**
 * Get all push notifications (user's inbox)
 * Limited to notifications they received
 * Endpoint: GET /push-notifications/inbox
 */
exports.getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const { data: notifications, count, error: dbError } = await supabase
      .from('notification_deliveries')
      .select(`
        *,
        push_notifications(*)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('User notifications retrieved', {
      notifications,
      pagination: { count, limit, offset }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Check if user is subscribed to push notifications
 * Endpoint: GET /push-notifications/subscription-status
 */
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (dbError) throw new Error(dbError.message);

    return res.json(success('Subscription status retrieved', {
      isSubscribed: (subscriptions?.length || 0) > 0,
      subscriptionCount: subscriptions?.length || 0
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * ─── ADMIN PUSH NOTIFICATION MANAGEMENT ───
 * Moved from adminController for clarity
 */

/**
 * Send push notification (admin only)
 */
exports.sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      imageUrl,
      actionUrl,
      targetSegment = 'all',
      scheduledFor
    } = req.body;

    // Create notification record
    const { data: notification, error: dbError } = await supabase
      .from('push_notifications')
      .insert({
        admin_user_id: req.adminUser?.id,
        title,
        message,
        image_url: imageUrl,
        action_url: actionUrl,
        target_segment: targetSegment,
        scheduled_for: scheduledFor,
        status: scheduledFor ? 'scheduled' : 'sent',
        sent_at: scheduledFor ? null : new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // Send immediately if not scheduled
    if (!scheduledFor) {
      try {
        await pushService.sendToSegment(targetSegment, notification);
      } catch (sendErr) {
        logger.error('Failed to send notification immediately:', sendErr);
        // Don't fail the request, notification was created
      }
    }

    return res.status(201).json(success('Notification created and queued', { notification }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get notification details (admin)
 */
exports.getNotificationDetail = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const { data: notification, error: notifError } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      return res.status(404).json(error('Notification not found'));
    }

    // Get delivery details
    const { data: deliveries, error: deliveryError } = await supabase
      .from('notification_deliveries')
      .select('*, users(email, name)')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: false });

    if (deliveryError) throw new Error(deliveryError.message);

    return res.json(success('Notification details retrieved', {
      notification,
      deliveries,
      stats: {
        total: notification.total_recipients,
        sent: notification.successful_sends,
        failed: notification.failed_sends,
        successRate: notification.total_recipients
          ? ((notification.successful_sends / notification.total_recipients) * 100).toFixed(2)
          : 0
      }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel scheduled notification (admin)
 */
exports.cancelNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    // Verify notification exists and is scheduled
    const { data: notification } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notification) {
      return res.status(404).json(error('Notification not found'));
    }

    if (notification.status !== 'scheduled') {
      return res.status(400).json(error('Can only cancel scheduled notifications'));
    }

    // Cancel notification
    await supabase
      .from('push_notifications')
      .update({ status: 'cancelled' })
      .eq('id', notificationId);

    return res.json(success('Notification cancelled'));
  } catch (err) {
    next(err);
  }
};

// ─── MARK PUSH DELIVERY AS READ ──────────────────────────────

exports.markDeliveryRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deliveryId } = req.params;

    const { error: dbError } = await supabase
      .from('notification_deliveries')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', deliveryId)
      .eq('user_id', userId); // enforce ownership

    if (dbError) throw new Error(dbError.message);
    return res.json(success('Notification marked as read'));
  } catch (err) { next(err); }
};

// ─── IN-APP ACTIVITY NOTIFICATIONS ───────────────────────────

/**
 * Get user's in-app / system notifications (notifications table)
 */
exports.getUserActivityNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;

    const { data: notifications, count, error: dbError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (dbError) throw new Error(dbError.message);
    return res.json(success('Activity notifications retrieved', {
      notifications,
      pagination: { count, limit, offset }
    }));
  } catch (err) { next(err); }
};

/**
 * Mark an in-app activity notification as read
 */
exports.markActivityRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const { error: dbError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId); // enforce ownership

    if (dbError) throw new Error(dbError.message);
    return res.json(success('Notification marked as read'));
  } catch (err) { next(err); }
};
