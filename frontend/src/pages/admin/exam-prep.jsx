import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

export default function AdminExamPrep() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: res } = await adminAPI.getExamPrepStats();
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
              <h1 className="text-3xl font-bold text-gray-900">QS Exam Prep Analytics</h1>
              <p className="text-gray-600 mt-1">Subscribers, exam performance, question bank & university stats</p>
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
              <p className="text-4xl mb-3">📝</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                No exam prep data yet. Data appears once users subscribe to Exam Prep.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Subscriber KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Exam Prep Subscribers"
                  value={data.total_subscribers ?? 0}
                  icon="📝"
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

              {/* Popular Exams */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Exams</h3>
                {data.popular_exams?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-3 pr-4 font-medium">#</th>
                          <th className="py-3 pr-4 font-medium">Exam</th>
                          <th className="py-3 pr-4 font-medium">Category</th>
                          <th className="py-3 pr-4 font-medium">Attempts</th>
                          <th className="py-3 font-medium">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.popular_exams.map((exam, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-4 text-gray-400 font-medium">{idx + 1}</td>
                            <td className="py-3 pr-4 font-semibold text-gray-900">{exam.name || exam.title}</td>
                            <td className="py-3 pr-4 text-gray-600 capitalize">{exam.category || '—'}</td>
                            <td className="py-3 pr-4 text-gray-900">{(exam.attempts ?? 0).toLocaleString()}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${parseFloat(exam.pass_rate ?? 0)}%` }}
                                  />
                                </div>
                                <span className="text-gray-900 font-medium">{exam.pass_rate ?? '—'}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No exam data available yet.</p>
                )}
              </div>

              {/* Pass Rates by Exam Type */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pass Rates by Exam Type</h3>
                {data.pass_rates_by_type?.length > 0 ? (
                  <div className="space-y-3">
                    {data.pass_rates_by_type.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 w-32 truncate">{item.type || item.category}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full ${
                              parseFloat(item.pass_rate ?? 0) >= 70 ? 'bg-green-500' :
                              parseFloat(item.pass_rate ?? 0) >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(parseFloat(item.pass_rate ?? 0), 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-12 text-right">{item.pass_rate ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No pass rate data available yet.</p>
                )}
              </div>

              {/* Question Bank & Average Score */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Bank</h3>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm text-gray-600">Total Questions</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{(data.question_bank_total ?? 0).toLocaleString()}</p>
                    </div>
                    {data.question_bank_by_category?.length > 0 && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                        <p className="text-sm text-gray-600 mb-2">By Category</p>
                        <div className="space-y-1">
                          {data.question_bank_by_category.map((cat, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">{cat.category || cat.name}</span>
                              <span className="font-medium text-gray-900">{(cat.count ?? 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trends</h3>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm text-gray-600">Average Score (All Exams)</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">{data.avg_score ?? '—'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-sm text-gray-600">Total Attempts</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{(data.total_attempts ?? 0).toLocaleString()}</p>
                    </div>
                    {data.score_trend?.length > 0 && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                        <p className="text-sm text-gray-600 mb-2">Recent Trend</p>
                        <div className="space-y-1">
                          {data.score_trend.slice(-5).map((t, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">{t.period || t.date}</span>
                              <span className="font-medium text-gray-900">{t.avg_score ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* University Usage */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">University Usage Stats</h3>
                {data.university_stats?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-3 pr-4 font-medium">University</th>
                          <th className="py-3 pr-4 font-medium">Students</th>
                          <th className="py-3 pr-4 font-medium">Total Attempts</th>
                          <th className="py-3 font-medium">Avg Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.university_stats.map((uni, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-4 font-semibold text-gray-900">{uni.name || uni.university}</td>
                            <td className="py-3 pr-4 text-gray-900">{(uni.students ?? 0).toLocaleString()}</td>
                            <td className="py-3 pr-4 text-gray-900">{(uni.attempts ?? 0).toLocaleString()}</td>
                            <td className="py-3 text-gray-900 font-medium">{uni.avg_score ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No university data available yet.</p>
                )}
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
