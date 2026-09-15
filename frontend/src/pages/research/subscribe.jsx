import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { researchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const PLANS = [
  { cycle: 'weekly', amount: 3000, label: 'Weekly', per: '/week' },
  { cycle: 'monthly', amount: 11400, label: 'Monthly', per: '/month', save: '10%' },
  { cycle: 'annual', amount: 140400, label: 'Annual', per: '/year', save: '40%' },
];

export default function ResearchSubscribe() {
  const router = useRouter();
  const [selected, setSelected] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await researchAPI.getSubscriptionStatus();
        if (res.data.active) {
          setHasActive(true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await researchAPI.subscribe({
        payment_method: 'card',
        billing_cycle: selected,
      });
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        toast.success('Subscription initiated');
        router.push('/research');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Loading...">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (hasActive) {
    return (
      <ProtectedRoute>
        <Head><title>Research Subscription — QSToolkit</title></Head>
        <Layout title="Research Subscription">
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Already Subscribed</h2>
            <p className="text-gray-500 mb-6">You have an active research subscription.</p>
            <Link href="/research" className="btn-primary">Go to Research</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>Subscribe to Research — QSToolkit</title></Head>
      <Layout title="QS Research Subscription">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link href="/research" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> Back to Research
          </Link>

          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-primary-800">QS Research Subscription</h1>
            <p className="text-gray-500 mt-2">Unlock the full research pipeline with AI-powered assistance.</p>
          </div>

          {/* Features */}
          <div className="card border-indigo-200">
            <h3 className="font-display font-bold text-primary-800 mb-3">What&apos;s Included</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                '10-stage research pipeline',
                'AI research assistant (Dr. Q)',
                'Unlimited projects',
                'Literature source curation',
                'Cost data aggregation',
                'Methodology templates',
                'Collaboration tools',
                'Export & archive'
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500">✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Plan Selection */}
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map(p => (
              <motion.button
                key={p.cycle}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(p.cycle)}
                className={`card text-center transition-all ${
                  selected === p.cycle
                    ? 'border-2 border-indigo-500 shadow-md'
                    : 'border border-gray-200 hover:border-indigo-300'
                }`}
              >
                {p.save && (
                  <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-2">
                    Save {p.save}
                  </span>
                )}
                <p className="font-display font-bold text-primary-800">{p.label}</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">₦{p.amount.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{p.per}</p>
              </motion.button>
            ))}
          </div>

          {/* Subscribe Button */}
          <div className="text-center">
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="btn-gold text-base px-8 py-3"
            >
              {subscribing ? 'Processing...' : `Subscribe — ₦${PLANS.find(p => p.cycle === selected)?.amount.toLocaleString()}`}
            </button>
            <p className="text-xs text-gray-400 mt-3">Cancel anytime. Access continues until end of billing period.</p>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
