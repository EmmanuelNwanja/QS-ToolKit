import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import pushNotificationService from '../services/pushNotificationService';
import '../styles/globals.css';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
const SW_URL = `/service-worker.js?v=${encodeURIComponent(APP_VERSION)}`;

export default function App({ Component, pageProps }) {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    init();
  }, [init]);

  // Register service worker and detect updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let isMounted = true;
    let visibilityHandler = null;

    const trackWaiting = (registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateReady(true);
      }
    };

    const onUpdateFound = (registration) => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // New worker installed and waiting — show prompt instead of forcing reload
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            if (!isMounted) return;
            setWaitingWorker(installing);
            setUpdateReady(true);
          }
        });
      });
    };

    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => {
        if (!isMounted) return;
        trackWaiting(registration);
        onUpdateFound(registration);
        registration.update().catch(() => {});

        visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));

    return () => {
      isMounted = false;
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, []);

  // User-triggered update: tell waiting worker to activate, then reload once
  const applyUpdate = useCallback(() => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
  }, [waitingWorker]);

  // Initialize push notifications once the user is authenticated
  useEffect(() => {
    if (!user?.id) return;
    pushNotificationService.init().then((ok) => {
      if (ok && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        pushNotificationService.subscribe().catch(() => {});
      }
    });
  }, [user?.id]);

  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
      {getLayout(<Component {...pageProps} />)}

      {/* Update available banner — shown when a new service worker is waiting */}
      {updateReady && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-primary-800 px-5 py-3 text-white shadow-xl">
          <span className="text-sm font-medium">A new version of QSToolkit is available.</span>
          <button
            onClick={applyUpdate}
            className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-gold-600 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={() => setUpdateReady(false)}
            className="text-primary-300 hover:text-white text-xs"
            aria-label="Dismiss update banner"
          >
            ✕
          </button>
        </div>
      )}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            maxWidth: '380px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          },
          success: { iconTheme: { primary: '#1a3c5e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } }
        }}
      />
    </>
  );
}
