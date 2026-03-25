import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get admin user from localStorage or auth context
    const authToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Promo Codes', href: '/admin/promo-codes', icon: '🎟️' },
    { label: 'Users', href: '/admin/users', icon: '👥' },
    { label: 'Subscriptions', href: '/admin/subscriptions', icon: '💳' },
    { label: 'Push Notifications', href: '/admin/notifications', icon: '🔔' },
    { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
    { label: 'Activity Log', href: '/admin/activity-logs', icon: '📋' },
    { label: 'Admins', href: '/admin/manage-admins', icon: '🔐' }
  ];

  const isActive = (href) => {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 shadow-lg transition-all duration-300`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              Q
            </div>
            <span className="font-bold text-gray-800">Admin</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            ☰
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}>
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0) || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {user?.name || 'Admin'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user?.email}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">
            Admin Dashboard
          </h1>
          <button
            onClick={() => {
              localStorage.removeItem('authToken');
              router.push('/auth/login');
            }}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
