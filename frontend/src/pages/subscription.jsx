import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import useAuthStore from '../context/authStore';
import { subscriptionAPI } from '../services/api';

const FEATURES = {
  free:       ['3 free lifetime calculator uses', 'No project logging', '1 device'],
  student:    ['7 project logs/month', '7 calculator uses/month', '1 user · 1 device', 'Promo code eligible'],
  pro:        ['15 projects/month', '20 calculator uses/month', 'Invoice & Quotation Maker', 'PDF & Excel exports', '1 user · 2 devices', 'Priority support', 'Promo code eligible'],
  enterprise: ['200 projects (scalable)', 'Unlimited calculator uses', 'Invoice & Quotation Maker', 'PDF & Excel exports', '5 users · 15 devices (scalable)', 'Team roles & permissions', 'Top priority support']
};

// Plans eligible for promo codes and philanthropist payment
const PROMO_ELIGIBLE = ['student', 'pro'];

export default function SubscriptionPage() {
  const router                    = useRouter();
  const { user, planName, refreshUser } = useAuthStore();
  const [plans, setPlans]         = useState([]);
  const [mySub, setMySub]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [paying, setPaying]       = useState('');
  const [billing, setBilling]     = useState('monthly'); // 'monthly' | 'annual'

  // Promo code state (per plan card)
  const [promoInputs, setPromoInputs]   = useState({});   // { plan_name: code }
  const [promoResults, setPromoResults] = useState({});   // { plan_name: { discount_percent, description } | null }
  const [promoLoading, setPromoLoading] = useState({});

  // Philanthropist modal state
  const [showPhilModal, setShowPhilModal] = useState(false);
  const [philPlan, setPhilPlan]           = useState('');
  const [philForm, setPhilForm]           = useState({
    donor_name: '', donor_email: '', beneficiary_email: '', message_to_beneficiary: '', promo_code: ''
  });
  const [philPaying, setPhilPaying]       = useState(false);

  useEffect(() => {
    Promise.allSettled([
      subscriptionAPI.getPlans(),
      subscriptionAPI.getMy()
    ]).then(([p, s]) => {
      if (p.status === 'fulfilled') {
        // Deduplicate by name in case DB has duplicate rows from multiple seed runs
        const rawPlans = p.value.data.plans || [];
        const seen = new Set();
        const unique = rawPlans.filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
        setPlans(unique);
      }
      if (s.status === 'fulfilled') setMySub(s.value.data);
    }).finally(() => setLoading(false));

  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const reference = router.query.reference;
    if (!reference || Array.isArray(reference)) return;

    subscriptionAPI.verify(reference).then(async () => {
      toast.success('🎉 Subscription activated!');
      await refreshUser();
      router.replace('/dashboard');
    }).catch(() => toast.error('Payment verification failed. Please contact support.'));
  }, [router.isReady, router.query.reference]);

  // ── Price display helpers ──────────────────────────────────────
  const displayPrice = (plan) => {
    if (plan.price_monthly === 0) return 'Free';
    // Compute annual from monthly if price_annual column not yet populated in DB
    const annualPrice = plan.price_annual != null ? plan.price_annual : Math.round(plan.price_monthly * 12 * 0.88);
    const base = billing === 'annual' ? annualPrice : plan.price_monthly;
    const promo = promoResults[plan.name];
    if (promo?.discount_percent) {
      const discounted = base * (1 - promo.discount_percent / 100);
      return (
        <span className="flex items-end gap-2">
          <span className="text-2xl font-bold text-primary-700">
            ₦{Math.round(discounted).toLocaleString('en-NG')}
          </span>
          <span className="text-sm line-through text-gray-400">
            ₦{Number(base).toLocaleString('en-NG')}
          </span>
        </span>
      );
    }
    return (
      <span className="text-2xl font-bold text-primary-700">
        ₦{Number(base).toLocaleString('en-NG')}
      </span>
    );
  };

  const annualSavings = (plan) => {
    if (plan.price_monthly === 0) return null;
    const annualPrice = plan.price_annual != null ? plan.price_annual : Math.round(plan.price_monthly * 12 * 0.88);
    const saving = (plan.price_monthly * 12) - annualPrice;
    return `Save ₦${Math.round(saving).toLocaleString('en-NG')}/yr`;
  };

  // ── Promo code validation ──────────────────────────────────────
  const validatePromo = async (planName) => {
    const code = promoInputs[planName]?.trim();
    if (!code) return;
    setPromoLoading(l => ({ ...l, [planName]: true }));
    try {
      const { data } = await subscriptionAPI.validatePromo(code, planName);
      setPromoResults(r => ({ ...r, [planName]: data }));
      toast.success(`✅ ${data.discount_percent}% discount applied!`);
    } catch (err) {
      setPromoResults(r => ({ ...r, [planName]: null }));
      toast.error(err.response?.data?.message || 'Invalid promo code');
    } finally {
      setPromoLoading(l => ({ ...l, [planName]: false }));
    }
  };

  // ── Subscribe (own account) ───────────────────────────────────
  const handleSubscribe = async (plan) => {
    if (plan.price_monthly === 0) return;
    setPaying(plan.name);
    try {
      const promoCode = promoResults[plan.name]?.code || promoInputs[plan.name] || undefined;
      const { data } = await subscriptionAPI.initiate(plan.name, billing, promoCode);
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }

      if (data.activated) {
        toast.success('Subscription activated successfully');
        await fetchMySub();
        setPaying('');
        return;
      }

      throw new Error('Missing payment authorization URL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment');
      setPaying('');
    }
  };

  // ── Philanthropist payment ─────────────────────────────────────
  const handlePhilSubmit = async (e) => {
    e.preventDefault();
    setPhilPaying(true);
    try {
      const { data } = await subscriptionAPI.initiatePhilanthropist(
        philForm, philPlan, billing
      );
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }

      if (data.activated) {
        toast.success('Gift subscription processed successfully');
        setPhilPaying(false);
        return;
      }

      throw new Error('Missing payment authorization URL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment');
      setPhilPaying(false);
    }
  };

  const current = planName();

  return (
    <ProtectedRoute>
      <Head><title>Subscription & Plans — QSToolkit</title></Head>
      <Layout title="💳 Subscription & Plans">
        <div className="max-w-5xl space-y-6">

          {/* Pending gift notification */}
          {mySub?.pending_gift && (
            <div className="card bg-gold-50 border-gold-200 border-2 flex items-start gap-3">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="font-semibold text-gold-800">You have a pending gift subscription!</p>
                <p className="text-sm text-gold-700 mt-0.5">
                  Someone has paid for a <strong>{mySub.pending_gift.plan_name}</strong> plan for you.
                  It will activate automatically. Contact support if it hasn't activated within 24 hours.
                </p>
              </div>
            </div>
          )}

          {/* Current plan banner */}
          {mySub && (
            <div className={`rounded-xl p-4 border flex items-center justify-between flex-wrap gap-3 ${
              mySub.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {mySub.status === 'active' ? '✅' : '⚠️'} Current Plan: <strong>{mySub.plan?.name || 'Free'}</strong>
                  {mySub.billing_cycle === 'annual' && <span className="ml-2 badge-green">Annual</span>}
                </p>
                {mySub.expires_at && (
                  <p className="text-sm text-gray-500">
                    Renews / Expires: {new Date(mySub.expires_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              {mySub.status !== 'active' && (
                <p className="text-sm text-amber-700 font-medium">Upgrade to unlock all features</p>
              )}
            </div>
          )}

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mx-auto">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'annual' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              Annual
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                12% off
              </span>
            </button>
          </div>

          {/* Plans grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-72 bg-white rounded-2xl border animate-pulse" />
              ))
            ) : plans.map((plan) => {
              const isCurrent = plan.name === current && mySub?.status === 'active';
              const features  = FEATURES[plan.name] || [];
              const eligible  = PROMO_ELIGIBLE.includes(plan.name);
              const savings   = billing === 'annual' ? annualSavings(plan) : null;

              return (
                <div key={plan.id} className={`card flex flex-col border-2 transition-all ${
                  isCurrent        ? 'border-emerald-400 bg-emerald-50/30' :
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
                    <div className="flex flex-col mt-1 mb-1">
                      {displayPrice(plan)}
                      <div className="flex items-center gap-2 mt-0.5">
                        {plan.price_monthly > 0 && (
                          <span className="text-gray-400 text-xs">
                            /{billing === 'annual' ? 'year' : 'month'}
                          </span>
                        )}
                        {savings && (
                          <span className="text-xs font-semibold text-emerald-600">{savings}</span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-1.5 mb-4 mt-3">
                      {features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className={`font-bold mt-0.5 ${f === 'Promo code eligible' ? 'text-gold-500' : 'text-emerald-500'}`}>
                            {f === 'Promo code eligible' ? '🎟' : '✓'}
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Promo code input (student + pro only) */}
                    {eligible && plan.price_monthly > 0 && !isCurrent && (
                      <div className="mt-3 mb-2">
                        <div className="flex gap-1">
                          <input
                            className="input py-1.5 text-xs flex-1 uppercase placeholder:normal-case"
                            placeholder="Promo code"
                            value={promoInputs[plan.name] || ''}
                            onChange={e => setPromoInputs(p => ({ ...p, [plan.name]: e.target.value.toUpperCase() }))}
                            onKeyDown={e => e.key === 'Enter' && validatePromo(plan.name)}
                          />
                          <button
                            type="button"
                            onClick={() => validatePromo(plan.name)}
                            disabled={promoLoading[plan.name]}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                          >
                            {promoLoading[plan.name] ? '…' : 'Apply'}
                          </button>
                        </div>
                        {promoResults[plan.name] && (
                          <p className="text-xs text-emerald-600 mt-1 font-medium">
                            ✅ {promoResults[plan.name].discount_percent}% off — {promoResults[plan.name].description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-3 space-y-2">
                    {isCurrent ? (
                      <div className="w-full text-center py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-sm">
                        ✓ Current Plan
                      </div>
                    ) : plan.price_monthly === 0 ? (
                      <div className="w-full text-center py-2 text-gray-400 text-sm">Free tier</div>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={!!paying}
                        className={`w-full text-sm ${plan.name === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {paying === plan.name ? 'Redirecting…'
                          : `Get ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}`}
                      </button>
                    )}

                    {/* Gift this plan (philanthropist) */}
                    {eligible && plan.price_monthly > 0 && (
                      <button
                        onClick={() => { setPhilPlan(plan.name); setShowPhilModal(true); }}
                        className="w-full text-xs text-gold-600 hover:text-gold-700 font-medium py-1 border border-gold-200 rounded-lg hover:bg-gold-50 transition-colors"
                      >
                        🎁 Gift this plan to someone
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment info */}
          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">💳 Secure Nigerian Payment via Paystack</h3>
            <p className="text-sm text-blue-700">
              Pay with your debit card, bank transfer, or USSD. Annual plans save 12% vs monthly billing.
              Subscriptions auto-renew. Cancel anytime from your profile settings.
            </p>
          </div>

        </div>

        {/* ── Philanthropist Modal ──────────────────────────────── */}
        {showPhilModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-primary-800">🎁 Gift a Subscription</h2>
                  <p className="text-sm text-gray-500 mt-0.5 capitalize">
                    {philPlan} plan · {billing} billing
                  </p>
                </div>
                <button onClick={() => setShowPhilModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <form onSubmit={handlePhilSubmit} className="space-y-4">
                <div>
                  <label className="label">Recipient's Email <span className="text-red-500">*</span></label>
                  <input type="email" className="input" placeholder="recipient@email.com" required
                    value={philForm.beneficiary_email}
                    onChange={e => setPhilForm(f => ({ ...f, beneficiary_email: e.target.value }))} />
                  <p className="text-xs text-gray-400 mt-1">The person who will receive the subscription</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Your Name</label>
                    <input className="input" placeholder="Your name"
                      value={philForm.donor_name}
                      onChange={e => setPhilForm(f => ({ ...f, donor_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Your Email <span className="text-red-500">*</span></label>
                    <input type="email" className="input" placeholder="your@email.com" required
                      value={philForm.donor_email}
                      onChange={e => setPhilForm(f => ({ ...f, donor_email: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="label">Personal Message (optional)</label>
                  <textarea className="input" rows={2}
                    placeholder="e.g. Keep building! This is my support for your QS journey."
                    value={philForm.message_to_beneficiary}
                    onChange={e => setPhilForm(f => ({ ...f, message_to_beneficiary: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Promo Code (optional)</label>
                  <input className="input uppercase" placeholder="Enter code if you have one"
                    value={philForm.promo_code}
                    onChange={e => setPhilForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))} />
                </div>

                <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 text-xs text-gold-800">
                  🔔 If the recipient doesn't have a QSToolkit account yet, the subscription will activate automatically when they register with this email address.
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowPhilModal(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" className="btn-gold flex-1" disabled={philPaying}>
                    {philPaying ? 'Redirecting…' : '🎁 Pay & Send Gift'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </Layout>
    </ProtectedRoute>
  );
}
