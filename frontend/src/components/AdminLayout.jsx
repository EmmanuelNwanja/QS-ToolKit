import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useAuthStore from '../context/authStore';
import { adminAPI } from '../services/api';

const NAV_ITEMS = [
  { label: 'Dashboard',          href: '/admin',                icon: '📊' },
  { label: 'AI Engine',          href: '/admin/ai-engine',      icon: '🤖' },
  { label: 'Promo Codes',        href: '/admin/promo-codes',    icon: '🎟️' },
  { label: 'Users',              href: '/admin/users',          icon: '👥' },
  { label: 'Subscriptions',      href: '/admin/subscriptions',  icon: '💳', superAdminOnly: true },
  { label: 'Paystack Plans',     href: '/admin/paystack-plans', icon: '🧩', superAdminOnly: true },
  { label: 'Push Notifications', href: '/admin/notifications',  icon: '🔔' },
  { label: 'Analytics',          href: '/admin/analytics',      icon: '📈' },
  { label: 'Activity Log',       href: '/admin/activity-logs',  icon: '📋', superAdminOnly: true },
  { label: 'Admins',             href: '/admin/manage-admins',  icon: '🔐', superAdminOnly: true },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data } = await adminAPI.verify();
        setIsSuperAdmin(!!data?.isSuperAdmin);
      } catch {
        setIsSuperAdmin(false);
      }
    };

    checkRole();
  }, []);

  const isActive = (href) =>
    router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href + '/'));

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden cursor-pointer border-0 p-0"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={[
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col',
        'transition-transform duration-300',
        'lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold text-sm">QS</span>
            </div>
            <div className="leading-none">
              <p className="font-bold text-gray-800 text-sm">QSToolkit</p>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS
            .filter((item) => !item.superAdminOnly || isSuperAdmin)
            .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { logout(); router.push('/auth/login'); }}
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-500 hover:text-primary-700 p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Admin Dashboard</h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-primary-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            ← User View
          </Link>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

