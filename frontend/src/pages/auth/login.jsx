import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import useAuthStore from '../../context/authStore';
import { authAPI } from '../../services/api';
import PasswordInput from '../../components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [emailIssueAlert, setEmailIssueAlert] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', '']);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const otpRefs = useRef([]);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.email && !form.email) {
      setForm((f) => ({ ...f, email: String(router.query.email) }));
    }

    if (router.query.verify === '1') {
      toast.success('Verification email sent. Please verify before signing in.');
    }

    if (router.query.email_delivery_failed === '1') {
      setEmailIssueAlert(true);
      toast.error('Activation email failed. Contact support for manual activation.');
    }
  }, [router.isReady, router.query.email, router.query.verify, router.query.email_delivery_failed]);

  const handleResendVerification = async () => {
    if (!form.email) {
      toast.error('Enter your email first to resend verification.');
      return;
    }

    setResending(true);
    try {
      const { data } = await authAPI.resendVerification(form.email);
      toast.success(data?.message || 'Verification email sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  // ── Forgot password handlers ────────────────────────────────
  const handleForgotSendOtp = async () => {
    if (!forgotEmail) { toast.error('Enter your email'); return; }
    setForgotLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      toast.success('Reset code sent! Check your email.');
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send code');
    } finally { setForgotLoading(false); }
  };

  const handleForgotVerifyOtp = async () => {
    const code = forgotOtp.join('');
    if (code.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setForgotLoading(true);
    try {
      const { data } = await authAPI.verifyResetOtp({ email: forgotEmail, otp: code });
      setResetToken(data?.reset_token || '');
      setForgotStep(3);
      toast.success('Code verified! Set your new password.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    } finally { setForgotLoading(false); }
  };

  const handleForgotResetPassword = async () => {
    if (!forgotNewPassword || forgotNewPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (forgotNewPassword !== forgotConfirmPassword) { toast.error('Passwords do not match'); return; }
    setForgotLoading(true);
    try {
      await authAPI.resetPassword({ reset_token: resetToken, new_password: forgotNewPassword });
      toast.success('Password reset! You can now sign in.');
      setShowForgotPasswordModal(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp(['', '', '', '', '', '']);
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password');
    } finally { setForgotLoading(false); }
  };

  const handleForgotOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...forgotOtp];
    newOtp[index] = value.slice(-1);
    setForgotOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '') && index === 5) {
      // Auto-verify
      setTimeout(() => {
        const code = newOtp.join('');
        setForgotLoading(true);
        authAPI.verifyResetOtp({ email: forgotEmail, otp: code })
          .then(({ data }) => { setResetToken(data?.reset_token || ''); setForgotStep(3); toast.success('Code verified!'); })
          .catch((err) => { toast.error(err.response?.data?.message || 'Invalid code'); setForgotOtp(['', '', '', '', '', '']); otpRefs.current[0]?.focus(); })
          .finally(() => setForgotLoading(false));
      }, 100);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      setShowResendVerification(false);
      toast.success(`Welcome back, ${user.name}!`);
      
      // Small delay to ensure state is updated before redirect
      setTimeout(() => {
        // Redirect based on user type and onboarding status
        if (user.force_password_change) {
          router.push('/auth/force-change-password');
          return;
        }
        if (!user.onboarding_completed) {
          router.push('/auth/onboarding');
        } else if (user.is_admin) {
          // Redirect admins to admin dashboard
          const redirect = router.query.redirect || '/admin';
          router.push(redirect);
        } else {
          // Redirect regular users to user dashboard
          const redirect = router.query.redirect || '/dashboard';
          router.push(redirect);
        }
      }, 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setShowResendVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Sign In - QSToolkit</title></Head>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Left panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary-800 flex-col justify-center items-center p-12 text-white">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">QS</span>
              </div>
              <span className="font-display text-2xl font-bold">QSToolkit</span>
            </div>
            <h2 className="font-display text-3xl font-bold mb-4">Nigeria&apos;s #1 QS Platform</h2>
            <p className="text-primary-300 leading-relaxed mb-8">
              Professional tools for Quantity Surveyors - from Lagos to Kano. Calculate, track, invoice, and grow your practice.
            </p>
            <div className="space-y-3">
              {['10+ professional calculators', 'BOQ generator with PDF/Excel export', 'Branded invoices & quotations', 'Client feedback & live leaderboard'].map(f => (
                <div key={f} className="flex items-center gap-3 text-sm text-primary-200">
                  <span className="text-gold-400">✓</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-gold-400 font-bold text-sm">QS</span>
              </div>
              <span className="font-display text-xl font-bold text-primary-800">QSToolkit</span>
            </div>

            <h1 className="font-display text-2xl font-bold text-primary-800 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm mb-8">Sign in to your QSToolkit account</p>

            {emailIssueAlert && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Activation Email Delivery Failed</p>
                <p className="mt-1 text-sm text-red-700">
                  Your account may already be created, but we could not deliver the activation email.
                  Contact support for manual activation at
                  {' '}
                  <a href="mailto:dev@qs.solnuv.com" className="font-semibold underline">dev@qs.solnuv.com</a>.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Email address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className="input"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  inputMode="email"
                  required
                />
              </div>
              <div>
                <label className="label">Password <span className="text-red-500">*</span></label>
                <PasswordInput
                  placeholder="Your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="btn-secondary w-full"
                >
                  {resending ? 'Sending verification…' : 'Resend Verification Email'}
                </button>
              )}
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-primary-700 font-semibold hover:underline">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {forgotStep === 1 ? 'Forgot Password' : forgotStep === 2 ? 'Enter Reset Code' : 'Set New Password'}
              </h3>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Step 1: Enter email */}
              {forgotStep === 1 && (
                <>
                  <p className="text-sm text-gray-600">Enter your email and we&apos;ll send you a reset code.</p>
                  <input
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    inputMode="email"
                  />
                  <button onClick={handleForgotSendOtp} disabled={forgotLoading} className="btn-primary w-full">
                    {forgotLoading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </>
              )}

              {/* Step 2: Enter OTP */}
              {forgotStep === 2 && (
                <>
                  <p className="text-sm text-gray-600">Enter the 6-digit code sent to <strong>{forgotEmail}</strong></p>
                  <div className="flex justify-center gap-2">
                    {forgotOtp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="w-11 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                        value={digit}
                        onChange={(e) => handleForgotOtpChange(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Backspace' && !forgotOtp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                      />
                    ))}
                  </div>
                  <button onClick={handleForgotVerifyOtp} disabled={forgotLoading || forgotOtp.some(d => !d)} className="btn-primary w-full">
                    {forgotLoading ? 'Verifying...' : 'Verify Code'}
                  </button>
                  <button type="button" onClick={() => { setForgotStep(1); setForgotOtp(['', '', '', '', '', '']); }} className="text-sm text-gray-500 hover:underline w-full text-center">
                    ← Change email
                  </button>
                </>
              )}

              {/* Step 3: New password */}
              {forgotStep === 3 && (
                <>
                  <p className="text-sm text-gray-600">Enter your new password below.</p>
                  <div>
                    <label className="label">New Password</label>
                    <PasswordInput
                      placeholder="Min. 8 characters"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="label">Confirm Password</label>
                    <PasswordInput
                      placeholder="Repeat password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <button onClick={handleForgotResetPassword} disabled={forgotLoading} className="btn-primary w-full">
                    {forgotLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => { setShowForgotPasswordModal(false); setForgotStep(1); setForgotOtp(['', '', '', '', '', '']); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
