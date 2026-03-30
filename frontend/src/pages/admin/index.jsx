import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';
import useAuthStore from '../../context/authStore';

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
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
  const financial = stats?.financialModel;
  const formatCurrency = (value) => new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    <p className="text-gray-600 text-sm font-medium">Actual Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(stats?.totalRevenue || 0)}
                    </p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>

              {/* Discounts Granted */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Discounts Granted</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(financial?.discountedPaymentsValue || 0)}
                    </p>
                  </div>
                  <div className="text-4xl">🏷️</div>
                </div>
              </div>

              {/* MRR */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">MRR Projection</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(financial?.monthlyRecurringRevenue || 0)}
                    </p>
                  </div>
                  <div className="text-4xl">📈</div>
                </div>
              </div>

              {/* Next 30 days */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Next 30 Days</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(financial?.next30DayProjection || 0)}
                    </p>
                  </div>
                  <div className="text-4xl">🗓️</div>
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

            {user?.admin_role === 'super_admin' && financial && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr,1fr]">
                <section className="bg-slate-950 text-white rounded-2xl shadow-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_45%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,0.92))]">
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-200/80">Financial Model</p>
                    <h3 className="text-2xl font-bold mt-2">Subscription economics at a glance</h3>
                    <p className="text-sm text-slate-300 mt-2 max-w-2xl">
                      Tracks list-price billings, discounts granted, realized cash, and forward recurring value from active subscriptions.
                    </p>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">List Price Value</p>
                      <p className="text-3xl font-bold mt-2">{formatCurrency(financial.grossSubscriptionValue)}</p>
                      <p className="text-sm text-slate-300 mt-2">Booked subscription value before promo discounts.</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-400/10 border border-emerald-300/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Collected Cash</p>
                      <p className="text-3xl font-bold mt-2 text-emerald-100">{formatCurrency(financial.collectedRevenue)}</p>
                      <p className="text-sm text-emerald-50/80 mt-2">Successful subscription payments before refunds.</p>
                    </div>
                    <div className="rounded-2xl bg-amber-400/10 border border-amber-300/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-amber-200">ARR Projection</p>
                      <p className="text-3xl font-bold mt-2 text-amber-50">{formatCurrency(financial.annualRecurringRevenue)}</p>
                      <p className="text-sm text-amber-50/80 mt-2">Annualized recurring revenue from today&apos;s active paid subscribers.</p>
                    </div>
                    <div className="rounded-2xl bg-fuchsia-400/10 border border-fuchsia-300/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200">Realization Rate</p>
                      <p className="text-3xl font-bold mt-2 text-fuchsia-50">{Number(financial.revenueRealizationRate || 0).toFixed(1)}%</p>
                      <p className="text-sm text-fuchsia-50/80 mt-2">Share of list-price value converted into collected cash.</p>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-2xl shadow p-6 border border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Finance Signals</p>
                      <h3 className="text-xl font-bold text-gray-900 mt-1">Operational summary</h3>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {financial.activePaidSubscribers || 0} active paid users
                    </span>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600">Discounted payments</span>
                        <span className="text-lg font-semibold text-gray-900">{financial.discountedTransactionsCount || 0}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Captured cash from discounted transactions: {formatCurrency(financial.discountedCollections || 0)}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600">Average payment value</span>
                        <span className="text-lg font-semibold text-gray-900">{formatCurrency(financial.averageTransactionValue || 0)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Average collected amount per completed subscription payment.</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600">Refunded revenue</span>
                        <span className="text-lg font-semibold text-gray-900">{formatCurrency(financial.refundedRevenue || 0)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Processed refunds already deducted from actual revenue.</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600">Current MRR</span>
                        <span className="text-lg font-semibold text-gray-900">{formatCurrency(financial.monthlyRecurringRevenue || 0)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Monthlyized value of active paid subscriptions across billing cycles.</p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {user?.admin_role === 'super_admin' && financial && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.9fr]">
                <section className="bg-white rounded-2xl shadow p-6 border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Plan performance</h3>
                      <p className="text-sm text-gray-500">Gross billings, discounts, realized revenue, and projected monthly value per plan.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-3 pr-4 font-medium">Plan</th>
                          <th className="py-3 pr-4 font-medium">Active</th>
                          <th className="py-3 pr-4 font-medium">Gross</th>
                          <th className="py-3 pr-4 font-medium">Discounts</th>
                          <th className="py-3 pr-4 font-medium">Actual</th>
                          <th className="py-3 font-medium">MRR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(financial.planPerformance || []).map((plan) => (
                          <tr key={plan.plan_name} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-4 font-semibold text-gray-900 capitalize">{plan.plan_name}</td>
                            <td className="py-3 pr-4 text-gray-700">{plan.active_subscribers}</td>
                            <td className="py-3 pr-4 text-gray-700">{formatCurrency(plan.gross_revenue)}</td>
                            <td className="py-3 pr-4 text-amber-700">{formatCurrency(plan.discounted_revenue)}</td>
                            <td className="py-3 pr-4 text-emerald-700 font-semibold">{formatCurrency(plan.actual_revenue)}</td>
                            <td className="py-3 text-gray-700">{formatCurrency(plan.projected_monthly_revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="bg-white rounded-2xl shadow p-6 border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Recent subscription payments</h3>
                      <p className="text-sm text-gray-500">Latest recorded charges with gross, discount, and realized payment values.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(financial.recentTransactions || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                        No subscription payments recorded yet.
                      </div>
                    ) : (
                      (financial.recentTransactions || []).map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-gray-200 px-4 py-3 bg-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{payment.customer_name}</p>
                              <p className="text-xs text-gray-500">{payment.customer_email || 'No email available'} · {payment.plan_name} · {payment.billing_cycle}</p>
                            </div>
                            <span className="text-xs rounded-full bg-white border border-gray-200 px-2.5 py-1 text-gray-600">
                              {new Date(payment.transaction_date).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                            <div>
                              <p className="text-gray-500">Gross</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(payment.gross_amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Discount</p>
                              <p className="font-semibold text-amber-700">{formatCurrency(payment.discount_amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Paid</p>
                              <p className="font-semibold text-emerald-700">{formatCurrency(payment.net_amount)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
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

              {user?.admin_role === 'super_admin' && (
                <a
                  href="/admin/paystack-plans"
                  className="flex items-center gap-3 p-4 border-2 border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <span className="text-2xl">🧩</span>
                  <div>
                    <p className="font-medium text-gray-900">Paystack Plan Mapping</p>
                    <p className="text-sm text-gray-600">Manage recurring billing plan codes</p>
                  </div>
                </a>
              )}
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
