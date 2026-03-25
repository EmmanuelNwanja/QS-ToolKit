import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import ProtectedAdminRoute from '../../../components/ProtectedAdminRoute';

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    adminRole: 'admin',
    permissions: ['manage_promos', 'manage_users', 'view_analytics']
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/admins', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch admins');
      const data = await response.json();
      setAdmins(data.data.admins || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to create admin');

      setShowModal(false);
      setFormData({
        userId: '',
        adminRole: 'admin',
        permissions: ['manage_promos', 'manage_users', 'view_analytics']
      });

      fetchAdmins();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to remove admin access from this user?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to remove admin');
      fetchAdmins();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Manage Admins</h2>
              <p className="text-gray-600 mt-1">Add and manage admin users</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Add Admin
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Admins Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No admins yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Permissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {admin.users?.name}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{admin.users?.email}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            admin.admin_role === 'super_admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {admin.admin_role === 'super_admin' ? 'Super Admin' : 'Admin'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {admin.permissions?.map((perm) => (
                              <span
                                key={perm}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleRemoveAdmin(admin.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Remove
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

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Add Admin</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* User ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID or Email
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                {/* Admin Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Role
                  </label>
                  <select
                    value={formData.adminRole}
                    onChange={(e) => setFormData({ ...formData, adminRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    {['manage_promos', 'manage_users', 'view_analytics', 'manage_admins'].map(
                      (perm) => (
                        <label key={perm} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(perm)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, perm]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(
                                    (p) => p !== perm
                                  )
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700">{perm}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
