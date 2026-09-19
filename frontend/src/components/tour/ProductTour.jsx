import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SpotlightTour from './SpotlightTour';
import { dashboardTour, DASHBOARD_TOUR_KEY, DASHBOARD_TOUR_RESUME_KEY } from './tours';

/**
 * ProductTour — first-login floating product tour for QSToolkit.
 *
 * Mount this ONCE inside Layout (user shell). On first visit to the dashboard
 * it plays the guided tour and stores completion in localStorage. The user can
 * replay it anytime from the header help button (dispatches `qst:replay-tour`).
 *
 * Router-guarded: only runs on /dashboard so the tour doesn't re-trigger when
 * users navigate back to the dashboard from other pages after completion.
 */
export default function ProductTour() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Mark readiness after first paint so localStorage + router are settled.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Auto-start on first dashboard visit.
  useEffect(() => {
    if (!ready || router.pathname !== '/dashboard') return;
    let played = false;
    try {
      played = window.localStorage.getItem(DASHBOARD_TOUR_KEY) === 'true';
    } catch { /* private browsing */ }
    if (!played) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [ready, router.pathname]);

  // Replay support: header help button dispatches this event.
  useEffect(() => {
    const replay = () => {
      try { window.localStorage.removeItem(DASHBOARD_TOUR_RESUME_KEY); } catch { /* ignore */ }
      setOpen(true);
    };
    window.addEventListener('qst:replay-tour', replay);
    return () => window.removeEventListener('qst:replay-tour', replay);
  }, []);

  const handleClose = ({ completed }) => {
    setOpen(false);
    try {
      window.localStorage.setItem(DASHBOARD_TOUR_KEY, 'true');
      window.localStorage.removeItem(DASHBOARD_TOUR_RESUME_KEY);
    } catch { /* ignore */ }
    if (completed) {
      // Gentle nudge toward first project creation after the tour completes.
      // (No navigation — the user is already on the dashboard.)
    }
  };

  if (router.pathname !== '/dashboard') return null;

  return (
    <SpotlightTour
      steps={dashboardTour}
      isOpen={open}
      onClose={handleClose}
    />
  );
}
