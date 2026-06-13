import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useAuthStore from '../context/authStore';
import NotificationBell from './NotificationBell';
import AiChatWidget from './AiChatWidget';
import { clsx } from 'clsx';

const PARAMETRIC_FLAG = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED === 'true';

const NAV_ITEMS = [
  { href: '/dashboard',     icon: '📊', label: 'Dashboard' },
  { href: '/engine',        icon: '🤖', label: 'AI Engine' },
  { href: '/projects',      icon: '📁', label: 'Projects' },
  { href: '/calculators',   icon: '🧮', label: 'Calculators' },
  { href: '/qs-flow',       icon: '🚀', label: 'QS Flow' },
  ...(PARAMETRIC_FLAG ? [{ href: '/parametric', icon: '🧠', label: 'Smart Parametric' }] : []),
  { href: '/boq',           icon: '📋', label: 'Bill of Quantities' },
  { href: '/invoices',      icon: '🧾', label: 'Invoices & Quotes' },
  { href: '/feedback',      icon: '⭐', label: 'Client Feedback' },
  { href: '/leaderboard',   icon: '🏆', label: 'Leaderboard' },
  { href: '/settings',      icon: '⚙️', label: 'Settings' }
];

export default function Layout({ children, title }) {
  const { user, logout, planName } = useAuthStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  // PWA install prompt
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
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, [router.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const onEsc = (event) => {
      if (event.key !== 'Escape') return;
      setSidebarOpen(false);
    };

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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && isMobileViewport && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden cursor-pointer border-0 p-0"
          onClick={() => {
            setSidebarOpen(false);
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold text-sm">QS</span>
            </div>
            <span className="font-display text-lg font-bold text-primary-800">QSToolkit</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const currentPlan = normalizePlan(planName());
            const allowedPlans = (item.plans || []).map(normalizePlan);
            const locked = item.plans && !allowedPlans.includes(currentPlan);
            const active = router.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={locked ? '/subscription' : item.href}
                className={clsx('nav-link', active && 'active', locked && 'opacity-60')}
                title={locked ? `Requires ${item.plans?.[0]} plan` : ''}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {locked && (
                  <span className="text-[10px] font-semibold bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full uppercase">
                    Locked
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{planName()} plan</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
              title="Logout"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-500 hover:text-primary-700 p-1"
              onClick={() => {
                setSidebarOpen(true);
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {title && <h1 className="font-display text-lg font-bold text-primary-800">{title}</h1>}
          </div>

          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="hidden sm:inline-flex items-center gap-1 text-xs text-primary-600 border border-primary-200 bg-primary-50 px-2.5 py-1.5 rounded-full hover:bg-primary-100 transition-colors"
                title="Install QSToolkit as an app"
              >
                ⬇ Install
              </button>
            )}
            <NotificationBell />
            <Link href="/subscription" className="btn-gold text-xs px-3 py-1.5 hidden md:inline-flex">
              {planName() === 'free' ? '⬆ Upgrade' : `✅ ${planName().charAt(0).toUpperCase() + planName().slice(1)}`}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Global AI Chat */}
      <AiChatWidget />
    </div>
  );
}
