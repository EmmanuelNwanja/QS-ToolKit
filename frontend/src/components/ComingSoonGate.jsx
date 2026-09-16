import { useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../context/authStore';
import useFeatureFlags from '../services/featureFlags';

export default function ComingSoonGate({ children, featureKey }) {
  const { user, loading, initialized } = useAuthStore();
  const isFeatureEnabled = useFeatureFlags((s) => s.isEnabled);
  const flagsLoaded = useFeatureFlags((s) => s.loaded);
  const router = useRouter();

  const isAllowed = featureKey ? isFeatureEnabled(featureKey) : user?.is_admin;

  useEffect(() => {
    if (loading || !initialized || !flagsLoaded) return;
    if (user && !isAllowed) {
      router.replace('/dashboard');
    }
  }, [user, loading, initialized, flagsLoaded, isAllowed, router]);

  if (loading || !initialized || !flagsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading QSToolkit...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAllowed) return null;
  return children;
}
