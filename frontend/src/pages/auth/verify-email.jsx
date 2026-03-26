import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { authAPI } from '../../services/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!router.isReady) return;

    const token = String(router.query.token || '');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    (async () => {
      try {
        const { data } = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(data?.message || 'Email verified successfully.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed.');
      }
    })();
  }, [router.isReady, router.query.token]);

  return (
    <>
      <Head><title>Verify Email - QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-card p-8 text-center">
          <h1 className="font-display text-2xl text-primary-800 font-bold mb-3">Email Verification</h1>
          <p className="text-sm text-gray-600 mb-6">{message}</p>

          {status === 'pending' && (
            <div className="animate-pulse text-primary-600 text-sm">Please wait...</div>
          )}

          {status !== 'pending' && (
            <Link href="/auth/login" className="btn-primary w-full justify-center">
              Continue to Sign In
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
