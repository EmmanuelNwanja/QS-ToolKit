/**
 * Service Worker for QSToolkit PWA
 * Handles: push notifications, offline caching, app shell caching
 */

const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `qstoolkit-${SW_VERSION}`;
const STATIC_ASSETS = [
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/maskable-icon.svg',
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API requests — always go network
  if (url.pathname.startsWith('/api/')) return;

  // Skip Next.js data requests — always go network
  if (url.pathname.startsWith('/_next/data/')) return;

  // Skip chrome-extension and non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Skip Next.js build artifacts — Next.js manages these via HTTP cache headers.
  // Caching them here causes stale chunk errors after new deployments.
  if (url.pathname.startsWith('/_next/')) return;

  // HTML navigations: network-first only, no cache write to avoid stale authenticated pages.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // Only public static assets (icons/fonts/images) use cache-first.
  const isPublicAsset = /\.(woff2?|ttf|svg|png|jpg|ico|webp)(\?.*)?$/.test(url.pathname)
    && !url.pathname.startsWith('/_next/');
  if (isPublicAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Other requests: network-first with cache fallback only (no cache write).
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
  );
});

// ── MESSAGE HANDLER (from main thread) ────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] QSToolkit PWA service worker loaded');
