import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchSecurityAlerts();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStats();
      setStats(response.data?.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityAlerts = async () => {
    try {
      setAlertsLoading(true);
      const response = await adminAPI.getActivityLogs({
        action: 'generated_one_time_password',
        limit: 8
      });
      setSecurityAlerts(response.data?.logs || []);
    } catch (err) {
      setSecurityAlerts([]);
      console.error('Failed to load security alerts', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const lastUpdated = stats?.generated_at
    ? new Date(stats.generated_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Page Title */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Welcome to Admin Dashboard</h2>
              <p className="text-gray-600 mt-1">Manage promo codes, users, subscriptions, and more</p>
            </div>
            <button
              type="button"
              onClick={fetchDashboardStats}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Quick Stats */}
          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : (
            <>
              {lastUpdated && (
                <p className="text-xs text-gray-500">Last refreshed: {lastUpdated}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats?.totalUsers || 0}
                    </p>
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              {/* Active Subscriptions */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Active Subscriptions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats?.activeSubscriptions || 0}
                    </p>
                  </div>
                  <div className="text-4xl">💳</div>
                </div>
              </div>

              {/* Total Revenue */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₦{(stats?.totalRevenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>

              {/* Active Promo Codes */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Active Promo Codes</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats?.activePromoCodes || 0}
                    </p>
                  </div>
                  <div className="text-4xl">🎟️</div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/admin/promo-codes"
                className="flex items-center gap-3 p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl">🎟️</span>
                <div>
                  <p className="font-medium text-gray-900">Manage Promo Codes</p>
                  <p className="text-sm text-gray-600">Create and manage discount codes</p>
                </div>
              </a>

              <a
                href="/admin/users"
                className="flex items-center gap-3 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                <span className="text-2xl">👥</span>
                <div>
                  <p className="font-medium text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-600">View and manage user accounts</p>
                </div>
              </a>

              <a
                href="/admin/notifications"
                className="flex items-center gap-3 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-medium text-gray-900">Send Notifications</p>
                  <p className="text-sm text-gray-600">Push notifications to users</p>
                </div>
              </a>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Security Notifications</h3>
              <button
                type="button"
                onClick={fetchSecurityAlerts}
                className="text-sm font-medium text-primary-700 hover:text-primary-800"
                disabled={alertsLoading}
              >
                {alertsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {alertsLoading ? (
              <div className="text-center py-8 text-gray-500">
                <p>Loading security notifications...</p>
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No OTP notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {securityAlerts.map((log) => (
                  <div key={log.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">
                      One-time password created for {log.details?.user_email || 'a user'}
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                      Expires {log.details?.expires_at ? new Date(log.details.expires_at).toLocaleString() : 'soon'}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Logged {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
