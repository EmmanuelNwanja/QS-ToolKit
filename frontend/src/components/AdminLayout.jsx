import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu } from 'antd';
import {
  DashboardOutlined, UserOutlined, CreditCardOutlined, BankOutlined,
  TagsOutlined, NotificationOutlined, BarChartOutlined, ReadOutlined,
  FileTextOutlined, SafetyCertificateOutlined, TeamOutlined,
  RobotOutlined, SettingOutlined, SafetyOutlined, BookOutlined,
  ThunderboltOutlined, FlagOutlined, GiftOutlined,
} from '@ant-design/icons';
import useAuthStore from '../context/authStore';
import { adminAPI } from '../services/api';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard', href: '/admin' },
    ],
  },
  {
    label: 'Users & Access',
    items: [
      { key: '/admin/users', icon: <TeamOutlined />, label: 'Users', href: '/admin/users' },
      { key: '/admin/subscriptions', icon: <CreditCardOutlined />, label: 'Subscriptions', href: '/admin/subscriptions', superAdminOnly: true },
      { key: '/admin/manage-admins', icon: <SafetyCertificateOutlined />, label: 'Admins', href: '/admin/manage-admins', superAdminOnly: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: '/admin/direct-payments', icon: <BankOutlined />, label: 'Direct Payments', href: '/admin/direct-payments' },
      { key: '/admin/bank-transfer-settings', icon: <BankOutlined />, label: 'Bank Transfer', href: '/admin/bank-transfer-settings' },
      { key: '/admin/promo-codes', icon: <TagsOutlined />, label: 'Promo Codes', href: '/admin/promo-codes' },
      { key: '/admin/referral-discounts', icon: <TeamOutlined />, label: 'Referral Rewards', href: '/admin/referral-discounts', superAdminOnly: true },
      { key: '/admin/gifting', icon: <GiftOutlined />, label: 'Gifting', href: '/admin/gifting' },
    ],
  },
  {
    label: 'Content',
    items: [
      { key: '/admin/ai-engine', icon: <RobotOutlined />, label: 'AI Engine', href: '/admin/ai-engine' },
      { key: '/admin/academy', icon: <ReadOutlined />, label: 'Academy', href: '/admin/academy' },
      { key: '/admin/exam-prep', icon: <FileTextOutlined />, label: 'Exam Prep', href: '/admin/exam-prep' },
    ],
  },
  {
    label: 'Learning (Live)',
    items: [
      { key: '/classroom', icon: <BookOutlined />, label: 'Classroom', href: '/classroom' },
      { key: '/academy-l', icon: <ReadOutlined />, label: 'QS Academy', href: '/academy' },
      { key: '/exam-prep-l', icon: <FileTextOutlined />, label: 'Exam Prep', href: '/exam-prep' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: '/admin/quotas', icon: <ThunderboltOutlined />, label: 'API Quotas', href: '/admin/quotas' },
      { key: '/admin/feature-flags', icon: <FlagOutlined />, label: 'Feature Flags', href: '/admin/feature-flags' },
      { key: '/admin/notifications', icon: <NotificationOutlined />, label: 'Push Notifications', href: '/admin/notifications' },
      { key: '/admin/analytics', icon: <BarChartOutlined />, label: 'Analytics', href: '/admin/analytics' },
      { key: '/admin/activity-logs', icon: <FileTextOutlined />, label: 'Activity Log', href: '/admin/activity-logs', superAdminOnly: true },
    ],
  },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [router.pathname]);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data } = await adminAPI.verify();
        setIsSuperAdmin(!!data?.isSuperAdmin);
      } catch { setIsSuperAdmin(false); }
    };
    checkRole();
  }, []);

  const isActive = (href) =>
    router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href + '/'));

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';

  const activeKey = NAV_GROUPS.flatMap(g => g.items)
    .filter(i => i.key !== '/admin')
    .find(i => router.pathname.startsWith(i.key))?.key || '/admin';

  const menuItems = NAV_GROUPS
    .map(group => ({
      type: 'group',
      label: <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{group.label}</span>,
      children: group.items
        .filter(item => !item.superAdminOnly || isSuperAdmin)
        .map(item => ({
          key: item.key,
          icon: item.icon,
          label: <Link href={item.href} scroll={false}>{item.label}</Link>,
        })),
    }))
    .filter(group => group.children.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <button type="button" aria-label="Close menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden cursor-pointer border-0 p-0"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-30 w-64 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col',
        'transition-transform duration-300',
        'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <Link href="/admin">
            <img src="/qs-toolkit-logo.png" alt="QSToolkit Admin" className="h-12 w-auto max-w-[180px]" />
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

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={() => { logout(); router.push('/auth/login'); }}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center" title="Logout">
              ↩
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button className="lg:hidden text-gray-500 hover:text-primary-700 p-2 -ml-2" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Admin Dashboard</h1>
            {process.env.NEXT_PUBLIC_STAGING === 'true' && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Staging
              </span>
            )}
          </div>
          <Link href="/dashboard"
            className="text-sm text-gray-500 hover:text-primary-700 transition-colors px-2.5 sm:px-3 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap flex-shrink-0">
            ← User View
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
