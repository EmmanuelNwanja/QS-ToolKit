import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import ProtectedAdminRoute from '../../../components/ProtectedAdminRoute';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionData, setActionData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const actionTypes = [
    { value: 'suspend', label: 'Suspend User', color: 'bg-red-500' },
    { value: 'unsuspend', label: 'Unsuspend User', color: 'bg-green-500' },
    { value: 'verify', label: 'Verify User', color: 'bg-blue-500' },
    { value: 'override_subscription', label: 'Override Subscription', color: 'bg-purple-500' },
    { value: 'extend_subscription', label: 'Extend Subscription', color: 'bg-cyan-500' },
    { value: 'revoke_subscription', label: 'Revoke Subscription', color: 'bg-orange-500' },
    { value: 'issue_credit', label: 'Issue Credit', color: 'bg-indigo-500' },
    { value: 'process_refund', label: 'Process Refund', color: 'bg-pink-500' }
  ];

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/users?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !actionType) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('authToken');
      const endpoint = `/api/user-actions/${selectedUser.id}/${actionType}`;
      const payload = {
        ...actionData,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Action failed');
      }

      // Refresh users list
      await fetchUsers();

      // Reset modal
      setShowActionModal(false);
      setActionType('');
      setActionData({});
      setSelectedUser(null);
    } catch (err) {
      setError(err.message || 'Failed to perform action');
      console.error('Error performing action:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openActionModal = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setActionData({});
    setShowActionModal(true);
  };

  const getActionConfig = (action) => {
    return actionTypes.find(a => a.value === action) || {};
  };

  // Filter users based on search query and filter
  const filteredUsers = users.filter(user =>
    (filter === 'all' || 
     (filter === 'active' && user.subscription_status !== 'suspended') ||
     (filter === 'suspended' && user.subscription_status === 'suspended') ||
     (filter === 'inactive' && !user.is_verified)) &&
    (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Users Management</h2>
            <p className="text-gray-600 mt-1">View and manage user accounts, subscriptions, and billing</p>
          </div>

          {/* Search Bar */}
          <div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {['all', 'active', 'inactive', 'suspended'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 border-b-2 transition-colors capitalize ${
                  filter === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                            {user.subscription_plans?.name || 'free'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`block px-3 py-1 rounded-full text-xs font-medium w-fit ${
                              user.is_verified
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {user.is_verified ? 'Verified' : 'Unverified'}
                            </span>
                            {user.subscription_status === 'suspended' && (
                              <span className="block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit">
                                Suspended
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openActionModal(user, user.subscription_status === 'suspended' ? 'unsuspend' : 'suspend')}
                              className={`px-3 py-1 text-xs rounded font-medium text-white transition ${
                                user.subscription_status === 'suspended'
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : 'bg-red-500 hover:bg-red-600'
                              }`}
                            >
                              {user.subscription_status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                            </button>
                            <div className="relative group">
                              <button className="px-3 py-1 text-xs rounded font-medium text-white bg-gray-400 hover:bg-gray-500 transition">
                                More
                              </button>
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10">
                                {actionTypes.map((action) => (
                                  <button
                                    key={action.value}
                                    onClick={() => openActionModal(user, action.value)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg border-b last:border-b-0"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Modal */}
          {showActionModal && selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{getActionConfig(actionType)?.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedUser.email}</p>
                </div>

                <form onSubmit={handleActionSubmit} className="space-y-4">
                  {/* Reason Field */}
                  {['suspend', 'revoke_subscription', 'process_refund'].includes(actionType) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason
                      </label>
                      <textarea
                        value={actionData.reason || ''}
                        onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                        placeholder="Provide a reason for this action..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="3"
                      />
                    </div>
                  )}

                  {/* Plan Field for Override */}
                  {actionType === 'override_subscription' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Plan</label>
                      <select
                        value={actionData.plan_id || ''}
                        onChange={(e) => setActionData({ ...actionData, plan_id: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a plan</option>
                        <option value="free">Free</option>
                        <option value="student">Student</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  )}

                  {/* Duration Field for Extend */}
                  {actionType === 'extend_subscription' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Extend by (days)</label>
                      <input
                        type="number"
                        value={actionData.days || ''}
                        onChange={(e) => setActionData({ ...actionData, days: parseInt(e.target.value) })}
                        placeholder="30"
                        required
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Amount Field for Credit */}
                  {actionType === 'issue_credit' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount ($)</label>
                      <input
                        type="number"
                        value={actionData.amount || ''}
                        onChange={(e) => setActionData({ ...actionData, amount: parseFloat(e.target.value) })}
                        placeholder="10.00"
                        required
                        step="0.01"
                        min="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Refund Amount and Method */}
                  {actionType === 'process_refund' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount ($)</label>
                        <input
                          type="number"
                          value={actionData.amount || ''}
                          onChange={(e) => setActionData({ ...actionData, amount: parseFloat(e.target.value) })}
                          placeholder="10.00"
                          required
                          step="0.01"
                          min="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Refund Method</label>
                        <select
                          value={actionData.method || ''}
                          onChange={(e) => setActionData({ ...actionData, method: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select method</option>
                          <option value="original_payment">Original Payment Method</option>
                          <option value="credit">Account Credit</option>
                          <option value="paystack">Paystack Direct</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Processing...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionModal(false);
                        setActionType('');
                        setActionData({});
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
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
