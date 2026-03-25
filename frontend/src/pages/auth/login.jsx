import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import useAuthStore from '../../context/authStore';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      // Redirect based on whether onboarding is complete
      if (!user.onboarding_completed) {
        router.push('/auth/onboarding');
      } else {
        const redirect = router.query.redirect || '/dashboard';
        router.push(redirect);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Sign In — QSToolkit</title></Head>
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
            <h2 className="font-display text-3xl font-bold mb-4">Nigeria's #1 QS Platform</h2>
            <p className="text-primary-300 leading-relaxed mb-8">
              Professional tools for Quantity Surveyors — from Lagos to Kano. Calculate, track, invoice, and grow your practice.
            </p>
            <div className="space-y-3">
              {['8 professional calculators', 'BOQ generator with PDF/Excel export', 'Branded invoices & quotations', 'Client feedback & live leaderboard'].map(f => (
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-primary-700 font-semibold hover:underline">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
