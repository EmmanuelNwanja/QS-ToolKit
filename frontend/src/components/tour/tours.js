/**
 * QSToolkit dashboard tour steps.
 *
 * Each anchored step targets a real element by its `data-tour` attribute; the
 * SpotlightTour engine dims the rest of the screen and pins guidance beside it.
 * Keep selectors in sync with the `data-tour` attributes in Layout.jsx and
 * pages/dashboard.jsx.
 */

/** localStorage keys (stable — the tour completion + resume rely on them). */
export const DASHBOARD_TOUR_KEY = 'qst_onboarding_guide_completed';
export const DASHBOARD_TOUR_RESUME_KEY = 'qst_tour_resume_step';

export const dashboardTour = [
  {
    // Opening card, no anchor, centered.
    title: 'Welcome to QSToolkit 👋',
    body: 'This is your Quantity Surveying command center — measure, cost, invoice and grow your practice. Here\'s a 60-second tour of the essentials.',
    placement: 'center',
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Your command center',
    body: 'The Dashboard is home base. Your project stats, recent BOQs and leaderboard rank all live here, updated live as you work.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-projects"]',
    title: 'Start with a project',
    body: 'Every BOQ, invoice and forecast belongs to a project. Create your first project and everything else falls into place.',
    tip: 'You can create your first project in under two minutes.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-engine"]',
    title: 'AI Engine',
    body: 'Dr. Q is your AI QS assistant — cost forecasts, variance detection and instant answers grounded in Nigerian market rates.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-calculators"]',
    title: '10+ pro calculators',
    body: 'Concrete, masonry, plastering, tiling, steel and more — all tuned to Nigerian standards (SMM7 / NRM2) with current material prices.',
    tip: 'Every calculator result can be saved straight into a BOQ.',
    placement: 'right',
  },
  {
    target: '[data-tour="search"]',
    title: 'Find anything fast',
    body: 'Type at least 3 characters to instantly search your projects, BOQs and invoices from anywhere in the app.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Stay in the loop',
    body: 'Payment confirmations, subscription reminders and platform announcements land here in real time.',
    placement: 'left',
  },
  {
    target: '[data-tour="subscription"]',
    title: 'Upgrade when ready',
    body: 'The free plan gives you room to try things. Upgrade to Starter, Pro or Elite for unlimited projects and the full AI suite.',
    placement: 'left',
  },
  {
    target: '[data-tour="chat-bot"]',
    title: 'Dr. Q — your AI QS',
    body: 'Ask anything in plain language: "How many 9-inch blocks for a 12m × 10m wall?" Dr. Q answers with Nigerian standards in mind.',
    placement: 'left',
  },
  {
    title: 'You\'re all set 🎉',
    body: 'That\'s the quick tour. Create a project, run a calculation, or just ask Dr. Q. Welcome aboard!',
    cta: { label: 'Go to Dashboard', href: '/dashboard' },
    placement: 'center',
  },
];
