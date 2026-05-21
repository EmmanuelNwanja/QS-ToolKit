import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../context/authStore';

export default function ProtectedRoute({ children, requirePlan }) {
  const { user, token, loading, initialized, planName, refreshUser } = useAuthStore();
  const router = useRouter();
  const refreshedPlanCheckRef = useRef(false);

  useEffect(() => {
    if (!initialized) return;
    if (!token || !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (!user.onboarding_completed) {
      router.replace('/auth/onboarding');
      return;
    }
    if (user.force_password_change) {
      router.replace('/auth/force-change-password');
      return;
    }
    if (requirePlan) {
      const rank = (value) => {
        const normalizedRaw = String(value || '').toLowerCase();
        const normalized = normalizedRaw === 'student' ? 'basic' : normalizedRaw;
        const hierarchy = ['free', 'basic', 'pro', 'enterprise'];
        return hierarchy.indexOf(normalized);
      };
      const current = planName();
      if (rank(current) < rank(requirePlan)) {
        // A stale cached user payload can briefly report an older plan.
        if (!refreshedPlanCheckRef.current) {
          refreshedPlanCheckRef.current = true;
          refreshUser();
          return;
        }
        router.replace('/subscription');
      }
    }
  }, [initialized, token, user, router, requirePlan, planName, refreshUser]);

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading QSToolkit...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return children;
}
