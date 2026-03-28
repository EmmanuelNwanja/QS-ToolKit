const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  adminAuth,
  requirePermission,
  trackAdminActivity
} = require('../middlewares/adminMiddleware');
const pushController = require('../controllers/pushController');

// ── PUBLIC ROUTES (no auth required) ───────────────────────────
/**
 * Get VAPID public key (client needs this for service worker)
 */
router.get('/keys', pushController.getVapidKey);

// ── AUTHENTICATED USER ROUTES ──────────────────────────────────
router.use(authMiddleware.protect);

/**
 * Subscribe user to push notifications
 */
router.post('/subscribe', pushController.subscribe);

/**
 * Unsubscribe user from push notifications
 */
router.post('/unsubscribe', pushController.unsubscribe);

/**
 * Get user's notification inbox
 */
router.get('/inbox', pushController.getUserNotifications);

/**
 * Mark a push delivery as read
 */
router.patch('/inbox/:deliveryId/read', pushController.markDeliveryRead);

/**
 * Get user's in-app activity notifications
 */
router.get('/activity', pushController.getUserActivityNotifications);

/**
 * Mark an in-app activity notification as read
 */
router.patch('/activity/:notificationId/read', pushController.markActivityRead);

/**
 * Check if user is subscribed
 */
router.get('/subscription-status', pushController.getSubscriptionStatus);

// ── ADMIN ROUTES ───────────────────────────────────────────────
router.post(
  '/admin/send',
  adminAuth,
  requirePermission('send_notifications'),
  trackAdminActivity('sent_notification', 'push_notification'),
  pushController.sendNotification
);

router.get(
  '/admin/:notificationId',
  adminAuth,
  requirePermission('send_notifications'),
  pushController.getNotificationDetail
);

router.post(
  '/admin/:notificationId/cancel',
  adminAuth,
  requirePermission('send_notifications'),
  trackAdminActivity('cancelled_notification', 'push_notification'),
  pushController.cancelNotification
);

module.exports = router;
