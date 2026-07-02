import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0.15, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }
  })
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 }
  }
};

const scaleIn = {
  hidden: { opacity: 0.2, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: 'GH₵' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', symbol: 'USh' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', symbol: 'CFA' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
];

const DEFAULT_PLANS = [
  {
    name: 'Starter',
    price: '₦8,999',
    amount: 8999,
    period: '/month',
    desc: 'For students and entry-level QSs getting started.',
    features: ['2 projects/month', '30 calculator uses', '2 BOQs', '2 invoices & quotes', 'PDF & Excel exports', '1 user, 1 device']
  },
  {
    name: 'Pro',
    price: '₦23,999',
    amount: 23999,
    period: '/month',
    desc: 'For practicing professionals who need more volume.',
    features: ['5 projects/month', '80 calculator uses', '5 BOQs', '5 invoices & quotes', 'PDF & Excel exports', '1 user, 2 devices', 'Priority support'],
    popular: true
  },
  {
    name: 'Elite',
    price: '₦84,999',
    amount: 84999,
    period: '/month',
    desc: 'For firms and teams managing multiple projects.',
    features: ['50 projects/month', '700 calculator uses', '50 BOQs', '50 invoices & quotes', 'PDF & Excel exports', '5 users, 15 devices', 'Team roles', 'Top priority support']
  }
];

const COMPARISONS = [
  { feature: 'Monthly projects', starter: '2', pro: '5', elite: '50' },
  { feature: 'Calculator uses', starter: '30', pro: '80', elite: '700' },
  { feature: 'BOQs', starter: '2', pro: '5', elite: '50' },
  { feature: 'Invoices & quotes', starter: '2 each', pro: '5 each', elite: '50 each' },
  { feature: 'PDF & Excel exports', starter: '✓', pro: '✓', elite: '✓' },
  { feature: 'Users / devices', starter: '1 / 1', pro: '1 / 2', elite: '5 / 15' },
  { feature: 'Team roles', starter: '—', pro: '—', elite: '✓' },
  { feature: 'Support', starter: 'Standard', pro: 'Priority', elite: 'Top priority' }
];

function SectionLabel({ text, light = false }) {
  return (
    <div className="inline-flex items-center gap-2 mb-5">
      <span className={`w-1.5 h-1.5 rounded-full ${light ? 'bg-gold-400' : 'bg-primary-500'}`} />
      <span className={`text-xs font-semibold uppercase tracking-widest ${light ? 'text-gold-400' : 'text-primary-500'}`}>
        {text}
      </span>
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly');
  const [country, setCountry] = useState('NG');
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    setLoading(true);
    fetch(`${API_URL}/subscription/prices?country=${country}`)
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success' && d.data?.plans?.length) {
          setPlans(d.data.plans.map(p => ({
            name: p.plan_name,
            price: `${d.data.symbol}${Number(p.price).toLocaleString()}`,
            amount: p.price,
            period: p.billing_cycle === 'annual' ? '/year' : '/month',
            desc: DEFAULT_PLANS.find(dp => dp.name === p.plan_name)?.desc || '',
            features: DEFAULT_PLANS.find(dp => dp.name === p.plan_name)?.features || [],
            popular: p.plan_name === 'Pro'
          })));
        }
      })
      .catch(() => setPlans(DEFAULT_PLANS))
      .finally(() => setLoading(false));
  }, [country]);

  return (
    <>
      <Head>
        <title>Pricing — QSToolkit | Plans from ₦8,999/mo</title>
        <meta name="description" content="Transparent pricing for quantity surveying professionals across 9 African countries. Plans from ₦8,999/mo in Nigeria, with local currency support via Paystack and Flutterwave." />
        <meta name="keywords" content="QSToolkit pricing, quantity surveying software cost, QS software Nigeria, BOQ software price, construction software pricing" />
        <link rel="canonical" href="https://qs.solnuv.com/pricing" />
        <meta property="og:title" content="Pricing — QSToolkit | Plans from ₦8,999/mo" />
        <meta property="og:description" content="Simple, transparent pricing for Nigerian quantity surveying professionals." />
        <meta property="og:url" content="https://qs.solnuv.com/pricing" />

        {/* Product structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: 'QSToolkit',
              description: "Nigeria's Professional Quantity Surveying Platform with BOQs, 70+ QS Calculators, Invoices, Project Tracking, and AI-powered Dr. Q assistant.",
              brand: { '@type': 'Brand', name: 'QSToolkit' },
              offers: [
                {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'NGN',
                  name: 'Free Plan',
                  url: 'https://qs.solnuv.com/auth/register',
                  availability: 'https://schema.org/InStock',
                },
                {
                  '@type': 'Offer',
                  price: '8999',
                  priceCurrency: 'NGN',
                  name: 'Starter Plan (Monthly)',
                  url: 'https://qs.solnuv.com/pricing',
                  availability: 'https://schema.org/InStock',
                },
                {
                  '@type': 'Offer',
                  price: '23999',
                  priceCurrency: 'NGN',
                  name: 'Pro Plan (Monthly)',
                  url: 'https://qs.solnuv.com/pricing',
                  availability: 'https://schema.org/InStock',
                },
                {
                  '@type': 'Offer',
                  price: '84999',
                  priceCurrency: 'NGN',
                  name: 'Elite Plan (Monthly)',
                  url: 'https://qs.solnuv.com/pricing',
                  availability: 'https://schema.org/InStock',
                },
              ],
            }),
          }}
        />

        {/* FAQ structured data for pricing page */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'Can I change plans at any time?',
                  acceptedAnswer: { '@type': 'Answer', text: 'Yes. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately with prorated billing. Downgrades apply at the end of your current billing cycle.' },
                },
                {
                  '@type': 'Question',
                  name: 'What payment methods do you accept?',
                  acceptedAnswer: { '@type': 'Answer', text: 'We accept bank transfers and Paystack payments (cards, bank transfer, USSD). Direct bank transfers are verified manually within 24 hours.' },
                },
                {
                  '@type': 'Question',
                  name: 'Is there a free plan?',
                  acceptedAnswer: { '@type': 'Answer', text: 'Yes. You get 3 free lifetime calculator uses on signup. No credit card required. Upgrade when you need more.' },
                },
              ],
            }),
          }}
        />
      </Head>

      <div className="min-h-screen bg-white font-sans overflow-x-hidden">
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-primary-900/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <img src="/qs-toolkit-logo.png" alt="QSToolkit" className="h-14 sm:h-16 w-auto max-w-[200px] sm:max-w-[220px]" />
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm text-white/60 hover:text-white hidden md:inline transition-colors">
                Home
              </Link>
              <Link href="/auth/login" className="text-sm text-white/80 hover:text-white px-3 py-1.5 hidden sm:inline transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn-gold text-sm px-4 py-2">
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-primary-900 text-white pt-32 pb-16 md:pt-40 md:pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <SectionLabel text="Pricing" light />
              <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
                Simple. Transparent.
                <br />
                <span className="text-gold-400">No surprises.</span>
              </h1>
              <p className="text-white/40 text-lg max-w-xl mx-auto">
                Pick what fits your practice. Upgrade or downgrade anytime. No hidden fees.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Toggle */}
        <section className="bg-white py-8 px-4 border-b border-gray-100">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Country selector */}
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="bg-gray-100 rounded-full px-4 py-2 text-sm font-medium text-gray-700 border-0 outline-none cursor-pointer"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>
              ))}
            </select>

            {/* Billing toggle */}
            <div className="inline-flex bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === 'monthly'
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === 'yearly'
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Yearly <span className="text-gold-500 text-xs font-bold ml-1">Save 20%</span>
              </button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="bg-white py-16 md:py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-6"
            >
              {plans.map((plan) => {
                const yearlyMultiplier = billing === 'yearly' ? (plan.amount * 0.8 * 12) : null;
                const price = billing === 'yearly'
                  ? `${selectedCountry.symbol}${Math.round(yearlyMultiplier).toLocaleString()}`
                  : plan.price;
                const period = billing === 'yearly' ? '/year' : plan.period;

                return (
                  <motion.div
                    key={plan.name}
                    variants={scaleIn}
                    className={`relative rounded-2xl border p-8 flex flex-col ${
                      plan.popular
                        ? 'border-gold-500 bg-gold-500/[0.02]'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gold-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="font-display text-xl font-bold text-primary-800">{plan.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{plan.desc}</p>
                      <div className="flex items-end gap-1 mt-4">
                        <span className="text-3xl font-bold text-primary-700">{price}</span>
                        <span className="text-gray-400 text-sm mb-1">{period}</span>
                      </div>
                    </div>
                    <ul className="space-y-3 flex-1 mb-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <span className="text-gold-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/register"
                      className={plan.popular
                        ? 'btn-gold w-full text-center justify-center'
                        : 'btn-secondary w-full text-center justify-center'
                      }
                    >
                      Get {plan.name}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="bg-gray-50 py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="text-center mb-12"
            >
              <SectionLabel text="Compare" />
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-800">
                Feature breakdown
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-4 font-medium text-gray-400">Feature</th>
                      <th className="text-center px-6 py-4 font-display font-bold text-primary-800">Starter</th>
                      <th className="text-center px-6 py-4 font-display font-bold text-primary-800 bg-gold-500/[0.03]">Pro</th>
                      <th className="text-center px-6 py-4 font-display font-bold text-primary-800">Elite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISONS.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600">{row.feature}</td>
                        <td className="text-center px-6 py-3.5 text-gray-500">{row.starter}</td>
                        <td className="text-center px-6 py-3.5 text-gray-700 font-medium bg-gold-500/[0.02]">{row.pro}</td>
                        <td className="text-center px-6 py-3.5 text-gray-500">{row.elite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-16 md:py-24 px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="text-center mb-12"
            >
              <SectionLabel text="FAQ" />
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-800">
                Pricing questions
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="space-y-4"
            >
              {[
                { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade instantly when you need more. Downgrade at your next billing cycle. No penalties.' },
                { q: 'Is there a free trial?', a: 'You get limited access on signup to explore calculators and create a few documents. Upgrade when you are ready.' },
                { q: 'What payment methods do you accept?', a: 'We accept cards, bank transfers, and mobile money via Paystack and Flutterwave. Available across 9 African countries and globally in USD/GBP.' },
                { q: 'Do you offer refunds?', a: 'We do not offer refunds for partial months. You can cancel anytime and keep access until the end of your billing period.' },
                { q: 'What happens if I hit my monthly limit?', a: 'You will see a friendly prompt to upgrade. Your existing data stays accessible. Nothing is deleted.' }
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-display font-bold text-primary-800 mb-2">{item.q}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary-800 py-16 md:py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                Still have questions?
              </h2>
              <p className="text-white/40 mb-8">
                Start free and explore. Upgrade only when you are convinced.
              </p>
              <Link href="/auth/register" className="btn-gold px-8 py-3 inline-flex">
                Create Free Account →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-primary-900 border-t border-white/5 py-10 px-4">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">
              © {new Date().getFullYear()} QSToolkit
            </p>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/auth/login" className="hover:text-white transition-colors">Login</Link>
              <Link href="/calculators" className="hover:text-white transition-colors">Calculators</Link>
              <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
