import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  Row, Col, Card, Avatar, Tag, Segmented, Input, InputNumber, Skeleton, Space,
  Button, Checkbox, Pagination, Collapse, Empty, Modal, Statistic, Typography, ConfigProvider,
} from 'antd';
import {
  SearchOutlined, ThunderboltOutlined, EyeInvisibleOutlined, GiftOutlined,
  AimOutlined, CloseOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { giftingAPI, subscriptionAPI } from '../services/api';
import useAuthStore from '../context/authStore';
import PublicNav from '../components/PublicNav';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   Gifting - public page (guests welcome, e-commerce checkout style)
   Directory of privacy-redacted members · full-email lookup ·
   multi-select or auto-select · Starter/Pro · 1 Month/1 Year ·
   anonymous or named donor · Flutterwave checkout
   UI: antd components + Tailwind layout utilities
   ═══════════════════════════════════════════════════════════════ */

const { Text } = Typography;

const SITE_URL = 'https://qs.solnuv.com';

const FAQS = [
  {
    q: 'What is QSToolkit gifting?',
    a: 'You sponsor a QSToolkit subscription for a student or professional QS. One payment activates every recipient you select - instantly.',
  },
  {
    q: 'Who can I gift to?',
    a: 'Any verified member without an active subscription. Browse the privacy-redacted directory, or search by full email.',
  },
  {
    q: 'Can I gift anonymously?',
    a: 'Yes. Recipients see “An anonymous donor” - your details stay private.',
  },
  {
    q: 'How does auto-select work?',
    a: 'Enter a number and we randomly pick that many giftable members from your current results.',
  },
  {
    q: 'How much does a gift cost?',
    a: 'The normal plan rate - Starter or Pro, 1 Month or 1 Year - times the number of recipients. One checkout covers the batch.',
  },
  {
    q: 'Do recipients need to do anything?',
    a: 'No. Gifts activate the moment payment succeeds, and each recipient is emailed. One failed activation never blocks the rest.',
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
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

const ACCOUNT_TYPES = [
  { value: '', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'professional', label: 'Professionals' },
];

/* Gold CTA on demand: the app theme's primary is navy (see _app.jsx). */
const GoldProvider = ({ children }) => (
  <ConfigProvider theme={{ token: { colorPrimary: '#d97706' } }}>{children}</ConfigProvider>
);

function PlanTag({ plan }) {
  return (
    <Tag color={plan === 'pro' ? 'gold' : 'geekblue'} style={{ marginInlineEnd: 0 }}>
      {plan === 'pro' ? 'Pro' : 'Starter'}
    </Tag>
  );
}

function UserCard({ user, selected, onToggle }) {
  const initials = user.display_name?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '?';
  return (
    <motion.div variants={fadeUp}>
      <Card
        hoverable
        size="small"
        onClick={() => onToggle(user)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(user); }
        }}
        role="button"
        aria-pressed={selected}
        tabIndex={0}
        className={selected ? 'border-gold-500 ring-1 ring-gold-400' : ''}
      >
        {selected && (
          <CheckCircleFilled className="absolute top-2 right-2 z-10 text-gold-500" aria-label="Selected" />
        )}
        <div className="flex items-start gap-3">
          <Avatar size={44} style={{ backgroundColor: '#1a3c5e', fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Text strong ellipsis className="block text-sm">{user.display_name}</Text>
            <Text type="secondary" ellipsis className="block text-xs" title={user.email_masked}>
              {user.email_masked}
            </Text>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <PlanTag plan={user.user_type === 'student' ? 'student' : 'pro'} />
              <Text type="secondary" ellipsis className="text-[11px]" style={{ maxWidth: 140 }}>
                {user.user_type === 'student' ? (user.university_name || 'Student') : (user.company_name || 'Professional')}
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
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

  const selectedIds = selected.map((u) => u.id);
  const selectedEmails = selected.map((u) => u._email).filter(Boolean);

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

  // Browser-return from Flutterwave: verify then celebrate
  useEffect(() => {
    if (!router.isReady) return;
    const rawRef = router.query.tx_ref || router.query.reference;
    if (router.query.status === 'return' && rawRef) {
      const reference = String(rawRef).split(',')[0].trim();
      giftingAPI.confirm(reference)
        .then(({ data }) => {
          if (data?.success) {
            toast.success(`🎁 Gift delivered - ${data.activated ?? 0} subscription(s) activated!`);
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
  const runLookup = async (value) => {
    const email = (value ?? emailLookup).trim();
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
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
  };

  const toggleSelection = (user) => {
    setSelected((prev) => (prev.some((u) => u.id === user.id)
      ? prev.filter((u) => u.id !== user.id)
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
      toast.success(`Selected ${picks.length} of ${count} requested - only ${picks.length} giftable members on this page. Try another filter or page for more.`);
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
        <title>Gift a Subscription | Sponsor a Young QS Professional - QSToolkit</title>
        <meta name="description" content="Sponsor a QSToolkit subscription for a young quantity surveyor in Nigeria. One checkout covers one person or many, with instant activation and an anonymous option." />
        <link rel="canonical" href={`${SITE_URL}/gifting`} />
        <meta name="robots" content="index, follow, max-image-preview:large" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Gift a Subscription | Sponsor a Young QS Professional - QSToolkit" />
        <meta property="og:description" content="One payment can change a young quantity surveyor's career. Sponsor one or many - instant activation, anonymous if you prefer." />
        <meta property="og:url" content={`${SITE_URL}/gifting`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:alt" content="Gift a QSToolkit subscription" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="QSToolkit" />
        <meta property="og:locale" content="en_NG" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Gift a Subscription | Sponsor a Young QS Professional - QSToolkit" />
        <meta name="twitter:description" content="Sponsor one or many QS practitioners with a single checkout. Instant activation, anonymous option." />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

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
                Sponsor one person or many. Monthly or annual, a note of encouragement,
                anonymous if you prefer - every gift activates instantly.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.15} className="mt-8 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2"><GiftOutlined className="text-gold-400 text-lg" /> One payment, many recipients</div>
              <div className="flex items-center gap-2"><ThunderboltOutlined className="text-gold-400 text-lg" /> Instant activation</div>
              <div className="flex items-center gap-2"><EyeInvisibleOutlined className="text-gold-400 text-lg" /> Anonymous option</div>
            </motion.div>
          </div>
        </section>

        {/* ── Directory + summary ── */}
        <section className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div>
            {/* Toolbar: filter · search · email lookup · auto-select */}
            <Card size="small" className="mb-6">
              <Row gutter={[12, 12]}>
                <Col xs={24} md={9}>
                  <Segmented
                    block
                    value={accountType}
                    onChange={(v) => { setAccountType(v); setPage(1); }}
                    options={ACCOUNT_TYPES}
                  />
                </Col>
                <Col xs={24} md={15}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by display name…"
                  />
                </Col>
                <Col xs={24} md={14}>
                  <Input.Search
                    type="email"
                    allowClear
                    enterButton="Find"
                    value={emailLookup}
                    onChange={(e) => setEmailLookup(e.target.value)}
                    onSearch={runLookup}
                    loading={lookingUp}
                    placeholder="Know their email? Paste it to find them"
                  />
                </Col>
                <Col xs={24} md={10}>
                  <Space.Compact className="w-full">
                    <InputNumber
                      min={1}
                      max={100}
                      value={autoSelectCount}
                      onChange={setAutoSelectCount}
                      onPressEnter={runAutoSelect}
                      placeholder="No. of recipients"
                      style={{ width: '45%' }}
                    />
                    <Button
                      icon={<AimOutlined />}
                      onClick={runAutoSelect}
                      loading={autoSelecting}
                      disabled={loading || users.length === 0}
                    >
                      Auto-select
                    </Button>
                  </Space.Compact>
                </Col>
                {(lookupResult?.miss || lookupResult?.user) && (
                  <Col span={24}>
                    {lookupResult?.miss && (
                      <Text type="secondary" className="text-xs">
                        No giftable member matches that email - they may already have an active subscription.
                      </Text>
                    )}
                    {lookupResult?.user && (
                      <Text type="success" className="text-xs">
                        ✓ Found and added: {lookupResult.user.display_name}
                      </Text>
                    )}
                  </Col>
                )}
              </Row>
            </Card>

            {/* Grid */}
            {loading ? (
              <Row gutter={[16, 16]}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Col xs={24} sm={12} xl={8} key={i}>
                    <Card size="small">
                      <Skeleton active title={false} paragraph={{ rows: 2 }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : users.length === 0 ? (
              <Card>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No giftable members found for this filter." />
              </Card>
            ) : (
              <motion.div
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
                initial="hidden"
                animate="visible"
              >
                <Row gutter={[16, 16]}>
                  {users.map((u) => (
                    <Col xs={24} sm={12} xl={8} key={u.id}>
                      <UserCard
                        user={u}
                        selected={selected.some((s) => s.id === u.id)}
                        onToggle={() => toggleSelection(u)}
                      />
                    </Col>
                  ))}
                </Row>
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <Pagination
                  current={page}
                  pageSize={24}
                  total={total}
                  onChange={(p) => setPage(p)}
                  showSizeChanger={false}
                />
              </div>
            )}
          </div>

          {/* ── Sticky summary / checkout ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card
              title={<span className="text-sm font-semibold text-gray-900">Your gift</span>}
              extra={<Text type="secondary" className="text-xs">{selected.length} {selected.length === 1 ? 'person' : 'people'}</Text>}
            >
              {selected.length > 0 && (
                <ul className="space-y-1.5 mb-4 max-h-32 overflow-y-auto">
                  {selected.map((u) => (
                    <li key={u.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                      <span className="truncate">{u.display_name}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelection(u)}
                        className="text-red-400 hover:text-red-600 ml-2"
                        aria-label={`Remove ${u.display_name}`}
                      >
                        <CloseOutlined style={{ fontSize: 11 }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs font-semibold text-gray-700 mb-1.5">Subscription</p>
              <Segmented
                block
                value={planChoice}
                onChange={(v) => setPlanChoice(v)}
                options={[
                  { label: 'Starter', value: 'basic' },
                  { label: 'Pro', value: 'pro' },
                ]}
                className="mb-3"
              />

              <p className="text-xs font-semibold text-gray-700 mb-1.5">Billing</p>
              <Segmented
                block
                value={billingCycle}
                onChange={(v) => setBillingCycle(v)}
                options={[
                  { label: '1 Month', value: 'monthly' },
                  { label: '1 Year −12%', value: 'annual' },
                ]}
                className="mb-4"
              />

              <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-4">
                <Text type="secondary">Total</Text>
                <Statistic
                  value={totalAmount}
                  formatter={(v) => `₦${Number(v || 0).toLocaleString()}`}
                  valueStyle={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
                />
              </div>

              <GoldProvider>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<GiftOutlined />}
                  onClick={startCheckout}
                  loading={submitting}
                  disabled={selected.length === 0 || !planPrice}
                >
                  {selected.length > 0
                    ? `Gift ${selected.length} ${selected.length === 1 ? 'subscription' : 'subscriptions'}`
                    : 'Gift a subscription'}
                </Button>
              </GoldProvider>

              {!user && (
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  New here?{' '}
                  <Link href="/auth/register" className="text-primary-700 font-medium hover:underline">Create a free account</Link>
                  {' '}to gift as yourself and track it - or continue as a guest.
                </p>
              )}
            </Card>

            {/* Donor identity */}
            <Card
              title={<span className="text-sm font-semibold text-gray-900">Your identity</span>}
              extra={
                <Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="text-xs">
                  Give anonymously
                </Checkbox>
              }
            >
              {anonymous ? (
                <Text type="secondary" className="text-xs">
                  Recipients will see “An anonymous donor” - your details stay private.
                </Text>
              ) : (
                <div className="space-y-2.5">
                  <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Full name" />
                  <Input value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} type="email" placeholder="Email (for your receipt)" />
                  <Row gutter={8}>
                    <Col span={12}><Input value={donorTitle} onChange={(e) => setDonorTitle(e.target.value)} placeholder="Title (e.g. MNIQS)" /></Col>
                    <Col span={12}><Input value={donorRole} onChange={(e) => setDonorRole(e.target.value)} placeholder="Role" /></Col>
                  </Row>
                  <Input value={donorCompany} onChange={(e) => setDonorCompany(e.target.value)} placeholder="Company" />
                  <Input.TextArea
                    value={donorNote}
                    onChange={(e) => setDonorNote(e.target.value)}
                    rows={3}
                    placeholder="A note of encouragement (optional)…"
                  />
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* ── FAQ (matches FAQPage JSON-LD for AI answer engines) ── */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <h2 className="text-xl md:text-2xl font-bold text-primary-900 mb-6 text-center">Gifting FAQs</h2>
          <Collapse
            items={FAQS.map((f) => ({
              key: f.q,
              label: <span className="text-sm font-semibold text-gray-800">{f.q}</span>,
              children: <p className="text-sm text-gray-500 leading-relaxed m-0">{f.a}</p>,
            }))}
          />
        </section>

        {/* ── Footer ── */}
        <footer className="bg-primary-900 border-t border-white/5 py-10 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">© {new Date().getFullYear()} QSToolkit - Built by Fudo Greentech Ltd.</p>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
              <Link href="/auth/register" className="hover:text-white transition-colors">Create account</Link>
            </div>
          </div>
        </footer>

        {/* Signup prompt modal after successful guest gifting */}
        <Modal
          open={showSignupPrompt}
          onCancel={() => setShowSignupPrompt(false)}
          footer={null}
          centered
          width={380}
        >
          <div className="text-center py-2">
            <p className="text-4xl mb-2">🎉</p>
            <h3 className="font-bold text-gray-900 mb-1">Your gift is live!</h3>
            <p className="text-sm text-gray-500 mb-5">Create a free account to track your gifts and use QSToolkit yourself.</p>
            <div className="flex flex-col gap-2">
              <Link href="/auth/register" className="btn-gold py-2 rounded-lg text-sm font-semibold">Create free account</Link>
              <Button type="text" size="small" onClick={() => setShowSignupPrompt(false)}>Continue browsing</Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
