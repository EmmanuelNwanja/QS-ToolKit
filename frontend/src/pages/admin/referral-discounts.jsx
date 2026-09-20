import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { referralAPI } from '../../services/api';
import toast from 'react-hot-toast';

/* ══ UserPicker ═══════════════════════════════════════════
   Debounced name/email lookup for admin assignment modals.
   Replaces raw "User ID" text inputs so super admins never
   have to paste UUIDs by hand. */

function UserPicker({ value, onSelect, placeholder = 'Search by name or email…' }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 3) { setUsers([]); return undefined; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await referralAPI.adminUserLookup(query.trim());
        setUsers(data?.users || []);
        setOpen(true);
      } catch { setUsers([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const away = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const selected = value ? users.find((u) => u.id === value) : null;

  return (
    <div className="relative" ref={boxRef}>
      {value && selected ? (
        <div className="flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50">
          <div>
            <p className="font-medium text-gray-900">{selected.name || 'Unknown'}</p>
            <p className="text-xs text-gray-400">{selected.email}{selected.referral_code ? ` · code ${selected.referral_code}` : ''}</p>
          </div>
          <button type="button" onClick={() => onSelect('')} className="text-xs text-red-500 hover:text-red-700">Change</button>
        </div>
      ) : (
        <>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (users.length) setOpen(true); }}
          />
          {open && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
              {!loading && users.length === 0 && query.trim().length >= 3 && (
                <p className="px-3 py-2 text-xs text-gray-400">No users match “{query.trim()}”</p>
              )}
              {!loading && query.trim().length < 3 && (
                <p className="px-3 py-2 text-xs text-gray-400">Type at least 3 characters…</p>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { onSelect(u.id); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-900">{u.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{u.email}{u.referral_code ? ` · code ${u.referral_code}` : ''}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReferralDiscounts() {
  const [adminTab, setAdminTab] = useState('discounts');
  const [discounts, setDiscounts] = useState([]);
  const [incomeRates, setIncomeRates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [discountForm, setDiscountForm] = useState({ user_id: '', discount_percent: '' });
  const [rateForm, setRateForm] = useState({ user_id: '', basic_rate: '1.0', pro_rate: '0.6', enterprise_rate: '0.3' });
  const [editingRateId, setEditingRateId] = useState(null);
  const [editRateValues, setEditRateValues] = useState({});
  const [savingRateId, setSavingRateId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [discountsRes, statsRes, ratesRes] = await Promise.all([
        referralAPI.adminListDiscounts(),
        referralAPI.adminStats(),
        referralAPI.adminListIncomeRates()
      ]);
      setDiscounts(discountsRes.data?.discounts || []);
      setStats(statsRes.data?.stats || null);
      setIncomeRates(ratesRes.data?.rates || []);
    } catch {
      toast.error('Failed to load referral data');
    } finally { setLoading(false); }
  };

  const handleAssignDiscount = async (e) => {
    e.preventDefault();
    try {
      await referralAPI.adminAssignDiscount({
        user_id: discountForm.user_id,
        discount_percent: parseFloat(discountForm.discount_percent)
      });
      toast.success('Discount assigned. Referred users signing up with this link get it on their first subscription within 60 days of account creation.');
      setShowDiscountModal(false);
      setDiscountForm({ user_id: '', discount_percent: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign discount');
    }
  };

  const handleRevokeDiscount = async (id) => {
    if (!confirm('Revoke this discount? New signups via this link will no longer receive it.')) return;
    try {
      await referralAPI.adminRevokeDiscount(id);
      toast.success('Discount revoked');
      fetchData();
    } catch { toast.error('Failed to revoke discount'); }
  };

  const handleSetIncomeRate = async (e) => {
    e.preventDefault();
    try {
      await referralAPI.adminSetIncomeRate({
        user_id: rateForm.user_id,
        basic_rate: parseFloat(rateForm.basic_rate),
        pro_rate: parseFloat(rateForm.pro_rate),
        enterprise_rate: parseFloat(rateForm.enterprise_rate)
      });
      toast.success('Referral reward percentage set. The user\'s dashboard now reflects these rates.');
      setShowRateModal(false);
      setRateForm({ user_id: '', basic_rate: '1.0', pro_rate: '0.6', enterprise_rate: '0.3' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set income rate');
    }
  };

  const handleRevokeIncomeRate = async (id) => {
    if (!confirm('Revoke this custom reward percentage? The user reverts to system defaults (Basic 1.0%, Pro 0.6%, Enterprise 0.3%).')) return;
    try {
      await referralAPI.adminRevokeIncomeRate(id);
      toast.success('Reward percentage revoked - user reverted to system standard');
      fetchData();
    } catch { toast.error('Failed to revoke income rate'); }
  };

  const startEditRate = (rate) => {
    setEditingRateId(rate.id);
    setEditRateValues({
      basic_rate: String(rate.basic_rate),
      pro_rate: String(rate.pro_rate),
      enterprise_rate: String(rate.enterprise_rate)
    });
  };

  const handleSaveEditRate = async (id) => {
    setSavingRateId(id);
    try {
      await referralAPI.adminUpdateIncomeRate(id, {
        basic_rate: parseFloat(editRateValues.basic_rate),
        pro_rate: parseFloat(editRateValues.pro_rate),
        enterprise_rate: parseFloat(editRateValues.enterprise_rate)
      });
      toast.success('Reward percentage updated');
      setEditingRateId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update income rate');
    } finally { setSavingRateId(null); }
  };

  const rateCell = (rate, field) => (
    editingRateId === rate.id ? (
      <input
        type="number" min="0" max="100" step="0.01"
        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
        value={editRateValues[field] ?? ''}
        onChange={(e) => setEditRateValues((v) => ({ ...v, [field]: e.target.value }))}
      />
    ) : (
      <span className="font-semibold">{rate[field]}%</span>
    )
  );

  return (
    <ProtectedAdminRoute>
      <AdminLayout title="Referral Management">
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

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { key: 'discounts', label: 'Referral Discounts (per link)' },
              { key: 'income-rates', label: 'Referral Reward % (per user)' },
            ].map(t => (
              <button key={t.key} onClick={() => setAdminTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Discounts Tab */}
          {adminTab === 'discounts' && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Signup Discounts</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Anyone who signs up with this user&apos;s referral link gets the discount on their
                    <strong> first subscription within 60 days</strong> of account creation.
                  </p>
                </div>
                <button onClick={() => setShowDiscountModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 whitespace-nowrap">
                  Assign Discount
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User (link owner)</th>
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
                            <button onClick={() => handleRevokeDiscount(d.id)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Reward % (income rates) Tab */}
          {adminTab === 'income-rates' && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Custom Referral Reward %</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Overrides what a referrer earns per plan. Default: Basic 1.0% · Pro 0.6% · Enterprise 0.3%.
                    Revoking reverts the user to the system standard.
                  </p>
                </div>
                <button onClick={() => setShowRateModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 whitespace-nowrap">
                  Set Reward %
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Basic %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Pro %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Enterprise %</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : incomeRates.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">All users on default rates.</td></tr>
                    ) : incomeRates.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{r.users?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{r.users?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{rateCell(r, 'basic_rate')}</td>
                        <td className="px-4 py-3 text-center">{rateCell(r, 'pro_rate')}</td>
                        <td className="px-4 py-3 text-center">{rateCell(r, 'enterprise_rate')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {r.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.updated_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {editingRateId === r.id ? (
                            <>
                              <button onClick={() => handleSaveEditRate(r.id)} disabled={savingRateId === r.id} className="text-xs text-green-600 hover:text-green-700 mr-2">
                                {savingRateId === r.id ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => setEditingRateId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                            </>
                          ) : (
                            <>
                              {r.is_active && (
                                <>
                                  <button onClick={() => startEditRate(r)} className="text-xs text-primary-600 hover:text-primary-700 mr-2">Edit</button>
                                  <button onClick={() => handleRevokeIncomeRate(r.id)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                                </>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Discount Modal */}
          {showDiscountModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-semibold mb-1">Assign Referral Signup Discount</h3>
                <p className="text-xs text-gray-500 mb-4">Applies to the first subscription of users who sign up with this person&apos;s link, within 60 days of their account creation.</p>
                <form onSubmit={handleAssignDiscount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User (referral link owner)</label>
                    <UserPicker value={discountForm.user_id} onSelect={(id) => setDiscountForm(f => ({ ...f, user_id: id }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                    <input type="number" min="1" max="100" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={discountForm.discount_percent} onChange={e => setDiscountForm(f => ({ ...f, discount_percent: e.target.value }))} required />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowDiscountModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Assign</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reward % Modal */}
          {showRateModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-semibold mb-1">Set Custom Referral Reward %</h3>
                <p className="text-xs text-gray-500 mb-4">Override default rates (Basic 1.0%, Pro 0.6%, Enterprise 0.3%) for a specific user. The user&apos;s referral dashboard reflects this immediately.</p>
                <form onSubmit={handleSetIncomeRate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                    <UserPicker value={rateForm.user_id} onSelect={(id) => setRateForm(f => ({ ...f, user_id: id }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Basic %</label>
                      <input type="number" min="0" max="100" step="0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={rateForm.basic_rate} onChange={e => setRateForm(f => ({ ...f, basic_rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pro %</label>
                      <input type="number" min="0" max="100" step="0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={rateForm.pro_rate} onChange={e => setRateForm(f => ({ ...f, pro_rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enterprise %</label>
                      <input type="number" min="0" max="100" step="0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={rateForm.enterprise_rate} onChange={e => setRateForm(f => ({ ...f, enterprise_rate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowRateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Set Reward %</button>
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
