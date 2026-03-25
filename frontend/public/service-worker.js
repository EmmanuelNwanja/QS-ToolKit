/**
 * Service Worker for Web Push Notifications
 * Located at: public/service-worker.js
 * 
 * This file handles push notification events and user interactions.
 * Register in your main app with: navigator.serviceWorker.register('/service-worker.js')
 */

const CACHE_NAME = 'qstoolkit-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

// ── INSTALLATION ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('[Service Worker] Cache addAll failed:', err);
        // Continue even if caching fails
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATION ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── PUSH NOTIFICATION RECEIPT ──────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);

  if (event.data) {
    try {
      const data = event.data.json();

      const options = {
        body: data.message,
        icon: '/qstoolkit-icon.png',
        badge: '/qstoolkit-badge.png',
        image: data.imageUrl,
        tag: data.tag || 'qstoolkit-notification',
        requireInteraction: data.requireInteraction || false,
        actions: [
          {
            action: 'open',
            title: 'Open'
          },
          {
            action: 'close',
            title: 'Close'
          }
        ],
        data: {
          notificationId: data.notificationId,
          actionUrl: data.actionUrl,
          timestamp: new Date().toISOString()
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'QSToolkit', options)
      );
    } catch (err) {
      console.error('[Service Worker] Error parsing push data:', err);
      event.waitUntil(
        self.registration.showNotification('QSToolkit', {
          body: event.data.text(),
          icon: '/qstoolkit-icon.png'
        })
      );
    }
  }
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const actionUrl = notification.data?.actionUrl || '/';

  console.log('[Service Worker] Notification clicked, action:', event.action);

  notification.close();

  if (event.action === 'close') {
    return;
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for existing window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === actionUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not found
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});

// ── NOTIFICATION CLOSE ────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed');
  // Optional: Track notification dismissals
});

// ── FETCH (offline support) ────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests (don't cache)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      // Return a fallback page for offline
      return caches.match('/');
    })
  );
});

// ── MESSAGE HANDLER (from main thread) ────────────────────
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] Loaded and ready');
