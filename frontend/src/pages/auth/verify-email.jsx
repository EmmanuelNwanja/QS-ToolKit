import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [status, setStatus] = useState('input'); // input | verifying | success | error
  const [message, setMessage] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    if (router.query.email) setEmail(router.query.email);
  }, [router.query.email]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every(d => d !== '') && index === 5) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (otpCode) => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setStatus('verifying');
    try {
      const { data } = await authAPI.verifyEmail({ email, otp: otpCode });
      setStatus('success');
      setMessage(data?.message || 'Email verified successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Verification failed.');
      toast.error(err.response?.data?.message || 'Invalid code');
      // Reset OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error('Enter your email first'); return; }
    try {
      await authAPI.resendVerification(email);
      toast.success('New code sent! Check your email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code');
    }
  };

  return (
    <>
      <Head><title>Verify Email - QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-card p-8 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h1 className="font-display text-2xl text-primary-800 font-bold mb-2">Verify Your Email</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter the 6-digit code sent to your email address.
          </p>

          {status === 'success' ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">{message}</p>
              </div>
              <Link href="/auth/login" className="btn-primary w-full justify-center block text-center">
                Continue to Sign In
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Email input */}
              <div>
                <input
                  type="email"
                  className="input text-center"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'verifying'}
                />
              </div>

              {/* OTP input boxes */}
              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="w-11 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    disabled={status === 'verifying'}
                  />
                ))}
              </div>

              {status === 'verifying' && (
                <p className="text-sm text-primary-600 animate-pulse">Verifying...</p>
              )}

              {status === 'error' && (
                <p className="text-sm text-red-600">{message}</p>
              )}

              <button
                type="button"
                onClick={() => handleVerify(otp.join(''))}
                disabled={otp.some(d => !d) || status === 'verifying'}
                className="btn-primary w-full justify-center"
              >
                {status === 'verifying' ? 'Verifying...' : 'Verify Email'}
              </button>

              <p className="text-xs text-gray-400">
                Didn&apos;t receive a code?{' '}
                <button type="button" onClick={handleResend} className="text-primary-600 hover:underline font-medium">
                  Resend
                </button>
              </p>

              <Link href="/auth/login" className="text-xs text-gray-400 hover:text-gray-600 block">
                ← Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
