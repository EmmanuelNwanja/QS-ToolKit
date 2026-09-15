import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const TIER_HIERARCHY = ['free', 'student', 'pro', 'enterprise'];

const PLAN_NAMES = {
  free: 'Free',
  student: 'Student',
  pro: 'Pro',
  enterprise: 'Enterprise'
};

const PLAN_COLORS = {
  free: 'gray',
  student: 'blue',
  pro: 'gold',
  enterprise: 'purple'
};

export default function FreemiumGate({
  feature,
  requiredTier = 'student',
  children,
  fallback,
  showUpgrade = true,
  className = ''
}) {
  const [userTier, setUserTier] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkTier() {
      try {
        const res = await fetch('/api/subscriptions/status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          const tier = data.data?.subscription_plans?.name || 'free';
          setUserTier(tier);
        }
      } catch {
        setUserTier('free');
      } finally {
        setLoading(false);
      }
    }
    checkTier();
  }, []);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-100 rounded-lg h-20 ${className}`} />
    );
  }

  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
  const userIndex = TIER_HIERARCHY.indexOf(userTier);

  if (userIndex >= requiredIndex) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  if (!showUpgrade) {
    return null;
  }

  const requiredName = PLAN_NAMES[requiredTier];
  const requiredColor = PLAN_COLORS[requiredTier];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed border-${requiredColor}-300 bg-${requiredColor}-50/50 ${className}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-[1px]" />
        <div className="relative p-6 text-center">
          <div className="text-4xl mb-3">
            {requiredTier === 'student' && '🔒'}
            {requiredTier === 'pro' && '⭐'}
            {requiredTier === 'enterprise' && '🏢'}
          </div>
          <h3 className="font-display font-bold text-primary-800 mb-1">
            {requiredName} Feature
          </h3>
          <p className="text-sm text-gray-600 mb-1">
            This feature requires a <strong className={`text-${requiredColor}-700`}>{requiredName}</strong> plan or higher.
          </p>
          {feature && (
            <p className="text-xs text-gray-400 mb-4">{feature}</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/subscription"
              className={`btn-${requiredColor === 'gold' ? 'gold' : 'primary'} text-sm`}
            >
              Upgrade to {requiredName}
            </Link>
            <Link href="/subscription" className="btn-outline text-sm">
              Compare Plans
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function UsageBar({ feature: _feature, tier: _tier, used, limit, className = '' }) {
  if (limit === null || limit === undefined) {
    return null;
  }

  const percentage = Math.min(100, (used / limit) * 100);
  const isLow = percentage > 80;
  const isExceeded = percentage >= 100;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full transition-colors ${
            isExceeded ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
      </div>
      <span className={`text-xs font-medium ${isExceeded ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-500'}`}>
        {used}/{limit}
      </span>
    </div>
  );
}

export function RateLimitBadge({ tier: _tier, feature: _feature, used, limit }) {
  if (limit === null || limit === undefined) return null;

  const remaining = Math.max(0, limit - used);
  const percentage = (used / limit) * 100;

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
      percentage >= 100
        ? 'bg-red-100 text-red-700'
        : percentage > 80
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700'
    }`}>
      {remaining} remaining
    </span>
  );
}
