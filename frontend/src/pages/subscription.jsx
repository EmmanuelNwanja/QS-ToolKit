import { useEffect, useState, useRef } from 'react';
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

  const [promoInputs, setPromoInputs]   = useState({});
  const [promoResults, setPromoResults] = useState({});
  const [promoLoading, setPromoLoading] = useState({});

  // Payment method modal
  const [pendingPlan, setPendingPlan]       = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod]   = useState(null);
  const [bankSettings, setBankSettings]     = useState(null);
  const [bankSettingsLoading, setBankSettingsLoading] = useState(false);
  const [transferRef, setTransferRef]       = useState('');
  const [transferFile, setTransferFile]     = useState(null);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferDone, setTransferDone]     = useState(false);
  const fileInputRef = useRef(null);

  // Add-on bank transfer state
  const [addOnModal, setAddOnModal]         = useState(null); // 'academy' | 'exam_prep' | null
  const [addOnBankSettings, setAddOnBankSettings] = useState(null);
  const [addOnBankLoading, setAddOnBankLoading] = useState(false);
  const [addOnTransferRef, setAddOnTransferRef] = useState('');
  const [addOnTransferDone, setAddOnTransferDone] = useState(false);
  const [addOnSubmitting, setAddOnSubmitting] = useState(false);

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
      subscriptionAPI.getMy()
    ]).then(([p, s]) => {
      if (p.status === 'fulfilled') {
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
    const reference = router.query.reference || router.query.trxref;
    if (!reference || Array.isArray(reference)) return;

    subscriptionAPI.verify(reference).then(async () => {
      toast.success('Subscription activated!');
      await refreshUser();
      await fetchMySub();
      router.replace('/dashboard');
    }).catch(() => toast.error('Payment verification failed. Please contact support.'));
  }, [router.isReady, router.query.reference, router.query.trxref]);

  // Fetch bank settings when user picks bank_transfer
  useEffect(() => {
    if (paymentMethod !== 'bank_transfer') return;
    setBankSettingsLoading(true);
    subscriptionAPI.getBankTransferSettings()
      .then(r => setBankSettings(r.data.data || null))
      .catch(() => setBankSettings(null))
      .finally(() => setBankSettingsLoading(false));
  }, [paymentMethod]);

  // Fetch bank settings for add-on modal
  useEffect(() => {
    if (!addOnModal) return;
    setAddOnBankLoading(true);
    const api = addOnModal === 'academy' ? academyAPI : examAPI;
    api.getBankTransferSettings()
      .then(r => setAddOnBankSettings(r.data.data || null))
      .catch(() => setAddOnBankSettings(null))
      .finally(() => setAddOnBankLoading(false));
  }, [addOnModal]);

  async function handleAddOnBankTransfer() {
    if (!addOnTransferRef.trim()) { toast.error('Please enter your bank transaction reference'); return; }
    setAddOnSubmitting(true);
    try {
      const api = addOnModal === 'academy' ? academyAPI : examAPI;
      await api.submitBankTransfer({ referenceNote: addOnTransferRef.trim() });
      setAddOnTransferDone(true);
      toast.success('Submission received! An admin will verify and activate your subscription within 24 hours.');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setAddOnSubmitting(false);
    }
  }

  function closeAddOnModal() {
    setAddOnModal(null);
    setAddOnBankSettings(null);
    setAddOnTransferRef('');
    setAddOnTransferDone(false);
    setAddOnSubmitting(false);
  }

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
    setTransferRef('');
    setTransferFile(null);
    setTransferDone(false);
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPendingPlan(null);
    setPaymentMethod(null);
    setPaying('');
  }

  function getPendingPlanPrice() {
    const plan = plans.find(p => p.name === pendingPlan);
    if (!plan) return 0;
    const promo = promoResults[pendingPlan];
    if (promo?.discount_percent) {
      const base = billing === 'annual' ? (plan.price_annual || Math.round(plan.price_monthly * 12 * 0.90)) : plan.price_monthly;
      return base * (1 - promo.discount_percent / 100);
    }
    return billing === 'annual' ? (plan.price_annual || Math.round(plan.price_monthly * 12 * 0.90)) : plan.price_monthly;
  }

  async function handleBankTransferSubmit() {
    if (!transferRef.trim()) { toast.error('Please enter your bank transaction reference'); return; }
    const amount = getPendingPlanPrice();
    if (!amount) { toast.error('Could not determine plan amount'); return; }

    setSubmittingTransfer(true);
    try {
      const formData = new FormData();
      formData.append('planName', pendingPlan);
      formData.append('billingInterval', billing);
      formData.append('amountNgn', String(amount));
      formData.append('referenceNote', transferRef.trim());
      if (transferFile) {
        formData.append('receipt', transferFile, transferFile.name);
      }
      await subscriptionAPI.submitBankTransfer(formData);
      setTransferDone(true);
      toast.success('Submission received! An admin will verify and activate your plan within 24 hours.');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmittingTransfer(false);
    }
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

  return (
    <ProtectedRoute>
      <Head>
        <title>Subscription & Plans — QSToolkit</title>
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
                    Renews / Expires: {new Date(mySub.expires_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
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
                              ✅ {promoResults[plan.name].discount_percent}% off — {promoResults[plan.name].description}
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

          {/* Add-on Cards */}
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
                <p className="text-2xl font-bold text-primary-700 mb-1">₦2,000<span className="text-sm font-normal text-gray-400">/week</span></p>
                <p className="text-sm text-gray-500 mb-3">AI-powered learning pathways, knowledge arena & resource library.</p>
                <button
                  onClick={() => setAddOnModal('academy')}
                  className="w-full bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Subscribe
                </button>
                <button
                  onClick={() => setAddOnModal('academy')}
                  className="w-full text-xs text-purple-600 hover:text-purple-700 font-medium py-1.5 mt-1.5 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Pay via Bank Transfer
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
                <p className="text-2xl font-bold text-primary-700 mb-1">₦2,000<span className="text-sm font-normal text-gray-400">/week</span></p>
                <p className="text-sm text-gray-500 mb-3">NIQS, RICS, PMP exams & university past questions with AI explanations.</p>
                <button
                  onClick={() => setAddOnModal('exam_prep')}
                  className="w-full bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Subscribe
                </button>
                <button
                  onClick={() => setAddOnModal('exam_prep')}
                  className="w-full text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1.5 mt-1.5 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Pay via Bank Transfer
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">Secure Nigerian Payment</h3>
            <p className="text-sm text-blue-700">
              Pay via Direct Bank Transfer (active) or Paystack (coming soon). All prices in Nigerian Naira.
              Annual plans save 10% vs monthly billing. Subscriptions auto-renew. Cancel anytime from your profile settings.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Promo discounts apply to the first successful charge. Recurring renewals continue at the mapped Paystack plan price for your selected billing cycle.
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

              {/* Step 1 — choose method */}
              {!paymentMethod && (
                <div className="p-6">
                  <h2 className="font-display font-bold text-xl text-primary-800 mb-1">Choose Payment Method</h2>
                  <p className="text-sm text-slate-500 mb-6">Select how you&rsquo;d like to pay for the <span className="font-semibold capitalize">{pendingPlan}</span> plan.</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className="w-full flex items-start gap-4 border-2 border-slate-200 hover:border-primary-700 rounded-xl p-4 text-left transition-all group"
                    >
                      <span className="mt-0.5 w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100">
                        <svg className="text-emerald-600" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">Direct Bank Transfer</span>
                          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Recommended</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Transfer directly to our bank account and upload your receipt. Plan activates within 24 hours of admin review.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => router.push('/payment-coming-soon')}
                      className="w-full flex items-start gap-4 border-2 border-slate-200 hover:border-slate-300 rounded-xl p-4 text-left transition-all group opacity-75 cursor-pointer"
                    >
                      <span className="mt-0.5 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg className="text-blue-400" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">Paystack</span>
                          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Online card and USSD payment via Paystack. Currently unavailable — use Direct Bank Transfer.</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — bank transfer form */}
              {paymentMethod === 'bank_transfer' && !transferDone && (
                <div className="p-6">
                  <button onClick={() => setPaymentMethod(null)} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1">← Back</button>
                  <h2 className="font-display font-bold text-xl text-primary-800 mb-1">Bank Transfer Details</h2>
                  <p className="text-sm text-slate-500 mb-5">
                    Transfer <span className="font-semibold text-slate-800">₦{Number(getPendingPlanPrice()).toLocaleString('en-NG')}</span> to the account below, then upload your receipt.
                  </p>

                  {bankSettingsLoading && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" /></div>}

                  {!bankSettingsLoading && bankSettings?.is_active === false && (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Direct bank transfer is temporarily unavailable. Please contact support@qs.solnuv.com.</p>
                  )}

                  {!bankSettingsLoading && bankSettings?.is_active !== false && bankSettings && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm border border-slate-200">
                      {bankSettings.bank_name && (
                        <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-semibold text-slate-800">{bankSettings.bank_name}</span></div>
                      )}
                      {bankSettings.account_number && (
                        <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800 text-base tracking-widest">{bankSettings.account_number}</span></div>
                      )}
                      {bankSettings.account_name && (
                        <div className="flex justify-between"><span className="text-slate-500">Account Name</span><span className="font-semibold text-slate-800">{bankSettings.account_name}</span></div>
                      )}
                      {bankSettings.additional_instructions && (
                        <p className="text-slate-500 pt-2 border-t border-slate-200 text-xs">{bankSettings.additional_instructions}</p>
                      )}
                    </div>
                  )}

                  {!bankSettingsLoading && !bankSettings && (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Bank account details are not configured yet. Please contact support@qs.solnuv.com.</p>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference / Narration <span className="text-red-500">*</span></label>
                      <input
                        value={transferRef}
                        onChange={e => setTransferRef(e.target.value)}
                        placeholder="e.g. Bank teller ID or transfer narration"
                        className="input w-full"
                      />
                      <p className="text-xs text-slate-400 mt-1">Enter the reference or narration from your bank receipt to help us match the payment.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Receipt <span className="text-slate-400 font-normal">(optional)</span></label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-primary-700 transition-colors"
                      >
                        <svg className="text-slate-400" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                        {transferFile
                          ? <span className="text-sm text-slate-700 font-medium">{transferFile.name}</span>
                          : <><span className="text-sm text-slate-500">Click to upload receipt</span><span className="text-xs text-slate-400">PNG, JPG, or PDF — max 5 MB</span></>}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f && f.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); e.target.value = ''; return; }
                          setTransferFile(f || null);
                        }}
                      />
                    </div>

                    <button
                      onClick={handleBankTransferSubmit}
                      disabled={submittingTransfer || bankSettings?.is_active === false}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {submittingTransfer ? 'Submitting...' : 'Submit for Verification'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — success */}
              {paymentMethod === 'bank_transfer' && transferDone && (
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="text-emerald-600" width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="font-display font-bold text-xl text-primary-800 mb-2">Submission Received!</h2>
                  <p className="text-sm text-slate-600 mb-6">Your payment proof has been submitted. An admin will review and activate your <span className="font-semibold capitalize">{pendingPlan}</span> plan within 24 hours.</p>
                  <button onClick={closePaymentModal} className="btn-primary w-full py-3">Done</button>
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

      {/* ── Add-on Bank Transfer Modal ─────────────────────────── */}
      {addOnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeAddOnModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Close"
            >
              ✕
            </button>

            {!addOnTransferDone && (
              <div className="p-6">
                <h2 className="font-display font-bold text-xl text-primary-800 mb-1">Bank Transfer Details</h2>
                <p className="text-sm text-slate-500 mb-5">
                  Transfer <span className="font-semibold text-slate-800">₦2,000</span> to the account below for the{' '}
                  <span className="font-semibold capitalize">{addOnModal === 'academy' ? 'QS Academy' : 'QS Exam Prep'}</span> weekly subscription.
                </p>

                {addOnBankLoading && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" /></div>}

                {!addOnBankLoading && addOnBankSettings?.is_active === false && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Direct bank transfer is temporarily unavailable. Please contact support@qs.solnuv.com.</p>
                )}

                {!addOnBankLoading && addOnBankSettings?.is_active !== false && addOnBankSettings && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm border border-slate-200">
                    {addOnBankSettings.bank_name && (
                      <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-semibold text-slate-800">{addOnBankSettings.bank_name}</span></div>
                    )}
                    {addOnBankSettings.account_number && (
                      <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800 text-base tracking-widest">{addOnBankSettings.account_number}</span></div>
                    )}
                    {addOnBankSettings.account_name && (
                      <div className="flex justify-between"><span className="text-slate-500">Account Name</span><span className="font-semibold text-slate-800">{addOnBankSettings.account_name}</span></div>
                    )}
                    {addOnBankSettings.additional_instructions && (
                      <p className="text-slate-500 pt-2 border-t border-slate-200 text-xs">{addOnBankSettings.additional_instructions}</p>
                    )}
                  </div>
                )}

                {!addOnBankLoading && !addOnBankSettings && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Bank account details are not configured yet. Please contact support@qs.solnuv.com.</p>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference / Narration <span className="text-red-500">*</span></label>
                    <input
                      value={addOnTransferRef}
                      onChange={e => setAddOnTransferRef(e.target.value)}
                      placeholder="e.g. Bank teller ID or transfer narration"
                      className="input w-full"
                    />
                    <p className="text-xs text-slate-400 mt-1">Enter the reference or narration from your bank receipt to help us match the payment.</p>
                  </div>

                  <button
                    onClick={handleAddOnBankTransfer}
                    disabled={addOnSubmitting || addOnBankSettings?.is_active === false}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {addOnSubmitting ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                </div>
              </div>
            )}

            {addOnTransferDone && (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="text-emerald-600" width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="font-display font-bold text-xl text-primary-800 mb-2">Submission Received!</h2>
                <p className="text-sm text-slate-600 mb-6">Your payment proof has been submitted. An admin will review and activate your <span className="font-semibold capitalize">{addOnModal === 'academy' ? 'QS Academy' : 'QS Exam Prep'}</span> subscription within 24 hours.</p>
                <button onClick={closeAddOnModal} className="btn-primary w-full py-3">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

    </ProtectedRoute>
  );
}
