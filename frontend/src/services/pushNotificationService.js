/**
 * Push Notification Service
 * Frontend service for managing push notification subscriptions
 * 
 * Usage:
 * - Call init() on app load to set up service worker and request permissions
 * - Call subscribe() to enable push notifications for the user
 * - Call unsubscribe() to disable push notifications
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

class PushNotificationService {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this.vapidPublicKey = null;
  }

  /**
   * Initialize the Push Notification Service
   * - Register service worker
   * - Request notification permissions
   * - Load VAPID public key
   */
  async init() {
    try {
      // Check if browser supports service workers
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported in this browser');
        return false;
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      console.log('[Push] Service worker registered:', this.registration);

      // Request notification permission if not already granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log('[Push] Notification permission:', permission);
      }

      // Fetch VAPID public key
      try {
        const response = await fetch(`${API_URL}/push-notifications/keys`);
        const data = await response.json();
        this.vapidPublicKey = data.data?.key;
        console.log('[Push] VAPID key loaded');
      } catch (err) {
        console.warn('[Push] Failed to fetch VAPID key:', err);
        // Push notifications may not be available
      }

      // Check current subscription
      if (this.registration?.pushManager) {
        this.subscription = await this.registration.pushManager.getSubscription();
        console.log('[Push] Current subscription:', this.subscription ? 'active' : 'none');
      }

      return true;
    } catch (err) {
      console.error('[Push] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe() {
    try {
      // Check prerequisites
      if (!Notification || Notification.permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      if (!this.registration?.pushManager) {
        throw new Error('Push manager not available');
      }

      if (!this.vapidPublicKey) {
        throw new Error('VAPID key not loaded');
      }

      // Reuse existing browser subscription when available
      if (!this.subscription) {
        this.subscription = await this.registration.pushManager.getSubscription();
      }

      // Create push subscription only when none exists yet
      if (!this.subscription) {
        this.subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
      }

      console.log('[Push] Subscribe successful');

      // Send subscription to server
      const response = await fetch(`${API_URL}/push-notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('qst_token')}`
        },
        body: JSON.stringify(this.subscription)
      });

      if (response.ok) {
        console.log('[Push] Server subscription saved');
        return true;
      } else {
        throw new Error('Failed to save subscription on server');
      }
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      throw err;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe() {
    try {
      if (!this.subscription) {
        throw new Error('No active subscription');
      }

      // Get subscription details before unsubscribing
      const endpoint = this.subscription.endpoint;

      // Notify server
      await fetch(`${API_URL}/push-notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('qst_token')}`
        },
        body: JSON.stringify({ endpoint })
      });

      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe();
      this.subscription = null;

      console.log('[Push] Unsubscribe successful');
      return success;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
      throw err;
    }
  }

  /**
   * Check if user is currently subscribed
   */
  isSubscribed() {
    return this.subscription !== null;
  }

  /**
   * Get current subscription details
   */
  getSubscription() {
    return this.subscription;
  }

  /**
   * Check notification permission status
   */
  getPermissionStatus() {
    return Notification?.permission || 'denied';
  }

  /**
   * Check if push notifications are supported
   */
  isSupported() {
    return (
      'serviceWorker' in navigator &&
      'pushManager' in ServiceWorkerRegistration.prototype &&
      'Notification' in window
    );
  }

  /**
   * Helper: Convert base64 string to Uint8Array
   * Required for VAPID public key conversion
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Request notification permission (if not already granted)
   */
  async requestPermission() {
    try {
      if (!('Notification' in window)) {
        throw new Error('Notifications not supported');
      }

      if (Notification.permission === 'granted') {
        return 'granted';
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission;
      }

      return 'denied';
    } catch (err) {
      console.error('[Push] Permission request failed:', err);
      throw err;
    }
  }
}

// Export as singleton
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
