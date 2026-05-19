import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════ */

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

const slideFromLeft = {
  hidden: { opacity: 0.15, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
};

const slideFromRight = {
  hidden: { opacity: 0.15, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
};

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const MARQUEE_ITEMS = [
  'Nigerian Construction Standards',
  '10+ QS Calculators',
  'PDF & Excel Exports',
  'BOQ Generator',
  'Client Feedback System',
  'Live Leaderboard',
  'Invoice & Quote Builder',
  'Project Tracker',
  'Zero Setup Required'
];

const PROBLEMS = [
  {
    title: 'Excel breaks silently',
    body: 'One wrong cell, entire BOQ is wrong. No validation. No guardrails. You only find out when the client does.'
  },
  {
    title: 'Clients wait too long',
    body: 'Manual calculations take days. Your competitors deliver in hours. Speed is the new credibility.'
  },
  {
    title: 'No paper trail',
    body: 'Scattered notes. Lost files. Zero history when you need it. Your work vanishes.'
  },
  {
    title: 'Reputation is invisible',
    body: 'No feedback system. No proof of quality for new clients. You are only as good as your last conversation.'
  }
];

const CAPABILITIES = [
  {
    num: '01',
    title: 'Nigerian standards first.',
    body: '9-inch sandcrete blocks. BS 4449 steel. Laterite bulking factors. Every calculator uses the units and standards you actually work with.'
  },
  {
    num: '02',
    title: 'BOQs in minutes.',
    body: 'Input your quantities, get a professional itemised document. Export to PDF or Excel — with your logo and branding.'
  },
  {
    num: '03',
    title: 'Branded documents.',
    body: 'Your logo. Your colours. Your signature on every invoice, quote, and valuation. Look like the firm you are.'
  },
  {
    num: '04',
    title: 'Project history.',
    body: 'Every BOQ, every invoice, every rate — logged and searchable. Your entire history, one search away.'
  },
  {
    num: '05',
    title: 'Client proof.',
    body: 'Collect client ratings with one link. Build proof that wins new business.'
  },
  {
    num: '06',
    title: 'Live leaderboard.',
    body: 'See where you stand. Ranked by projects, ratings, and reputation.'
  }
];

const STATS = [
  { value: '12+', label: 'Calculators', sub: 'All Nigerian standards' },
  { value: '50x', label: 'Faster BOQs', sub: 'From days to minutes' },
  { value: '₦0', label: 'Setup Cost', sub: 'Start in 60 seconds' },
  { value: '100%', label: 'Cloud Based', sub: 'Access from any device' }
];

const FAQS = [
  {
    q: 'What makes QSToolkit different from other QS software?',
    a: 'Built for Nigerian standards. No installations to manage. Access from any device, collaborate with your team, and scale as you grow. No formulas to break. No licenses to renew.'
  },
  {
    q: 'Can I export BOQs and invoices with my company logo?',
    a: 'Yes. Upload your logo and brand colours in Settings. Every PDF and Excel export carries your identity — professionally formatted and ready to send.'
  },
  {
    q: 'Is there a free trial?',
    a: 'You can explore the calculators and create a limited number of documents on signup without paying. Upgrade when you are ready to unlock full limits.'
  },
  {
    q: 'How does the client feedback system work?',
    a: 'Generate a unique link for each client. They rate you on quality, timeliness, and communication. Your average score feeds into the live leaderboard — turning reputation into a competitive edge.'
  },
  {
    q: 'Can I use this on my phone?',
    a: 'QSToolkit is a progressive web app. Use it on phone, tablet, or desktop. You can even install it to your home screen for offline-like access.'
  },
  {
    q: 'What happens to my data?',
    a: 'Your data is stored securely in Supabase PostgreSQL. We do not sell your data. You control what you share. Your work belongs to you.'
  }
];

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function AnimatedCounter({ target, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, '')) || 0;
    const duration = 1500;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * numeric));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(numeric);
    };
    requestAnimationFrame(tick);
  }, [isInView, target]);

  const display = target.replace(/[0-9.]+/, String(count));
  return (
    <span ref={ref} className="font-display text-4xl md:text-5xl font-bold text-white">
      {prefix}{display}{suffix}
    </span>
  );
}

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

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-white/10">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm md:text-base font-medium text-white/90 group-hover:text-white transition-colors pr-4">
          {item.q}
        </span>
        <span className={`text-gold-400 text-xl transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-white/60 leading-relaxed pb-5 max-w-3xl">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <>
      <Head>
        <title>QSToolkit — Quantity Surveying Without the Software Headaches</title>
        <meta name="description" content="Calculate, quantify, and invoice from any device. No installs. No lock-in. Built for QS professionals." />
      </Head>

      <div className="min-h-screen bg-white font-sans overflow-x-hidden">

        {/* ═══════════════════════════════════════════════════════
            NAVBAR
            ═══════════════════════════════════════════════════════ */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 bg-primary-900/80 backdrop-blur-md border-b border-white/5"
        >
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-primary-900 font-bold text-sm">QS</span>
              </div>
              <span className="font-display text-lg font-bold text-white">QSToolkit</span>
            </Link>
            <div className="flex items-center gap-3">
              {!installed && installPrompt && (
                <button
                  onClick={handleInstall}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gold-400 border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 rounded-full hover:bg-gold-500/20 transition-colors"
                >
                  ⬇ Install
                </button>
              )}
              <Link href="/leaderboard" className="text-sm text-white/60 hover:text-white hidden md:inline transition-colors">
                Leaderboard
              </Link>
              <Link href="/auth/login" className="text-sm text-white/80 hover:text-white px-3 py-1.5 hidden sm:inline transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="btn-gold text-sm px-4 py-2">
                Get Started
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* ═══════════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════════ */}
        <section className="relative bg-primary-900 text-white pt-32 pb-20 md:pt-44 md:pb-28 px-4 overflow-hidden">
          {/* Background ambient shapes */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-gold-500/[0.03] blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-primary-500/10 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/[0.03]" />
          </div>

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.1}
              className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.95] mb-8 tracking-tight"
            >
              Quantity Surveying.
              <br />
              <span className="text-gold-400">Without the spreadsheets.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.2}
              className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Calculate, quantify, and invoice from any device.
              No installs. No lock-in. No wasted weekends.
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.3}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Link href="/auth/register" className="btn-gold text-base px-8 py-3">
                Start Free — No Card
              </Link>
              <Link href="/calculators" className="btn-ghost text-base px-8 py-3">
                Try a Calculator →
              </Link>
            </motion.div>
          </div>

          {/* Marquee */}
          <div className="mt-16 md:mt-24 relative z-10 border-y border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap py-3">
              {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
                <span key={i} className="inline-flex items-center mx-6 text-xs font-medium text-white/30 uppercase tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-gold-500/50 mr-3" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            THE PROBLEM
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-900 py-24 md:py-32 px-4 relative">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
            >
              <SectionLabel text="The Problem" light />
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-16 max-w-3xl">
                Your QS software is holding you back.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5"
            >
              {PROBLEMS.map((p, i) => (
                <motion.div
                  key={i}
                  variants={scaleIn}
                  className="bg-primary-900 p-8 md:p-10 card-shine group hover:bg-primary-800/50 transition-colors duration-500"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center mb-5 group-hover:bg-gold-500/20 transition-colors">
                    <span className="text-gold-400 text-lg font-bold">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-3">
                    {p.title}
                  </h3>
                  <p className="text-sm md:text-base text-white/40 leading-relaxed">
                    {p.body}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            THE OLD WAY
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-800 py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="mb-16"
            >
              <SectionLabel text="The Old Way" light />
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-3xl">
                Tied to a machine. Tied to a license. Tied to luck.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {[
                { title: 'Steep learning curve', body: 'Months to master. One update breaks your workflow. Training staff takes weeks.' },
                { title: 'One device, one point of failure', body: 'Laptop crashes? Software corrupts? Left it at home? Your entire practice stops dead.' },
                { title: 'Solo by design', body: 'No shared workspace. No real-time collaboration. Teamwork means passing files around on a flash drive.' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="bg-primary-900/50 border border-white/5 rounded-2xl p-8"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center mb-5">
                    <span className="text-gold-400 text-lg font-bold">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            THE PLATFORM
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-900 py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-gold-500/[0.02] blur-3xl" />
          </div>

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={slideFromLeft}
              >
                <SectionLabel text="The Platform" light />
                <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                  One system.
                  <br />
                  <span className="text-gold-400">Every QS task.</span>
                </h2>
                <p className="text-white/40 text-lg leading-relaxed mb-8 max-w-lg">
                  From concrete to invoice — one system, one login, zero installation.
                </p>
                <ul className="space-y-4">
                  {['Concrete, blockwork, steel, plastering & more', 'BOQs with your branding', 'Invoices, quotes, valuations', 'Client feedback collection', 'Live national leaderboard'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                      <span className="w-5 h-5 rounded-full bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold-400 text-xs">✓</span>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={slideFromRight}
                className="relative"
              >
                {/* Hub diagram */}
                <div className="relative bg-primary-900/60 border border-white/5 rounded-2xl p-8 md:p-10">
                  <div className="flex flex-col items-center gap-4">
                    {/* Input layer */}
                    <div className="grid grid-cols-3 gap-3 w-full">
                      {['Dimensions', 'Specs', 'Rates'].map((t) => (
                        <div key={t} className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-center">
                          <span className="text-xs text-white/50">{t}</span>
                        </div>
                      ))}
                    </div>
                    {/* Arrows */}
                    <div className="flex justify-center gap-8">
                      <div className="w-px h-4 bg-white/10" />
                      <div className="w-px h-4 bg-white/10" />
                      <div className="w-px h-4 bg-white/10" />
                    </div>
                    {/* Hub */}
                    <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl px-8 py-4 text-center w-full">
                      <span className="font-display text-lg font-bold text-gold-400">QSToolkit</span>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Engine · Database · Export</div>
                    </div>
                    {/* Arrows */}
                    <div className="flex justify-center gap-8">
                      <div className="w-px h-4 bg-white/10" />
                      <div className="w-px h-4 bg-white/10" />
                      <div className="w-px h-4 bg-white/10" />
                    </div>
                    {/* Output layer */}
                    <div className="grid grid-cols-3 gap-3 w-full">
                      {['BOQ', 'Invoice', 'Report'].map((t) => (
                        <div key={t} className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-center">
                          <span className="text-xs text-white/50">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Decorative corner accents */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-gold-500/20 rounded-tl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-gold-500/20 rounded-br-2xl" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            PRIVACY VAULT
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-800 py-24 md:py-32 px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={slideFromLeft}
              >
                <SectionLabel text="Privacy" light />
                <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                  Your BOQs are your edge.
                  <br />
                  <span className="text-gold-400">We keep them that way.</span>
                </h2>
                <p className="text-white/40 text-lg leading-relaxed mb-8">
                  In this market, a leaked quote kills a bid. A shared BOQ becomes your competitor&apos;s starting point. QSToolkit isolates every project, encrypts your data at rest, and gives you full control over what you share.
                </p>
                <ul className="space-y-4">
                  {['Encrypted data at rest', 'Isolated project workspaces', 'Your data shapes your AI', 'Granular team permissions', 'Audit trail for every access', 'Export anytime. Full ownership.'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                      <span className="w-5 h-5 rounded-full bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold-400 text-xs">✓</span>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={slideFromRight}
                className="relative"
              >
                <div className="relative bg-primary-800/60 border border-white/5 rounded-2xl p-8 md:p-10">
                  <div className="space-y-4">
                    {[
                      { label: 'Encryption', value: 'AES-256', status: 'Active' },
                      { label: 'Data residency', value: 'Your account only', status: 'Isolated' },
                      { label: 'Access logging', value: 'Every view tracked', status: 'Transparent' },
                      { label: 'Data ownership', value: 'You hold the keys', status: 'Yours' }
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div>
                          <div className="text-xs text-white/30 uppercase tracking-wider">{row.label}</div>
                          <div className="text-sm text-white/80 font-medium">{row.value}</div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-gold-500/20 rounded-tl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-gold-500/20 rounded-br-2xl" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            CAPABILITIES
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-white py-24 md:py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="mb-16"
            >
              <SectionLabel text="Capabilities" />
              <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-800 leading-tight max-w-2xl">
                Built for how you actually work.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {CAPABILITIES.map((cap) => (
                <motion.div
                  key={cap.num}
                  variants={fadeUp}
                  className="group"
                >
                  <div className="flex items-start gap-4">
                    <span className="font-display text-sm font-bold text-gold-500 mt-1 flex-shrink-0">
                      [{cap.num}]
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-primary-800 mb-2 group-hover:text-primary-600 transition-colors">
                        {cap.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {cap.body}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            STATS
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-900 py-16 md:py-20 px-4 border-y border-white/5">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={staggerContainer}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            >
              {STATS.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={fadeUp}
                  className="text-center md:text-left"
                >
                  <AnimatedCounter target={stat.value} />
                  <div className="text-sm font-semibold text-white/70 mt-2">{stat.label}</div>
                  <div className="text-xs text-white/30 mt-0.5">{stat.sub}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            HOW IT WORKS
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-gray-50 py-24 md:py-32 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="text-center mb-16"
            >
              <SectionLabel text="How It Works" />
              <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-800 leading-tight">
                Three steps. No setup.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-8"
            >
              {[
                { step: '01', title: 'Calculate', body: 'Enter dimensions. Get quantities. Nigerian standards built in.' },
                { step: '02', title: 'Document', body: 'Build branded documents. Export PDF or Excel. Send in seconds.' },
                { step: '03', title: 'Build Reputation', body: 'Collect feedback. Track history. Climb the leaderboard.' }
              ].map((s) => (
                <motion.div
                  key={s.step}
                  variants={fadeUp}
                  className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-card hover:shadow-card-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-primary-700 rounded-xl flex items-center justify-center mb-6">
                    <span className="font-display text-lg font-bold text-gold-400">{s.step}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-primary-800 mb-3">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            QS AI ENGINE
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-white py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-gold-500/[0.04] blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gold-600">Coming Soon</span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-800 leading-tight mb-6">
                Smarter QS.
                <br />
                <span className="text-gold-500">Coming soon.</span>
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                An AI that understands your local needs.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                { title: 'Auto-BOQ', body: 'Upload drawings. Get draft BOQs in seconds.' },
                { title: 'Cost forecasting', body: 'Spot overruns before they happen.' },
                { title: 'Variance detection', body: 'Catch what changed between revisions. Instantly.' },
                { title: 'Natural language', body: 'Ask questions. Get answers. No manuals.' }
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card hover:shadow-card-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-700 flex items-center justify-center mb-4">
                    <span className="font-display text-sm font-bold text-gold-400">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-primary-800 mb-2">{feat.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.body}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="mt-12 text-center"
            >
              <Link href="/auth/register" className="btn-primary px-8 py-3 inline-flex">
                Join the Waitlist →
              </Link>
              <p className="text-xs text-gray-400 mt-3">Be the first to know when it drops. No spam.</p>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FAQ
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-900 py-24 md:py-32 px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="mb-12"
            >
              <SectionLabel text="FAQ" light />
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">
                Questions? Answered.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              {FAQS.map((faq, i) => (
                <FaqItem
                  key={i}
                  item={faq}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FINAL CTA
            ═══════════════════════════════════════════════════════ */}
        <section className="bg-primary-800 py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.03]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/[0.02]" />
          </div>

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
            >
              <h2 className="font-display text-5xl md:text-7xl font-bold text-white leading-[0.95] mb-6">
                Work smarter.
                <br />
                <span className="text-gold-400">Build your reputation.</span>
              </h2>
              <p className="text-white/40 text-lg mb-10 max-w-md mx-auto">
                No credit card. No setup. Start in 60 seconds.
              </p>
              <Link href="/auth/register" className="btn-gold text-base px-10 py-3.5 inline-flex">
                Create Free Account →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════════════════ */}
        <footer className="bg-primary-900 border-t border-white/5 py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gold-500 rounded-md flex items-center justify-center">
                    <span className="text-primary-900 font-bold text-xs">QS</span>
                  </div>
                  <span className="font-display text-lg font-bold text-white">QSToolkit</span>
                </div>
                <p className="text-sm text-white/30">
                  Quantity Surveying Toolkit for Nigerian professionals.
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm text-white/40">
                <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                <Link href="/auth/login" className="hover:text-white transition-colors">Login</Link>
                <Link href="/auth/register" className="hover:text-white transition-colors">Register</Link>
                <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
                <Link href="/calculators" className="hover:text-white transition-colors">Calculators</Link>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-white/20">
                © {new Date().getFullYear()} QSToolkit. Built by Fudo Greentech Ltd.
              </p>
              <p className="text-xs text-white/20">
                All calculations follow Nigerian construction standards.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
