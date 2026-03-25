import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import api from '../../services/api';

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState(null);

  // Fetch data based on active tab
  const fetchData = async (tab) => {
    try {
      setLoading(true);
      const queryParams = {
        startDate,
        endDate,
        ...(tab !== 'summary' && tab !== 'cohorts' && { groupBy })
      };

      let endpoint = `/admin/analytics/summary`;
      if (tab === 'growth') endpoint = `/admin/analytics/growth`;
      if (tab === 'revenue') endpoint = `/admin/analytics/revenue`;
      if (tab === 'subscriptions') endpoint = `/admin/analytics/subscriptions`;
      if (tab === 'cohorts') endpoint = `/admin/analytics/cohorts`;

      const response = await api.get(endpoint, { params: queryParams });
      setData(response.data?.data);
      setError('');
    } catch (err) {
      console.error('Analytics error:', err);
      if (err.response?.status === 401) {
        setError('Unauthorized - Admin access required');
      } else {
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, startDate, endDate, groupBy]);

  const renderSummary = () => {
    if (!data?.summary) return null;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Total Users</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{data.summary.total_users.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600 mt-2">₦{data.summary.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Active Subscriptions</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{data.summary.active_subscriptions.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Conversion Rate</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{data.summary.conversion_rate}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Churn Rate</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{data.summary.churn_rate}</p>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth Trend</h3>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <SimpleLineChart data={data.user_growth} />
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <SimpleLineChart data={data.revenue_trend} valueKey="net_revenue" />
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.subscription_breakdown && Object.entries(data.subscription_breakdown).map(([plan, stats]) => (
            <div key={plan} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600 text-sm font-medium capitalize">{plan} Plan</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.active} active</p>
              <p className="text-sm text-gray-500 mt-1">{stats.count} total subscribers</p>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.active / stats.count) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* 7-Day Forecast */}
        {data.forecast && data.forecast.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Forecast (Next 7 Days)</h3>
            <div className="space-y-3">
              {data.forecast.map((f) => (
                <div key={f.day_ahead} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-900">Day {f.day_ahead}</span>
                  <span className="text-sm text-gray-600">₦{f.forecasted_revenue.toLocaleString()}</span>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    f.confidence === 'high' ? 'bg-green-100 text-green-800' :
                    f.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {f.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGrowth = () => {
    if (!data?.growth_trend) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-gray-600 text-sm">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{data.total_users.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Active Users</p>
              <p className="text-3xl font-bold text-blue-600">{data.active_users.toLocaleString()}</p>
            </div>
          </div>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <SimpleLineChart data={data.growth_trend} valueKey="cumulativeUsers" />
          </div>
        </div>
      </div>
    );
  };

  const renderRevenue = () => {
    if (!data?.revenue_trend) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Gross Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">₦{data.total_gross_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Total Refunds</p>
            <p className="text-2xl font-bold text-red-600 mt-2">₦{data.total_refunds.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Net Revenue</p>
            <p className="text-2xl font-bold text-green-600 mt-2">₦{data.total_net_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Avg Transaction</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">₦{data.average_transaction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <SimpleLineChart data={data.revenue_trend} valueKey="net_revenue" />
          </div>
        </div>
      </div>
    );
  };

  const renderSubscriptions = () => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Conversion Rate</p>
            <p className="text-4xl font-bold text-purple-600 mt-2">{data.conversion_rate}</p>
            <p className="text-sm text-gray-500 mt-2">{data.free_to_paying_converted} / {data.free_users} converted to paid</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Churn Rate</p>
            <p className="text-4xl font-bold text-red-600 mt-2">{data.churn_rate}</p>
            <p className="text-sm text-gray-500 mt-2">{data.churn_events} churned / {data.total_subscriptions} total</p>
          </div>
        </div>

        {/* Plan Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.by_plan && Object.entries(data.by_plan).map(([plan, stats]) => (
            <div key={plan} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-900 font-semibold text-lg capitalize">{plan} Plan</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Subscriptions</span>
                  <span className="font-medium text-gray-900">{stats.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active</span>
                  <span className="font-medium text-green-600">{stats.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Churned</span>
                  <span className="font-medium text-red-600">{stats.churned}</span>
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(stats.active / stats.count) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCohorts = () => {
    if (!data?.cohorts) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Cohort Month</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Signups</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Active</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Retained (90d)</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Active Rate</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Retention Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.cohorts.map((cohort, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{cohort.month}</td>
                <td className="px-6 py-4 text-gray-900">{cohort.signups}</td>
                <td className="px-6 py-4 text-green-600 font-medium">{cohort.active}</td>
                <td className="px-6 py-4 text-blue-600 font-medium">{cohort.retained}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${parseFloat(cohort.active_rate)}%` }}
                      ></div>
                    </div>
                    <span className="text-gray-900 font-medium">{cohort.active_rate}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${parseFloat(cohort.retention_rate)}%` }}
                      ></div>
                    </div>
                    <span className="text-gray-900 font-medium">{cohort.retention_rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.cohorts.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Average Active Rate: <span className="font-semibold text-gray-900">{data.average_active_rate}%</span>
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <ProtectedAdminRoute requiredPermission="view_analytics">
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics</h1>
            <p className="text-gray-600">Comprehensive insights into user growth, revenue, and subscriptions</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(activeTab === 'growth' || activeTab === 'revenue') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200 mb-6">
            {['summary', 'growth', 'revenue', 'subscriptions', 'cohorts'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-colors border-b-2 capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Content */}
          {!loading && (
            <>
              {activeTab === 'summary' && renderSummary()}
              {activeTab === 'growth' && renderGrowth()}
              {activeTab === 'revenue' && renderRevenue()}
              {activeTab === 'subscriptions' && renderSubscriptions()}
              {activeTab === 'cohorts' && renderCohorts()}
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}

/**
 * Simple line chart component using ASCII visualization
 */
function SimpleLineChart({ data, valueKey = 'cumulativeUsers' }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>;
  }

  // Find max value for scaling
  const values = data.map(d => parseFloat(d[valueKey] || 0));
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue;

  // Create simple bar chart
  return (
    <div className="w-full p-4">
      <div className="space-y-1">
        {data.slice(-14).map((point, idx) => {
          const value = parseFloat(point[valueKey] || 0);
          const percentage = range === 0 ? 50 : ((value - minValue) / range) * 100;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20">{point.period}</span>
              <div className="flex-1 bg-gray-200 rounded h-6 overflow-hidden">
                <div
                  className="bg-blue-600 h-6 flex items-center justify-end px-2 transition-all"
                  style={{ width: `${Math.max(percentage, 5)}%` }}
                >
                  <span className="text-xs text-white font-medium">{value.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
