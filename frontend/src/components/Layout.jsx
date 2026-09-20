import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu } from 'antd';
import {
  DashboardOutlined, RobotOutlined, FolderOutlined, CalculatorOutlined,
  ReadOutlined, TrophyOutlined, SettingOutlined, FileTextOutlined,
  ReconciliationOutlined, StarOutlined, RocketOutlined, ApartmentOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import useAuthStore from '../context/authStore';
import NotificationBell from './NotificationBell';
import AiChatWidget from './ui/ai-chat';
import Search from './ui/Search';
import ProductTour from './tour/ProductTour';
import { clsx } from 'clsx';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', href: '/dashboard', tourKey: 'nav-dashboard' },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { key: '/engine', icon: <RobotOutlined />, label: 'AI Engine', href: '/engine', tourKey: 'nav-engine' },
      { key: '/qs-flow', icon: <RocketOutlined />, label: 'QS Flow', href: '/qs-flow' },
      { key: '/parametric', icon: <ApartmentOutlined />, label: 'Smart Parametric', href: '/parametric', disabled: true, comingSoon: true },
    ],
  },
  {
    label: 'Projects',
    items: [
      { key: '/projects', icon: <FolderOutlined />, label: 'Projects', href: '/projects', tourKey: 'nav-projects' },
      { key: '/boq', icon: <FileTextOutlined />, label: 'Bill of Quantities', href: '/boq' },
      { key: '/calculators', icon: <CalculatorOutlined />, label: 'Calculators', href: '/calculators', tourKey: 'nav-calculators' },
    ],
  },
  {
    label: 'Business',
    items: [
      { key: '/invoices', icon: <ReconciliationOutlined />, label: 'Invoices & Quotes', href: '/invoices' },
      { key: '/feedback', icon: <StarOutlined />, label: 'Client Feedback', href: '/feedback' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { key: '/classroom', icon: <ReadOutlined />, label: 'Classroom', href: '/classroom', disabled: true, comingSoon: true },
      { key: '/academy', icon: <ReadOutlined />, label: 'QS Academy', href: '/academy', disabled: true, comingSoon: true },
      { key: '/exam-prep', icon: <ReadOutlined />, label: 'Exam Prep', href: '/exam-prep', disabled: true, comingSoon: true },
    ],
  },
  {
    label: 'Community',
    items: [
      { key: '/leaderboard', icon: <TrophyOutlined />, label: 'Leaderboard', href: '/leaderboard' },
      { key: '/gifting', icon: <GiftOutlined />, label: 'Gift a Subscription', href: '/gifting' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings', href: '/settings' },
    ],
  },
];

export default function Layout({ children, title }) {
  const { user, logout, planName } = useAuthStore();

  const PLAN_DISPLAY_NAMES = { free: 'Free', basic: 'Starter', pro: 'Pro', enterprise: 'Elite' };
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [router.pathname]);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstallPrompt(null));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportMode = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileViewport(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, [router.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onEsc = (event) => { if (event.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [sidebarOpen, router.pathname]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const normalizePlan = (value) => {
    const raw = String(value || '').toLowerCase();
    return raw === 'student' ? 'basic' : raw;
  };

  const currentPlan = normalizePlan(planName());
  const activeKey = router.pathname === '/dashboard' ? '/dashboard'
    : NAV_GROUPS.flatMap(g => g.items).find(i => i.key !== '/dashboard' && router.pathname.startsWith(i.key))?.key
    || '/dashboard';

  const menuItems = NAV_GROUPS.map(group => ({
    type: 'group',
    label: <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{group.label}</span>,
    children: group.items.map(item => {
      const locked = item.plans && !item.plans.map(normalizePlan).includes(currentPlan);
      const isComingSoon = item.disabled && item.comingSoon;
      const wrappedLabel = item.tourKey ? <span data-tour={item.tourKey}>{item.label}</span> : item.label;
      const label = isComingSoon ? (
          <span className="flex items-center gap-1 text-gray-400 cursor-not-allowed">
            {wrappedLabel}
            <span className="text-[9px] font-semibold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full ml-auto">Soon</span>
          </span>
        ) : locked ? (
          <Link href="/subscription" scroll={false} className="flex items-center gap-1">
            {wrappedLabel}
            <span className="text-[9px] font-semibold bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full ml-auto">Locked</span>
          </Link>
        ) : (
          <Link href={item.href} scroll={false}>{wrappedLabel}</Link>
        );

      return {
        key: item.key,
        icon: item.icon,
        label,
        disabled: item.disabled,
      };
    }),
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && isMobileViewport && (
        <button type="button" aria-label="Close menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden cursor-pointer border-0 p-0"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <Link href="/dashboard">
            <img src="/qs-toolkit-logo-2.png" alt="QSToolkit" className="h-[44px] w-auto max-w-[180px]" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            items={menuItems}
            className="border-none bg-transparent"
            style={{ background: 'transparent' }}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500">{PLAN_DISPLAY_NAMES[planName()] || planName()} plan</p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center" title="Logout">
              ↩
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button className="lg:hidden text-gray-500 hover:text-primary-700 p-2 -ml-2" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {title && <h1 className="font-display text-base sm:text-lg font-bold text-primary-800 truncate">{title}</h1>}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div data-tour="search" className="hidden sm:block">
              <Search />
            </div>
            {installPrompt && (
              <button onClick={handleInstall}
                className="hidden lg:inline-flex items-center gap-1 text-xs text-primary-600 border border-primary-200 bg-primary-50 px-2.5 py-1.5 rounded-full hover:bg-primary-100 transition-colors"
                title="Install QSToolkit as an app"
              >
                Install
              </button>
            )}
            <div data-tour="notifications">
              <NotificationBell />
            </div>
            <div data-tour="subscription">
              <Link href="/subscription" className="btn-gold text-xs px-3 py-1.5 hidden md:inline-flex">
                {planName() === 'free' ? 'Upgrade' : PLAN_DISPLAY_NAMES[planName()] || planName()}
              </Link>
            </div>
            <button
              type="button"
              aria-label="Replay product tour"
              title="Replay product tour"
              onClick={() => window.dispatchEvent(new Event('qst:replay-tour'))}
              className="hidden sm:inline-flex text-gray-400 hover:text-primary-700 transition-colors p-1.5 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <AiChatWidget />
      <ProductTour />
    </div>
  );
}
