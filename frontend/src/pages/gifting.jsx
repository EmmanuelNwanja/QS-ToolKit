import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { giftingAPI, subscriptionAPI } from '../services/api';
import useAuthStore from '../context/authStore';
import PublicNav from '../components/PublicNav';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   Gifting — public page (guests welcome, e-commerce checkout style)
   - Directory of giftable users (server-redacted: "Emmanuel N.", em***@x.co)
   - Filter by account type · full-email donor lookup · multi-select
   - Auto-select N random recipients · 1 Month/1 Year billing · Flutterwave
   - Anonymous or full donor identity
   ═══════════════════════════════════════════════════════════════ */

const SITE_URL = 'https://qs.solnuv.com';

const FAQS = [
  {
    q: 'What is QSToolkit gifting?',
    a: 'Gifting lets you sponsor a QSToolkit subscription for a student or professional quantity surveyor. One payment activates every recipient you select — instantly and independently.',
  },
  {
    q: 'Who can I gift a subscription to?',
    a: 'Any verified QSToolkit member without an active paid subscription. Browse the public directory (names and emails are privacy-redacted) or paste a full email address to find someone specific.',
  },
  {
    q: 'Can I gift anonymously?',
    a: 'Yes. Tick “Give anonymously” and recipients will simply see “An anonymous donor” — your name, email and company stay private.',
  },
  {
    q: 'How does auto-select work?',
    a: 'Enter how many people you want to sponsor and click Auto-select. We randomly pick that many giftable members from the current directory results, so you can spread opportunity without choosing individuals.',
  },
  {
    q: 'How much does a gift cost?',
    a: 'The price is the normal plan rate — Starter or Pro, billed monthly (1 Month) or yearly (1 Year) — multiplied by the number of recipients. One Flutterwave checkout covers the whole batch.',
  },
  {
    q: 'Do recipients need to do anything to activate the gift?',
    a: 'No. Subscriptions activate automatically the moment your payment succeeds, and each recipient gets an email notification. One failed activation never blocks the others.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'QSToolkit Gift a Subscription',
  serviceType: 'Educational subscription sponsorship',
  url: `${SITE_URL}/gifting`,
  provider: {
    '@type': 'Organization',
    name: 'QSToolkit',
    url: SITE_URL,
  },
  areaServed: [
    { '@type': 'Country', name: 'Nigeria' },
    { '@type': 'Country', name: 'Ghana' },
    { '@type': 'Country', name: 'Kenya' },
    { '@type': 'Country', name: 'South Africa' },
  ],
  offers: {
    '@type': 'Offer',
    priceCurrency: 'NGN',
    description: 'Sponsor Starter or Pro subscriptions for one or many QS practitioners in a single checkout.',
  },
};

const fadeUp = {
  hidden: { opacity: 0.15, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }
  })
};

const ACCOUNT_TYPES = [
  { value: '', label: 'All', icon: '👥' },
  { value: 'student', label: 'Students', icon: '🎓' },
  { value: 'professional', label: 'Professionals', icon: '📐' },
];

function PlanBadge({ plan }) {
  const labels = { basic: 'Starter', student: 'Starter', pro: 'Pro' };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${plan === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
      {labels[plan] || plan}
    </span>
  );
}

function UserCard({ user, selected, onToggle }) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      onClick={() => onToggle(user)}
      className={`text-left rounded-xl border p-4 transition-all duration-200 relative ${
        selected
          ? 'border-gold-500 bg-gold-50 shadow-md ring-1 ring-gold-400'
          : 'border-gray-200 bg-white hover:border-gold-300 hover:shadow-sm'
      }`}
      aria-pressed={selected}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gold-500 text-white text-xs flex items-center justify-center">✓</span>
      )}
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-700 to-primary-900 text-white flex items-center justify-center font-bold text-sm mb-3">
        {user.display_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'}
      </div>
      <p className="font-semibold text-gray-900 text-sm">{user.display_name}</p>
      <p className="text-xs text-gray-400 truncate" title={user.email_masked}>{user.email_masked}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <PlanBadge plan={user.user_type === 'student' ? 'student' : 'pro'} />
        <span className="text-[10px] text-gray-400">
          {user.user_type === 'student' ? (user.university_name || 'Student') : (user.company_name || 'Professional')}
        </span>
      </div>
    </motion.button>
  );
}

export default function GiftingPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Directory state
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [accountType, setAccountType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Email lookup
  const [emailLookup, setEmailLookup] = useState('');
  const [lookupResult, setLookupResult] = useState(null); // {user} | {miss:true}
  const [lookingUp, setLookingUp] = useState(false);

  // Selection + gift config
  const [selected, setSelected] = useState([]); // [{id, display_name, email_masked, _email?}]
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [prices, setPrices] = useState({}); // { planName: {monthly, annual} }

  // Auto-select random recipients
  const [autoSelectCount, setAutoSelectCount] = useState('');
  const [autoSelecting, setAutoSelecting] = useState(false);

  // Donor form
  const [anonymous, setAnonymous] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorTitle, setDonorTitle] = useState('');
  const [donorCompany, setDonorCompany] = useState('');
  const [donorRole, setDonorRole] = useState('');
  const [donorNote, setDonorNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const selectedIds = selected.map(u => u.id);
  const selectedEmails = selected.map(u => u._email).filter(Boolean);

  // Load directory
  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await giftingAPI.directory({ account_type: accountType || undefined, search: search.trim() || undefined, page, limit: 24 });
      setUsers(data?.users || []);
      setTotal(data?.total || 0);
    } catch {
      toast.error('Could not load giftable members. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [accountType, search, page]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  // Plan prices (public endpoint)
  useEffect(() => {
    subscriptionAPI.getPlans().then(({ data }) => {
      const map = {};
      for (const p of data?.plans || []) map[p.name] = { monthly: Number(p.price_monthly), annual: Number(p.price_annual) };
      // student alias → basic price
      if (map.basic && !map.student) map.student = map.basic;
      setPrices(map);
    }).catch(() => {});
  }, []);

  // Pre-fill donor identity for logged-in users
  useEffect(() => {
    if (user) {
      setDonorName(user.name || '');
      setDonorEmail(user.email || '');
    }
  }, [user]);

  // Debounced name search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0); // search handled via loadDirectory dependency
    return () => clearTimeout(t);
  }, [search]);

  // Browser-return from Flutterwave: verify then celebrate
  useEffect(() => {
    if (!router.isReady) return;
    const rawRef = router.query.tx_ref || router.query.reference;
    if (router.query.status === 'return' && rawRef) {
      const reference = String(rawRef).split(',')[0].trim();
      giftingAPI.confirm(reference)
        .then(({ data }) => {
          if (data?.success) {
            toast.success(`🎁 Gift delivered — ${data.activated ?? 0} subscription(s) activated!`);
            setSelected([]);
            setShowSignupPrompt(!user); // guests are nudged to join
          }
        })
        .catch(() => toast.error('We could not verify that payment. Contact support if you were charged.'))
        .finally(() => router.replace('/gifting', undefined, { shallow: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Full-email lookup (donor pastes an address)
  const runLookup = async () => {
    const email = emailLookup.trim();
    if (!email || !email.includes('@')) return;
    setLookingUp(true);
    try {
      const { data } = await giftingAPI.lookupByEmail(email);
      const found = data?.user || null;
      setLookupResult(found ? { user: found, email } : { miss: true, email });
      if (found) addToSelection({ ...found, _email: email });
    } catch {
      setLookupResult({ miss: true, email });
    } finally {
      setLookingUp(false);
    }
  };

  const addToSelection = (user) => {
    setSelected(prev => (prev.some(u => u.id === user.id) ? prev : [...prev, user]));
  };

  const toggleSelection = (user) => {
    setSelected(prev => (prev.some(u => u.id === user.id)
      ? prev.filter(u => u.id !== user.id)
      : [...prev, user]));
  };
  // Donor gifts either plan to any giftable member.
  const [planChoice, setPlanChoice] = useState('basic');
  const planPrice = planChoice === 'pro'
    ? (billingCycle === 'annual' ? prices.pro?.annual : prices.pro?.monthly)
    : (billingCycle === 'annual' ? prices.basic?.annual : prices.basic?.monthly);
  const totalAmount = (planPrice || 0) * selected.length;

  // Auto-select: randomly pick N recipients from the CURRENT directory page
  // (respects the active account-type filter). Never selects the same member
  // twice; shrinks gracefully if fewer members are available.
  const runAutoSelect = () => {
    const count = Math.floor(Number(autoSelectCount));
    if (!count || count < 1) {
      toast.error('Enter how many people you want to sponsor (1 or more)');
      return;
    }
    if (count > 100) {
      toast.error('A single gift is limited to 100 recipients');
      return;
    }
    setAutoSelecting(true);
    // Shuffle a copy of the current page's users (Fisher–Yates) and take N.
    const pool = [...users];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, count);
    setSelected((prev) => {
      const known = new Set(prev.map((u) => u.id));
      const fresh = picks.filter((u) => !known.has(u.id));
      return [...prev, ...fresh];
    });
    if (picks.length < count) {
      toast.success(`Selected ${picks.length} of ${count} requested — only ${picks.length} giftable members on this page. Try another filter or page for more.`);
    } else {
      toast.success(`🎁 ${count} recipients auto-selected`);
    }
    setAutoSelecting(false);
  };

  const startCheckout = async () => {
    if (selected.length === 0) { toast.error('Select at least one person to gift'); return; }
    if (!anonymous && !donorEmail.trim()) { toast.error('Add your email for the receipt, or choose to gift anonymously'); return; }

    setSubmitting(true);
    try {
      const { data } = await giftingAPI.initiate({
        recipient_ids: selectedIds,
        recipient_emails: selectedEmails,
        plan_name: planChoice,
        billing_cycle: billingCycle,
        is_anonymous: anonymous,
        donor_name: anonymous ? undefined : donorName.trim() || undefined,
        donor_email: anonymous ? undefined : donorEmail.trim(),
        donor_title: anonymous ? undefined : donorTitle.trim() || undefined,
        donor_company: anonymous ? undefined : donorCompany.trim() || undefined,
        donor_role: anonymous ? undefined : donorRole.trim() || undefined,
        donor_note: donorNote.trim() || undefined,
      });

      if (data?.success && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        const detail = Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors.map((e) => e.message || e.msg).join('. ')
          : null;
        toast.error(detail || data?.message || 'Could not start checkout');
        setSubmitting(false);
      }
    } catch (err) {
      const apiErrors = err?.response?.data?.errors;
      const detail = Array.isArray(apiErrors) && apiErrors.length > 0
        ? apiErrors.map((e) => e.message || e.msg).join('. ')
        : null;
      toast.error(detail || err?.response?.data?.message || 'Checkout failed. Please try again.');
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <>
      <Head>
        <title>Gift a Subscription | Sponsor a Young QS Professional — QSToolkit</title>
        <meta name="description" content="Sponsor a QSToolkit subscription for a student or professional quantity surveyor in Nigeria. Auto-select multiple recipients, gift 1 Month or 1 Year of Starter or Pro, and stay anonymous if you prefer. Instant activation." />
        <meta name="keywords" content="gift subscription, sponsor a student, quantity surveyor Nigeria, QS donation, QSToolkit gift, NIQS support, pay it forward QS" />
        <link rel="canonical" href={`${SITE_URL}/gifting`} />
        <meta name="robots" content="index, follow, max-image-preview:large" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Gift a Subscription | Sponsor a Young QS Professional — QSToolkit" />
        <meta property="og:description" content="One payment can change a young quantity surveyor's career. Sponsor one person or many — instantly activated, anonymous option available." />
        <meta property="og:url" content={`${SITE_URL}/gifting`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.svg`} />
        <meta property="og:image:alt" content="Gift a QSToolkit subscription" />
        <meta property="og:site_name" content="QSToolkit" />
        <meta property="og:locale" content="en_NG" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Gift a Subscription | Sponsor a Young QS Professional — QSToolkit" />
        <meta name="twitter:description" content="Sponsor one or many QS practitioners with a single checkout. Instant activation, anonymous option." />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.svg`} />

        {/* GEO: AI-answer-engine structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <PublicNav />

        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white">
          <div className="max-w-7xl mx-auto px-4 py-14 md:py-20">
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
              <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-3">Pay it forward</p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Gift a subscription to a<br className="hidden md:block" /> young QS professional
              </h1>
              <p className="mt-4 text-primary-100 max-w-2xl text-sm md:text-base">
                Sponsor one person or many at once. Choose monthly or annual support, add a note of
                encouragement, and stay anonymous if you prefer. Every gift activates instantly after payment.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.15} className="mt-8 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2"><span className="text-gold-400 text-lg">🎁</span> One payment, many recipients</div>
              <div className="flex items-center gap-2"><span className="text-gold-400 text-lg">⚡</span> Instant activation</div>
              <div className="flex items-center gap-2"><span className="text-gold-400 text-lg">🕶️</span> Anonymous option</div>
            </motion.div>
          </div>
        </section>

        {/* ── Directory + summary ── */}
        <section className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {ACCOUNT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setAccountType(t.value); setPage(1); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${accountType === t.value ? 'bg-primary-800 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by display name…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none"
              />
            </div>

            {/* Auto-select random recipients */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">Not sure who to sponsor?</p>
                <p className="text-xs text-gray-400 mt-0.5">Tell us how many people to support and we&rsquo;ll randomly pick giftable members from the results below.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={autoSelectCount}
                  onChange={(e) => setAutoSelectCount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAutoSelect()}
                  placeholder="No. of recipients"
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400"
                />
                <button
                  type="button"
                  onClick={runAutoSelect}
                  disabled={autoSelecting || loading || users.length === 0}
                  className="btn-primary text-xs px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
                >
                  {autoSelecting ? 'Selecting…' : '🎲 Auto-select'}
                </button>
              </div>
            </div>

            {/* Email lookup strip */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-700 mb-2">Know someone&rsquo;s email? Paste it to find them</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailLookup}
                  onChange={(e) => setEmailLookup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runLookup()}
                  placeholder="emmanuel.n@architecture.co"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400"
                />
                <button type="button" onClick={runLookup} disabled={lookingUp || !emailLookup.trim()}
                  className="btn-primary text-xs px-4 py-2 rounded-lg disabled:opacity-50">
                  {lookingUp ? 'Searching…' : 'Find'}
                </button>
              </div>
              {lookupResult?.miss && (
                <p className="text-xs text-gray-400 mt-2">
                  No giftable member matches that email right now — they may already have an active subscription.
                </p>
              )}
              {lookupResult?.user && (
                <p className="text-xs text-emerald-600 mt-2">✓ Found and added: {lookupResult.user.display_name}</p>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🎁</p>
                <p className="text-sm">No giftable members found for this filter.</p>
              </div>
            ) : (
              <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {users.map(u => (
                  <UserCard key={u.id} user={u} selected={selected.some(s => s.id === u.id)} onToggle={() => toggleSelection(u)} />
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1.5 text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>

          {/* ── Sticky summary / checkout ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Your gift</h2>
              <p className="text-xs text-gray-400 mb-4">{selected.length} {selected.length === 1 ? 'person' : 'people'} selected</p>

              {selected.length > 0 && (
                <ul className="space-y-1.5 mb-4 max-h-32 overflow-y-auto">
                  {selected.map(u => (
                    <li key={u.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                      <span className="truncate">{u.display_name}</span>
                      <button type="button" onClick={() => toggleSelection(u)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Plan */}
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subscription</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button type="button" onClick={() => setPlanChoice('basic')}
                  className={`border rounded-lg px-3 py-2 text-xs font-medium ${planChoice === 'basic' ? 'border-gold-500 bg-gold-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                  Starter
                </button>
                <button type="button" onClick={() => setPlanChoice('pro')}
                  className={`border rounded-lg px-3 py-2 text-xs font-medium ${planChoice === 'pro' ? 'border-gold-500 bg-gold-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                  Pro
                </button>
              </div>

              {/* Cycle */}
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Billing</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button type="button" onClick={() => setBillingCycle('monthly')}
                  className={`border rounded-lg px-3 py-2 text-xs font-medium ${billingCycle === 'monthly' ? 'border-gold-500 bg-gold-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                  1 Month
                </button>
                <button type="button" onClick={() => setBillingCycle('annual')}
                  className={`border rounded-lg px-3 py-2 text-xs font-medium ${billingCycle === 'annual' ? 'border-gold-500 bg-gold-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                  1 Year <span className="text-emerald-600">−12%</span>
                </button>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mb-4">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-xl font-bold text-gray-900">₦{totalAmount.toLocaleString()}</span>
              </div>

              <button
                type="button"
                onClick={startCheckout}
                disabled={submitting || selected.length === 0 || !planPrice}
                className="btn-gold w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Starting checkout…' : `🎁 Gift ${selected.length > 0 ? `${selected.length} ${selected.length === 1 ? 'subscription' : 'subscriptions'}` : ''}`}
              </button>

              {!user && (
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  New here?{' '}
                  <Link href="/auth/register" className="text-primary-700 font-medium hover:underline">Create a free account</Link>
                  {' '}to gift as yourself and track it — or continue as a guest.
                </p>
              )}
            </div>

            {/* Donor identity */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Your identity</h3>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="accent-gold-500" />
                  Give anonymously
                </label>
              </div>
              {anonymous ? (
                <p className="text-xs text-gray-400">Recipients will see &ldquo;An anonymous donor&rdquo; — your details stay private.</p>
              ) : (
                <div className="space-y-2.5">
                  <input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Full name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400" />
                  <input value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} type="email" placeholder="Email (for your receipt)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={donorTitle} onChange={(e) => setDonorTitle(e.target.value)} placeholder="Title (e.g. MNIQS)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400" />
                    <input value={donorRole} onChange={(e) => setDonorRole(e.target.value)} placeholder="Role" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400" />
                  </div>
                  <input value={donorCompany} onChange={(e) => setDonorCompany(e.target.value)} placeholder="Company" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400" />
                  <textarea value={donorNote} onChange={(e) => setDonorNote(e.target.value)} rows={3}
                    placeholder="Why I chose to support young QS professionals…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── FAQ (matches FAQPage JSON-LD for AI answer engines) ── */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <h2 className="text-xl md:text-2xl font-bold text-primary-900 mb-6 text-center">Gifting FAQs</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group bg-white border border-gray-200 rounded-xl px-4 py-3">
                <summary className="text-sm font-semibold text-gray-800 cursor-pointer list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-300 group-open:rotate-45 transition-transform">＋</span>
                </summary>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="bg-primary-900 border-t border-white/5 py-10 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">© {new Date().getFullYear()} QSToolkit — Built by Fudo Greentech Ltd.</p>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
              <Link href="/auth/register" className="hover:text-white transition-colors">Create account</Link>
            </div>
          </div>
        </footer>

        {/* Signup prompt modal after successful guest gifting */}
        {showSignupPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSignupPrompt(false)}>
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-4xl mb-2">🎉</p>
              <h3 className="font-bold text-gray-900 mb-1">Your gift is live!</h3>
              <p className="text-sm text-gray-500 mb-5">Create a free account to gift again easily, follow your impact, and access QS tools yourself.</p>
              <div className="flex flex-col gap-2">
                <Link href="/auth/register" className="btn-gold py-2 rounded-lg text-sm font-semibold">Create free account</Link>
                <button type="button" onClick={() => setShowSignupPrompt(false)} className="text-xs text-gray-400 hover:text-gray-600 py-1">Continue browsing</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
