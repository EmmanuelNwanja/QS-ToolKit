import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import pushNotificationService from '../services/pushNotificationService';
import '../styles/globals.css';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
const SW_URL = `/service-worker.js?v=${encodeURIComponent(APP_VERSION)}`;
const SW_RELOAD_GUARD_KEY = 'qst_sw_reloaded_version';

export default function App({ Component, pageProps }) {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    init();
  }, [init]);

  // Register service worker for PWA support
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let isMounted = true;
    let visibilityHandler = null;

    const requestActivation = (registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    };

    const onControllerChange = () => {
      if (sessionStorage.getItem(SW_RELOAD_GUARD_KEY) === APP_VERSION) return;
      sessionStorage.setItem(SW_RELOAD_GUARD_KEY, APP_VERSION);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => {
        if (!isMounted) return;
        requestActivation(registration);
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
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, []);

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
