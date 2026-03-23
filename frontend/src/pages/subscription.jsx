import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import useAuthStore from '../context/authStore';
import { subscriptionAPI } from '../services/api';

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, planName, refreshUser } = useAuthStore();
  const [plans, setPlans]       = useState([]);
  const [mySub, setMySub]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState('');

  useEffect(() => {
    Promise.allSettled([
      subscriptionAPI.getPlans(),
      subscriptionAPI.getMy()
    ]).then(([p, s]) => {
      if (p.status === 'fulfilled') setPlans(p.value.data.plans || []);
      if (s.status === 'fulfilled') setMySub(s.value.data);
    }).finally(() => setLoading(false));

    // Handle Paystack redirect back
    const { reference } = router.query;
    if (reference) {
      subscriptionAPI.verify(reference).then(async () => {
        toast.success('🎉 Subscription activated!');
        await refreshUser();
        router.replace('/subscription');
      }).catch(() => toast.error('Payment verification failed.'));
    }
  }, []);

  const handleSubscribe = async (planName) => {
    setPaying(planName);
    try {
      const { data } = await subscriptionAPI.initiate(planName);
      window.location.href = data.authorization_url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment');
      setPaying('');
    }
  };

  const FEATURE_MAP = {
    free:       ['1 free calculator use', '1 device', 'No project logging'],
    student:    ['7 project logs/month', '7 calculator uses/month', '1 user, 1 device'],
    pro:        ['15 projects', '20 calculator uses/month', 'Invoice & Quotation Maker', 'PDF & Excel exports', '1 user, 2 devices', 'Priority support'],
    enterprise: ['200 projects (scalable)', 'Unlimited calculator uses', 'Invoice & Quotation Maker', 'PDF & Excel exports', '5 users, 15 devices (scalable)', 'Team roles & permissions', 'Top priority support']
  };

  const current = planName();

  return (
    <ProtectedRoute>
      <Head><title>Subscription — QSToolkit</title></Head>
      <Layout title="💳 Subscription & Plans">
        <div className="max-w-5xl space-y-6">

          {/* Current plan banner */}
          {mySub && (
            <div className={`rounded-xl p-4 border flex items-center justify-between flex-wrap gap-3 ${
              mySub.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {mySub.status === 'active' ? '✅' : '⚠️'} Current Plan: <strong>{mySub.plan?.name || 'Free'}</strong>
                </p>
                {mySub.expires_at && (
                  <p className="text-sm text-gray-500">Renews / Expires: {new Date(mySub.expires_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                )}
              </div>
              {mySub.status !== 'active' && (
                <p className="text-sm text-amber-700">Upgrade to access all features</p>
              )}
            </div>
          )}

          {/* Plans grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border animate-pulse" />
              ))
            ) : plans.map((plan) => {
              const isCurrent = plan.name === current;
              const features = FEATURE_MAP[plan.name] || [];
              return (
                <div key={plan.id}
                  className={`card flex flex-col border-2 transition-all ${
                    isCurrent ? 'border-emerald-400 bg-emerald-50/30' :
                    plan.name === 'pro' ? 'border-primary-700' :
                    plan.name === 'enterprise' ? 'border-gold-400' :
                    'border-gray-200'
                  }`}>
                  {plan.name === 'pro' && (
                    <div className="text-center mb-3">
                      <span className="bg-primary-700 text-white text-xs font-bold px-3 py-0.5 rounded-full">⭐ Most Popular</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-primary-800 capitalize">{plan.name}</h3>
                    <div className="flex items-end gap-1 mt-1 mb-4">
                      <span className="text-2xl font-bold text-primary-700">
                        {plan.price_monthly === 0 ? 'Free' : `₦${Number(plan.price_monthly).toLocaleString('en-NG')}`}
                      </span>
                      {plan.price_monthly > 0 && <span className="text-gray-400 text-xs mb-1">/month</span>}
                    </div>
                    <ul className="space-y-2">
                      {features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-emerald-500 font-bold mt-0.5">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-5">
                    {isCurrent ? (
                      <div className="w-full text-center py-2 px-4 rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-sm">
                        ✓ Current Plan
                      </div>
                    ) : plan.price_monthly === 0 ? (
                      <div className="w-full text-center py-2 text-gray-400 text-sm">Free tier</div>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.name)}
                        disabled={!!paying}
                        className={`w-full ${plan.name === 'pro' ? 'btn-primary' : 'btn-secondary'} text-sm`}
                      >
                        {paying === plan.name ? 'Redirecting…' : `Get ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment info */}
          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">💳 Secure Nigerian Payment</h3>
            <p className="text-sm text-blue-700">
              All payments are processed securely via <strong>Paystack</strong> — Nigeria's leading payment gateway.
              Pay with your debit card, bank transfer, or USSD. Subscriptions auto-renew monthly.
            </p>
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
