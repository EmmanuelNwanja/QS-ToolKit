import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';

export default function PaymentComingSoon() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <Head><title>Paystack Payments — Coming Soon | QSToolkit</title></Head>
      <Layout title="Paystack Payments">
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <svg className="text-slate-400" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          </div>

          <span className="inline-block text-xs font-semibold bg-slate-100 text-slate-500 px-3 py-1 rounded-full mb-4 tracking-wide">
            Coming Soon
          </span>
          <h1 className="font-display font-bold text-2xl text-slate-800 mb-3">Paystack Payments Unavailable</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Online card and USSD payment via Paystack is not yet available on QSToolkit.
            <br className="hidden sm:block" />
            Please use <strong className="text-slate-700">Direct Bank Transfer</strong> to activate your plan, or
            contact our support team for assistance.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push('/subscription')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              ← Back to Plans
            </button>
            <a
              href="mailto:support@qs.solnuv.com"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-700 text-white font-semibold text-sm hover:bg-primary-800 transition-colors"
            >
              Contact Support
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-8">
            Need help? Email us at{' '}
            <a href="mailto:support@qs.solnuv.com" className="text-primary-700 hover:underline">
              support@qs.solnuv.com
            </a>
          </p>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
