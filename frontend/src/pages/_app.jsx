import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    // Redirect admins to dashboard if they're on the auth pages
    if (user?.is_admin && router.pathname.startsWith('/auth')) {
      router.replace('/admin');
    }
  }, [user, router]);

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
