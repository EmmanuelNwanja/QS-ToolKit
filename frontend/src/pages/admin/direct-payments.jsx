import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function DirectPayments() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { fetchSubmissions(); }, [filter]);
  useEffect(() => { fetchStats(); }, []);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getDirectPayments({ status: filter, page: 1, limit: 50 });
      setSubmissions(data?.data?.submissions || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await adminAPI.getDirectPaymentStats();
      setStats(data?.data || null);
    } catch {}
  };

  const viewDetail = async (id) => {
    setSelected(id);
    setDetailLoading(true);
    try {
      const { data } = await adminAPI.getDirectPaymentDetail(id);
      setDetail(data?.data || null);
    } catch (err) {
      toast.error('Failed to load payment details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await adminAPI.verifyDirectPayment(selected, adminNote);
      toast.success('Payment verified and subscription activated');
      setSelected(null);
      setDetail(null);
      setAdminNote('');
      fetchSubmissions();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    setActionLoading(true);
    try {
      await adminAPI.rejectDirectPayment(selected, rejectReason.trim());
      toast.success('Payment submission rejected');
      setSelected(null);
      setDetail(null);
      setRejectReason('');
      fetchSubmissions();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setAdminNote('');
    setRejectReason('');
  };

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      verified: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return `px-3 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`;
  };

  return (
    <ProtectedAdminRoute requiredPermission="manage_billing">
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Direct Payments</h2>
              <p className="text-gray-600 mt-1">Review and verify bank transfer payment submissions</p>
            </div>
            <button
              onClick={() => { fetchSubmissions(); fetchStats(); }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800"
            >
              Refresh
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.verified || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">₦{Number(stats.totalRevenueNgn || 0).toLocaleString('en-NG')}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 border-b border-gray-200">
            {['pending', 'verified', 'rejected', 'all'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 border-b-2 transition-colors capitalize ${
                  filter === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
          )}

          {selected && detailLoading && (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          )}

          {selected && detail && !detailLoading && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Payment Detail</h3>
                <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">User:</span> <span className="font-medium">{detail.user?.email || 'N/A'}</span></div>
                <div><span className="text-gray-500">Plan:</span> <span className="font-medium capitalize">{detail.plan_name}</span></div>
                <div><span className="text-gray-500">Billing:</span> <span className="font-medium capitalize">{detail.billing_interval}</span></div>
                <div><span className="text-gray-500">Amount:</span> <span className="font-medium">₦{Number(detail.amount_ngn).toLocaleString('en-NG')}</span></div>
                <div><span className="text-gray-500">Reference:</span> <span className="font-medium">{detail.reference_note || 'N/A'}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className={statusBadge(detail.status)}>{detail.status}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Submitted:</span> <span className="font-medium">{new Date(detail.submitted_at).toLocaleString()}</span></div>
              </div>

              {detail.receipt_url && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Receipt:</p>
                  <a href={detail.receipt_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm">View Receipt →</a>
                </div>
              )}

              {detail.status === 'pending' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note (optional)</label>
                    <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Add a note for the user"
                      className="input w-full" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleVerify} disabled={actionLoading}
                      className="btn-primary flex-1">
                      {actionLoading ? 'Processing...' : 'Verify & Activate'}
                    </button>
                    <button onClick={() => setRejectReason(' ')}
                      className="btn-secondary">
                      Reject
                    </button>
                  </div>
                  {rejectReason && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Rejection Reason *</label>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Explain why the payment is rejected"
                        className="input w-full" rows={2} />
                      <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm disabled:opacity-60">
                        {actionLoading ? 'Processing...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  )}

                  {detail.auditLog?.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Recent Activity</p>
                      <div className="space-y-2">
                        {detail.auditLog.map(log => (
                          <div key={log.id} className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-gray-400 ml-2">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail.status !== 'pending' && (
                <div className="border-t pt-3 text-sm text-gray-600">
                  Reviewed by: {detail.reviewed_by_user?.email || 'N/A'} on {detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : 'N/A'}
                  {detail.admin_note && <p className="mt-1">Note: {detail.admin_note}</p>}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No payment submissions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {submissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{sub.user?.email || 'Unknown'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">
                            {sub.plan_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          ₦{Number(sub.amount_ngn).toLocaleString('en-NG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={statusBadge(sub.status)}>{sub.status}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => viewDetail(sub.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
