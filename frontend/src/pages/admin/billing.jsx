import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import api from '../../services/api';

export default function BillingAudit() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [userId, setUserId] = useState('');

  // Fetch revenue report
  const fetchRevenueReport = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/billing/reports/revenue`,
        { params: { startDate, endDate } }
      );
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching revenue report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch churn analysis
  const fetchChurnAnalysis = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/billing/reports/churn`,
        { params: { startDate, endDate } }
      );

      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching churn analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user transactions
  const fetchUserTransactions = async () => {
    if (!userId) {
      setError('Please enter a user ID');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(
        `/billing/users/${userId}/transactions`,
        { params: { startDate, endDate, limit: 100 } }
      );
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching user transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export transactions
  const handleExport = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(userId && { userId })
      });

      const response = await fetch(`/api/billing/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${Date.now()}.csv`;
      link.click();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') {
      fetchRevenueReport();
    } else if (activeTab === 'churn') {
      fetchChurnAnalysis();
    }
  }, [activeTab, startDate, endDate]);

  return (
    <ProtectedAdminRoute requiredPermission="manage_billing">
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Revenue Audit</h1>
            <p className="text-gray-600">Track transactions, revenue, and subscription metrics</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Date Range Filter */}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for all"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleExport}
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-4 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'revenue'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Revenue Report
            </button>
            <button
              onClick={() => setActiveTab('churn')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'churn'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Churn Analysis
            </button>
            <button
              onClick={() => {
                setActiveTab('transactions');
                fetchUserTransactions();
              }}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Transaction History
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Revenue Report Tab */}
          {!loading && activeTab === 'revenue' && data && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ${data.total_revenue?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Total Refunds</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    ${data.total_refunds?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Net Revenue</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    ${data.net_revenue?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Refund Rate</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{data.refund_rate}%</p>
                </div>
              </div>

              {/* Revenue by Plan */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
                <div className="space-y-3">
                  {data.by_plan && Object.entries(data.by_plan).map(([plan, stats]) => (
                    <div key={plan} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 capitalize">{plan}</p>
                        <p className="text-sm text-gray-600">{stats.count} transactions</p>
                      </div>
                      <p className="text-lg font-semibold text-gray-900">${stats.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Churn Analysis Tab */}
          {!loading && activeTab === 'churn' && data && (
            <div className="space-y-6">
              {/* Churn KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Total Churned</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{data.total_churned}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Revoked Subscriptions</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">{data.revoked_count}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <p className="text-gray-600 text-sm font-medium">Expired Subscriptions</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">{data.expired_count}</p>
                </div>
              </div>

              {/* Revoked Subscriptions */}
              {data.revoked_subscriptions?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revoked Subscriptions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">User ID</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Reason</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.revoked_subscriptions.map((sub, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{sub.user_id}</td>
                            <td className="px-4 py-2 text-gray-600">{sub.action_description || 'N/A'}</td>
                            <td className="px-4 py-2 text-gray-600">
                              {new Date(sub.timestamp).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction History Tab */}
          {!loading && activeTab === 'transactions' && Array.isArray(data) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Transaction ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">{tx.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          tx.type === 'payment' ? 'bg-green-100 text-green-800' :
                          tx.type === 'refund' ? 'bg-red-100 text-red-800' :
                          tx.type === 'credit' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ${Math.abs(tx.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded font-medium bg-green-100 text-green-800">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No transactions found for the selected period
                </div>
              )}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
