import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { referralAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReferralDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ user_id: '', discount_percent: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [discountsRes, statsRes] = await Promise.all([
        referralAPI.adminListDiscounts(),
        referralAPI.adminStats()
      ]);
      setDiscounts(discountsRes.data?.discounts || []);
      setStats(statsRes.data?.stats || null);
    } catch (err) {
      toast.error('Failed to load referral data');
    } finally { setLoading(false); }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await referralAPI.adminAssignDiscount({
        user_id: form.user_id,
        discount_percent: parseFloat(form.discount_percent)
      });
      toast.success('Discount assigned');
      setShowModal(false);
      setForm({ user_id: '', discount_percent: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign discount');
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this discount?')) return;
    try {
      await referralAPI.adminRevokeDiscount(id);
      toast.success('Discount revoked');
      fetchData();
    } catch (err) {
      toast.error('Failed to revoke discount');
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout title="Referral Discounts">
        <div className="space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Signups', value: stats.total_signups },
                { label: 'Conversions', value: stats.total_conversions },
                { label: 'Conversion Rate', value: `${stats.conversion_rate}%` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Assign button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Active Discounts</h2>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              Assign Discount
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Discount %</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : discounts.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No referral discounts configured.</td></tr>
                ) : discounts.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.users?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{d.users?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary-700">{d.discount_percent}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {d.is_active && (
                        <button onClick={() => handleRevoke(d.id)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Assign Referral Discount</h3>
                <form onSubmit={handleAssign} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                    <input type="number" min="1" max="100" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} required />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Assign</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
