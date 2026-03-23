import { useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../context/authStore';

export default function ProtectedRoute({ children, requirePlan }) {
  const { user, token, loading, initialized, planName } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    if (!token || !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.pathname)}`);
      return;
    }
    if (!user.onboarding_completed) {
      router.replace('/auth/onboarding');
      return;
    }
    if (requirePlan) {
      const hierarchy = ['free', 'student', 'pro', 'enterprise'];
      const current = planName();
      if (hierarchy.indexOf(current) < hierarchy.indexOf(requirePlan)) {
        router.replace('/subscription');
      }
    }
  }, [initialized, token, user, router, requirePlan]);

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
