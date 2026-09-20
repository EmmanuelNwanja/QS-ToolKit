import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import useAuthStore from '../context/authStore';
import { subscriptionAPI, academyAPI, examAPI } from '../services/api';

const FEATURES = {
  free:       ['3 free lifetime calculator uses', 'No project logging', '1 device'],
  basic:      ['2 project logs/month', '30 calculator uses/month', '2 BOQ/month', '2 invoices · 2 valuations · 2 quotations/month', 'PDF & Excel exports', '1 user · 1 device', 'Standard support', 'Promo code eligible'],
  student:    ['2 project logs/month', '30 calculator uses/month', '2 BOQ/month', '2 invoices · 2 valuations · 2 quotations/month', 'PDF & Excel exports', '1 user · 1 device', 'Standard support', 'Promo code eligible'],
  pro:        ['5 project logs/month', '80 calculator uses/month', '5 BOQ/month', '5 invoices · 5 valuations · 5 quotations/month', 'PDF & Excel exports', '1 user · 2 devices', 'Priority support', 'Promo code eligible'],
  enterprise: ['50 project logs/month', '700 calculator uses/month', '50 BOQ/month', '50 invoices · 50 valuations · 50 quotations/month', 'PDF & Excel exports', '5 users · 15 devices', 'Team roles & permissions', 'Top priority support']
};

const PLAN_DISPLAY_NAMES = {
  free: 'Free',
  basic: 'Starter',
  student: 'Starter',
  pro: 'Pro',
  enterprise: 'Elite',
};

const PROMO_ELIGIBLE = ['basic', 'student', 'pro'];

export default function SubscriptionPage() {
  const router                    = useRouter();
  const { planName, refreshUser } = useAuthStore();
  const [plans, setPlans]         = useState([]);
  const [mySub, setMySub]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [paying, setPaying]       = useState('');
  const [billing, setBilling]     = useState('monthly');
  const [gatewayStatus, setGatewayStatus] = useState({ flutterwave: { configured: false } });

  const [promoInputs, setPromoInputs]   = useState({});
  const [promoResults, setPromoResults] = useState({});
  const [promoLoading, setPromoLoading] = useState({});

  // Payment method modal
  const [pendingPlan, setPendingPlan]       = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod]   = useState(null);

  // Add-on payment loading state
  const [addOnPaying, setAddOnPaying] = useState('');
  const [academyBilling, setAcademyBilling] = useState('weekly');
  const [examBilling, setExamBilling] = useState('weekly');

  // Philanthropist modal state
  const [showPhilModal, setShowPhilModal] = useState(false);
  const [philPlan, setPhilPlan]           = useState('');
  const [philForm, setPhilForm]           = useState({
    donor_name: '', donor_email: '', beneficiary_email: '', message_to_beneficiary: '', promo_code: ''
  });
  const [philPaying, setPhilPaying]       = useState(false);

  const fetchMySub = async () => {
    try {
      const { data } = await subscriptionAPI.getMy();
      setMySub(data);
    } catch {}
  };

  useEffect(() => {
    Promise.allSettled([
      subscriptionAPI.getPlans(),
      subscriptionAPI.getMy(),
      subscriptionAPI.getGatewayStatus()
    ]).then(([p, s, g]) => {
      if (p.status === 'fulfilled') {
        const rawPlans = p.value.data.plans || [];
        const seen = new Set();
        const unique = rawPlans.filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
        setPlans(unique);
      }
      if (s.status === 'fulfilled') setMySub(s.value.data);
      if (g.status === 'fulfilled') setGatewayStatus(g.value.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const rawRef = String(router.query.tx_ref || router.query.reference || router.query.trxref || '');
    if (!rawRef) return;

    const verifyRef = rawRef.split(',')[0].trim();
    subscriptionAPI.verify(verifyRef, router.query.tx_ref ? 'flutterwave' : undefined).then(async () => {
      toast.success('Subscription activated!');
      await refreshUser();
      await fetchMySub();
      router.replace('/dashboard');
    }).catch(() => toast.error('Payment verification failed. Please contact support.'));
  }, [router.isReady, router.query.reference, router.query.trxref, router.query.tx_ref]);


  const handleAddOnSubscribe = async (addOnType) => {
    const billingCycle = addOnType === 'academy' ? academyBilling : examBilling;

    setAddOnPaying(addOnType);
    try {
      const api = addOnType === 'academy' ? academyAPI : examAPI;
      const { data } = await api.subscribe({ billing_cycle: billingCycle, payment_method: 'card' });
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error('Missing payment authorization URL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment');
      setAddOnPaying('');
    }
  };

  const displayPrice = (plan) => {
    if (plan.price_monthly === 0) return 'Free';
    const annualPrice = plan.price_annual != null ? plan.price_annual : Math.round(plan.price_monthly * 12 * 0.90);
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
    const annualPrice = plan.price_annual != null ? plan.price_annual : Math.round(plan.price_monthly * 12 * 0.90);
    const saving = (plan.price_monthly * 12) - annualPrice;
    return `Save ₦${Math.round(saving).toLocaleString('en-NG')}/yr`;
  };

  const renewalPrice = (plan) => {
    if (!plan || plan.price_monthly === 0) return null;
    const amount = billing === 'annual'
      ? (plan.price_annual != null ? plan.price_annual : Math.round(plan.price_monthly * 12 * 0.90))
      : plan.price_monthly;
    return `Future renewals continue at ₦${Math.round(amount).toLocaleString('en-NG')} per ${billing === 'annual' ? 'year' : 'month'}.`;
  };

  const validatePromo = async (planName) => {
    const code = promoInputs[planName]?.trim();
    if (!code) return;
    setPromoLoading(l => ({ ...l, [planName]: true }));
    try {
      const { data } = await subscriptionAPI.validatePromo(code, planName);
      setPromoResults(r => ({ ...r, [planName]: data }));
      toast.success(`${data.discount_percent}% discount applied!`);
    } catch (err) {
      setPromoResults(r => ({ ...r, [planName]: null }));
      toast.error(err.response?.data?.message || 'Invalid promo code');
    } finally {
      setPromoLoading(l => ({ ...l, [planName]: false }));
    }
  };

  function openPaymentModal(planId) {
    if (planId === 'enterprise') { window.location.href = 'mailto:sales@qs.solnuv.com?subject=Enterprise%20Plan%20Inquiry'; return; }
    if (planId === 'free') return;
    setPendingPlan(planId);
    setPaymentMethod(null);
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPendingPlan(null);
    setPaymentMethod(null);
    setPaying('');
  }

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
        await refreshUser();
        setPaying('');
        return;
      }
      throw new Error('Missing payment authorization URL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment');
      setPaying('');
    }
  };

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
  const [changingPlan, setChangingPlan] = useState('');

  const handleChangePlan = async (newPlanName) => {
    if (!confirm(`Switch to ${PLAN_DISPLAY_NAMES[newPlanName] || newPlanName}? Downgrades take effect immediately; upgrades require payment.`)) return;
    setChangingPlan(newPlanName);
    try {
      const { data } = await subscriptionAPI.changePlan(newPlanName, billing);
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      toast.success(data.message || 'Plan changed successfully');
      await fetchMySub();
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change plan');
    } finally {
      setChangingPlan('');
    }
  };

  const PLAN_HIERARCHY = ['free', 'basic', 'pro', 'enterprise'];

  return (
    <ProtectedRoute>
      <Head>
        <title>Subscription & Plans - QSToolkit</title>
        <meta name="description" content="Manage your QSToolkit subscription. Starter ₦8,999/mo, Pro ₦23,999/mo, Elite ₦84,999/mo. Upgrade, downgrade or view billing history." />
        <link rel="canonical" href="https://qs.solnuv.com/subscription" />
      </Head>
      <Layout title="Subscription & Plans">
        <div className="max-w-5xl space-y-6">

          {mySub?.pending_gift && (
            <div className="card bg-gold-50 border-gold-200 border-2 flex items-start gap-3">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="font-semibold text-gold-800">You have a pending gift subscription!</p>
                <p className="text-sm text-gold-700 mt-0.5">
                  Someone has paid for a <strong>{mySub.pending_gift.plan_name}</strong> plan for you.
                  It will activate automatically. Contact support if it hasn&apos;t activated within 24 hours.
                </p>
              </div>
            </div>
          )}

          {mySub && (
            <div className={`rounded-xl p-4 border flex items-center justify-between flex-wrap gap-3 ${
              mySub.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div>
                <p className="font-semibold text-gray-900">
                  {mySub.status === 'active' ? '✅' : '⚠️'} Current Plan: <strong>{PLAN_DISPLAY_NAMES[mySub.plan?.name] || mySub.plan?.name || 'Free'}</strong>
                  {mySub.billing_cycle === 'annual' && <span className="ml-2 badge-green">Annual</span>}
                </p>
                {mySub.expires_at && (
                  <p className="text-sm text-gray-500">
                    {mySub.status === 'cancelled' ? 'Access until' : 'Renews / Expires'}: {new Date(mySub.expires_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              {mySub.status === 'active' && mySub.plan?.name && mySub.plan.name !== 'free' && (
                <div className="flex items-center gap-2">
                  {PLAN_HIERARCHY.indexOf(mySub.plan.name) < PLAN_HIERARCHY.length - 1 && (
                    <button
                      onClick={() => handleChangePlan(PLAN_HIERARCHY[PLAN_HIERARCHY.indexOf(mySub.plan.name) + 1])}
                      disabled={!!changingPlan}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {changingPlan ? '...' : 'Upgrade'}
                    </button>
                  )}
                  {PLAN_HIERARCHY.indexOf(mySub.plan.name) > 1 && (
                    <button
                      onClick={() => handleChangePlan(PLAN_HIERARCHY[PLAN_HIERARCHY.indexOf(mySub.plan.name) - 1])}
                      disabled={!!changingPlan}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {changingPlan ? '...' : 'Downgrade'}
                    </button>
                  )}
                </div>
              )}
              {mySub.status !== 'active' && (
                <p className="text-sm text-amber-700 font-medium">Upgrade to unlock all features</p>
              )}
            </div>
          )}

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
                10% off
              </span>
            </button>
          </div>

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
                      <span className="bg-primary-700 text-white text-xs font-bold px-3 py-0.5 rounded-full">Most Popular</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-primary-800">{PLAN_DISPLAY_NAMES[plan.name] || plan.name}</h3>
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
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-emerald-600 font-medium">
                              ✅ {promoResults[plan.name].discount_percent}% off - {promoResults[plan.name].description}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              Discount applies to the first payment only. {renewalPrice(plan)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {isCurrent ? (
                      <div className="w-full text-center py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-sm">
                        ✓ Current Plan
                      </div>
                    ) : plan.price_monthly === 0 ? (
                      <div className="w-full text-center py-2 text-gray-400 text-sm">Free tier</div>
                    ) : (
                      <button
                        onClick={() => openPaymentModal(plan.name)}
                        disabled={!!paying}
                        className={`w-full text-sm ${plan.name === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        Get {PLAN_DISPLAY_NAMES[plan.name] || plan.name}
                      </button>
                    )}

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

          {/* Add-on Cards - Coming Soon, hidden for now */}
          {false && (
          <div className="mt-2">
            <h3 className="font-display text-lg font-bold text-primary-800 mb-4">Add-ons</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-purple-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-xl">🎓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">QS Academy</h4>
                    <p className="text-xs text-gray-500">AI-powered learning, knowledge arena</p>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${academyBilling === 'weekly' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                    <input type="radio" name="academy_billing" value="weekly" checked={academyBilling === 'weekly'} onChange={() => setAcademyBilling('weekly')} className="accent-purple-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Weekly</span><span className="text-sm font-bold text-primary-700 ml-2">₦2,000/wk</span></div>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${academyBilling === 'monthly' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                    <input type="radio" name="academy_billing" value="monthly" checked={academyBilling === 'monthly'} onChange={() => setAcademyBilling('monthly')} className="accent-purple-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Monthly</span><span className="text-sm font-bold text-primary-700 ml-2">₦7,600/mo</span><span className="text-[10px] text-emerald-600 font-semibold ml-1">Save 5%</span></div>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${academyBilling === 'annual' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                    <input type="radio" name="academy_billing" value="annual" checked={academyBilling === 'annual'} onChange={() => setAcademyBilling('annual')} className="accent-purple-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Annual</span><span className="text-sm font-bold text-primary-700 ml-2">₦93,600/yr</span><span className="text-[10px] text-emerald-600 font-semibold ml-1">Save 10%</span></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mb-3">AI-powered learning pathways, knowledge arena & resource library.</p>
                <button
                  onClick={() => handleAddOnSubscribe('academy')}
                  disabled={addOnPaying === 'academy'}
                  className="w-full bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
                >
                  {addOnPaying === 'academy' ? 'Redirecting...' : 'Subscribe'}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-emerald-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <span className="text-xl">📝</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">QS Exam Prep</h4>
                    <p className="text-xs text-gray-500">Professional exam prep, past questions</p>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${examBilling === 'weekly' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}`}>
                    <input type="radio" name="exam_billing" value="weekly" checked={examBilling === 'weekly'} onChange={() => setExamBilling('weekly')} className="accent-emerald-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Weekly</span><span className="text-sm font-bold text-primary-700 ml-2">₦2,000/wk</span></div>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${examBilling === 'monthly' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}`}>
                    <input type="radio" name="exam_billing" value="monthly" checked={examBilling === 'monthly'} onChange={() => setExamBilling('monthly')} className="accent-emerald-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Monthly</span><span className="text-sm font-bold text-primary-700 ml-2">₦7,600/mo</span><span className="text-[10px] text-emerald-600 font-semibold ml-1">Save 5%</span></div>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${examBilling === 'annual' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}`}>
                    <input type="radio" name="exam_billing" value="annual" checked={examBilling === 'annual'} onChange={() => setExamBilling('annual')} className="accent-emerald-600" />
                    <div className="flex-1"><span className="text-sm font-medium text-gray-900">Annual</span><span className="text-sm font-bold text-primary-700 ml-2">₦93,600/yr</span><span className="text-[10px] text-emerald-600 font-semibold ml-1">Save 10%</span></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mb-3">NIQS, RICS, PMP exams & university past questions with AI explanations.</p>
                <button
                  onClick={() => handleAddOnSubscribe('exam_prep')}
                  disabled={addOnPaying === 'exam_prep'}
                  className="w-full bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {addOnPaying === 'exam_prep' ? 'Redirecting...' : 'Subscribe'}
                </button>
              </div>
            </div>
          </div>
          )}

          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">Secure Payment</h3>
            <p className="text-sm text-blue-700">
              Pay via Card, Bank Transfer, USSD, or Mobile Money through Flutterwave.
              Cancel anytime from your profile settings.
            </p>
          </div>

        </div>

        {/* ── Payment Method Modal ──────────────────────────────── */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <button
                onClick={closePaymentModal}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                ✕
              </button>

              {/* Step 1 - choose method */}
              {!paymentMethod && (
                <div className="p-6">
                  <h2 className="font-display font-bold text-xl text-primary-800 mb-1">Choose Payment Method</h2>
                  <p className="text-sm text-slate-500 mb-6">Select how you&rsquo;d like to pay for the <span className="font-semibold capitalize">{pendingPlan}</span> plan.</p>
                  <div className="space-y-3">
                    {gatewayStatus.flutterwave.configured ? (
                      <button
                        onClick={() => handleSubscribe(plans.find(p => p.name === pendingPlan))}
                        disabled={!!paying}
                        className="w-full flex items-start gap-4 border-2 border-slate-200 hover:border-primary-700 rounded-xl p-4 text-left transition-all group"
                      >
                        <span className="mt-0.5 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100">
                          <svg className="text-blue-600" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">Pay with Card / Bank</span>
                            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Instant</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Pay via Flutterwave - card, bank transfer, USSD, or mobile money. Instant activation.
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full flex items-start gap-4 border-2 border-slate-200 rounded-xl p-4 opacity-60">
                        <span className="mt-0.5 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <svg className="text-slate-400" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-500">Card / Bank Payment</span>
                            <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Online payment is not yet available. Use Direct Bank Transfer below.</p>
                        </div>
                      </div>
                    )}

                    <div className="w-full flex items-start gap-4 border-2 border-slate-200 rounded-xl p-4 opacity-60">
                      <span className="mt-0.5 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <svg className="text-purple-400" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">Pay with Crypto</span>
                          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Bitcoin, USDT, and other cryptocurrencies. Coming soon.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                  <label className="label">Recipient&apos;s Email <span className="text-red-500">*</span></label>
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
                  If the recipient doesn&apos;t have a QSToolkit account yet, the subscription will activate automatically when they register with this email address.
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
