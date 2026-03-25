import Head from 'next/head';
import Link from 'next/link';

const FEATURES = [
  { icon: '🧮', title: 'QS Calculators', desc: 'Concrete, blockwork, steel, plastering, roofing, tiling & more — all calibrated for Nigerian construction standards.' },
  { icon: '📋', title: 'Bill of Quantities', desc: 'Build professional, itemised BOQs in minutes. Export to PDF or Excel with your own logo and branding.' },
  { icon: '🧾', title: 'Invoices & Quotations', desc: 'Generate branded invoices and quotes for clients. Include VAT, discounts, and send directly by email.' },
  { icon: '📁', title: 'Project Tracker', desc: 'Log all your projects — track status, estimated vs final values, and project history in one place.' },
  { icon: '⭐', title: 'Client Feedback', desc: 'Share a unique link with clients to collect ratings (1–10) on quality, timeliness, and communication.' },
  { icon: '🏆', title: 'Live Leaderboard', desc: 'See how you rank against other surveyors nationwide — by projects completed and average client rating.' }
];

const PLANS = [
  {
    name: 'Student',
    price: '₦5000',
    period: '/month',
    color: 'border-gray-200',
    badge: null,
    features: ['7 project logs/month', '7 calculator uses/month', '1 user, 1 device', 'Basic calculators']
  },
  {
    name: 'Pro',
    price: '₦15,000',
    period: '/month',
    color: 'border-primary-700',
    badge: 'Most Popular',
    features: ['15 project logs', '20 calculator uses/month', 'Invoice & Quotation Maker', 'PDF & Excel exports', '1 user, 2 devices', 'Priority support']
  },
  {
    name: 'Enterprise',
    price: '₦70,000',
    period: '/month',
    color: 'border-gold-500',
    badge: 'Teams',
    features: ['200 project logs (scalable)', 'Unlimited calculators', 'Invoice & Quotation Maker', 'PDF & Excel exports', '5 users, 15 devices', 'Team roles & permissions', 'Top priority support']
  }
];

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>QSToolkit — Nigeria's Quantity Surveying Platform</title>
      </Head>

      <div className="min-h-screen bg-white font-sans">
        {/* ── Navbar ──────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-gold-400 font-bold text-sm">QS</span>
              </div>
              <span className="font-display text-xl font-bold text-primary-800">QSToolkit</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/leaderboard" className="text-sm text-gray-600 hover:text-primary-700 hidden md:inline">
                Leaderboard
              </Link>
              <Link href="/auth/login" className="btn-secondary text-sm">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 text-white pt-20 pb-28 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-64 h-64 rounded-full border border-white" />
            <div className="absolute bottom-0 left-20 w-96 h-96 rounded-full border border-white" />
          </div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
              <span className="text-gold-400">🇳🇬</span> Built exclusively for Nigerian Quantity Surveyors
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Every QS Tool You Need,<br />
              <span className="text-gold-400">All in One Place</span>
            </h1>
            <p className="text-lg text-primary-200 max-w-2xl mx-auto mb-10 leading-relaxed">
              Calculate quantities, generate Bills of Quantities, create branded invoices, track projects,
              collect client feedback — without installing a single software. From any device.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/register" className="btn-gold text-base px-8 py-3">
                Start Free — No Credit Card
              </Link>
              <Link href="/calculators" className="btn-ghost text-base px-8 py-3">
                Try a Calculator →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────── */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-800 mb-4">
                Everything a Nigerian QS Professional Needs
              </h2>
              <p className="text-gray-600 max-w-xl mx-auto">
                No more switching between Excel sheets, WhatsApp messages, and handwritten BOQs.
                QSToolkit keeps it all together.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="card hover:shadow-card-md transition-shadow">
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="font-display text-lg font-bold text-primary-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Calculators Showcase ────────────────────────── */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-800 mb-6">
                  Calculators Built for<br />Nigerian Construction
                </h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  From 9-inch sandcrete blocks to BS 4449 reinforcement bars, our calculators use
                  the standards, materials, and units Nigerian QS professionals work with every day.
                  No need to adjust for foreign assumptions.
                </p>
                <ul className="space-y-3">
                  {['Concrete volume with dry-to-wet conversion', '9" & 6" block quantities with mortar', 'Longspan aluminium roofing sheets', 'Steel rebar (6mm–32mm) by BS 4449 weight', 'Laterite & soil bulking factors'].map(p => (
                    <li key={p} className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="text-emerald-500 font-bold">✓</span> {p}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className="btn-primary mt-8 inline-flex">
                  Access All Calculators
                </Link>
              </div>
              <div className="bg-primary-50 rounded-2xl p-6 grid grid-cols-2 gap-3">
                {['🏗️ Concrete', '🧱 Blockwork', '🖼️ Plastering', '🎨 Painting', '🏠 Roofing', '⚙️ Steel', '🚜 Earthwork', '⬛ Tiling'].map(c => (
                  <div key={c} className="bg-white rounded-xl p-4 flex items-center gap-2 shadow-card text-sm font-medium text-primary-700">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────── */}
        <section className="py-20 px-4 bg-gray-50" id="pricing">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-800 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-gray-600">Affordable plans for students, professionals, and enterprises across Nigeria.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <div key={plan.name} className={`card border-2 ${plan.color} relative flex flex-col`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-700 text-white text-xs font-bold px-4 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="font-display text-xl font-bold text-primary-800">{plan.name}</h3>
                    <div className="flex items-end gap-1 mt-2">
                      <span className="text-3xl font-bold text-primary-700">{plan.price}</span>
                      <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 flex-1 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-emerald-500 font-bold mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/register" className={plan.name === 'Pro' ? 'btn-primary w-full text-center' : 'btn-secondary w-full text-center'}>
                    Get {plan.name}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────── */}
        <section className="bg-primary-800 text-white py-20 px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Professionalise Your Practice?
          </h2>
          <p className="text-primary-300 mb-8 max-w-xl mx-auto">
            Join QS professionals across Nigeria using QSToolkit to work smarter, win more clients, and build their reputation.
          </p>
          <Link href="/auth/register" className="btn-gold text-base px-10 py-3">
            Create Free Account →
          </Link>
        </section>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="bg-primary-900 text-primary-400 py-10 px-4 text-center text-sm">
          <p className="font-display text-white text-lg mb-2">QSToolkit</p>
          <p>Nigeria's Quantity Surveying Platform · qstoolkit.com</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <Link href="/auth/login" className="hover:text-white">Login</Link>
            <Link href="/auth/register" className="hover:text-white">Register</Link>
            <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
