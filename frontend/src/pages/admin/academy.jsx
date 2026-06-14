import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

export default function AdminAcademy() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminAPI.getAcademyStats();
      setData(res?.data || res);
      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        setData(null);
        setError('');
      } else {
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (v) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0
  }).format(Number(v || 0));

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">QS Academy Analytics</h1>
              <p className="text-gray-600 mt-1">Subscribers, revenue, pathways, and engagement metrics</p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
          ) : !data ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                No academy data yet. Data appears once users subscribe to QS Academy.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Subscriber KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Academy Subscribers"
                  value={data.total_subscribers ?? 0}
                  icon="🎓"
                />
                <StatCard
                  label="Active Subscriptions"
                  value={data.active_subscribers ?? 0}
                  icon="✅"
                  valueClass="text-green-600"
                />
                <StatCard
                  label="Expired Subscriptions"
                  value={data.expired_subscribers ?? 0}
                  icon="⏰"
                  valueClass="text-amber-600"
                />
                <StatCard
                  label="Total Revenue"
                  value={formatCurrency(data.total_revenue ?? 0)}
                  icon="💰"
                  valueClass="text-emerald-600"
                />
              </div>

              {/* Revenue Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Weekly Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(data.weekly_revenue ?? 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(data.monthly_revenue ?? 0)}</p>
                </div>
              </div>

              {/* Admission Test Stats */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Admission Test Stats</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Total Tests Taken</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.admission_total ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{data.admission_avg_score ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Completion Rate</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{data.admission_completion_rate ?? '—'}</p>
                  </div>
                </div>
              </div>

              {/* Popular Pathways */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Pathways</h3>
                {data.popular_pathways?.length > 0 ? (
                  <div className="space-y-3">
                    {data.popular_pathways.map((pw, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-bold text-gray-400 w-6 text-center">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{pw.name || pw.title}</p>
                          <p className="text-xs text-gray-500">{pw.enrollments ?? 0} enrollments</p>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${Math.min(((pw.enrollments ?? 0) / (data.popular_pathways[0]?.enrollments ?? 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No pathway data available yet.</p>
                )}
              </div>

              {/* Arena Engagement */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Arena Engagement</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Contests Created</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.arena_contests ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Total Participants</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{data.arena_participants ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Tokens Distributed</p>
                    <p className="text-2xl font-bold text-gold-600 mt-1">{(data.arena_tokens ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Resource Library */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Library</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm text-gray-600">Total Resources</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{data.resource_total ?? 0}</p>
                  </div>
                  {data.resource_by_category?.length > 0 ? (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm text-gray-600 mb-2">By Category</p>
                      <div className="space-y-1">
                        {data.resource_by_category.map((cat, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700 capitalize">{cat.category || cat.name}</span>
                            <span className="font-medium text-gray-900">{cat.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm text-gray-600">No category breakdown available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}

function StatCard({ label, value, icon, valueClass = '' }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 text-sm font-medium">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold mt-2 ${valueClass || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
