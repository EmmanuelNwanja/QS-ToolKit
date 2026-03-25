import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import api, { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function PushNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    imageUrl: '',
    actionUrl: '',
    targetSegment: 'all',
    scheduledFor: ''
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPushNotifications({ limit: 50 });
      setNotifications(response.data?.notifications || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.sendPushNotification(formData);
      toast.success('Notification sent successfully');

      setShowModal(false);
      setFormData({
        title: '',
        message: '',
        imageUrl: '',
        actionUrl: '',
        targetSegment: 'all',
        scheduledFor: ''
      });

      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send notification');
    }
  };

  const handleViewDetails = async (notification) => {
    try {
      const response = await api.get(`/push-notifications/admin/${notification.id}`);
      setSelectedNotification(response.data?.data || response.data);
      setShowDetails(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleCancel = async (notificationId) => {
    if (!window.confirm('Are you sure you want to cancel this notification?')) {
      return;
    }

    try {
      await api.post(`/push-notifications/admin/${notificationId}/cancel`);
      fetchNotifications();
      setShowDetails(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Push Notifications</h2>
              <p className="text-gray-600 mt-1">Send web push notifications to users</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Send Notification
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Notifications Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No notifications yet</p>
                <p className="text-sm">Create your first push notification</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Recipients</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Sent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {notifications.map((notif) => (
                      <tr key={notif.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                          <p className="text-xs text-gray-600 truncate">{notif.message}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium capitalize">
                            {notif.target_segment}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(notif.status)}`}>
                            {notif.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">
                            {notif.successful_sends || 0} / {notif.total_recipients || 0}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">
                            {notif.sent_at
                              ? new Date(notif.sent_at).toLocaleDateString()
                              : '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleViewDetails(notif)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Details
                          </button>
                          {notif.status === 'scheduled' && (
                            <button
                              onClick={() => handleCancel(notif.id)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Feature Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Web Push Notifications</h3>
            <p className="text-blue-800 mb-4">
              Send targeted push notifications to your users' browsers. Users must have subscribed to notifications on your platform first.
            </p>
            <div className="text-sm text-blue-700 space-y-1">
              <p>✓ Segment by plan type (all, free, paid, student, pro)</p>
              <p>✓ Schedule notifications for future delivery</p>
              <p>✓ Track delivery status and success rates</p>
              <p>✓ Cancel scheduled notifications before they send</p>
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-lg font-bold text-gray-900">Send Push Notification</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Notification title"
                    required
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Notification message"
                    rows="3"
                    required
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                {/* Action URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action URL (Where to open on click)
                  </label>
                  <input
                    type="url"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/dashboard"
                  />
                </div>

                {/* Target Segment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Segment
                  </label>
                  <select
                    value={formData.targetSegment}
                    onChange={(e) => setFormData({ ...formData, targetSegment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Users</option>
                    <option value="free">Free Plan Users</option>
                    <option value="paid">Paid Plan Users</option>
                    <option value="student">Student Plan Users</option>
                    <option value="pro">Pro Plan Users</option>
                  </select>
                </div>

                {/* Scheduled For */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule (Optional - Send immediately if blank)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledFor}
                    onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                    {formData.scheduledFor ? 'Schedule' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetails && selectedNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-lg font-bold text-gray-900">Notification Details</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Status</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {selectedNotification.notification.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Target Segment</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {selectedNotification.notification.target_segment}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Total Recipients</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedNotification.stats.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Success Rate</p>
                      <p className="text-sm font-medium text-green-600">
                        {selectedNotification.stats.successRate}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Content</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wide">Title</label>
                      <p className="text-sm text-gray-900">{selectedNotification.notification.title}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 uppercase tracking-wide">Message</label>
                      <p className="text-sm text-gray-900">{selectedNotification.notification.message}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Stats */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Delivery</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Sent</span>
                      <span className="text-sm font-medium text-green-600">
                        {selectedNotification.stats.sent}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Failed</span>
                      <span className="text-sm font-medium text-red-600">
                        {selectedNotification.stats.failed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mt-3">
                      <div
                        className="bg-green-600 h-full"
                        style={{
                          width: `${selectedNotification.stats.successRate}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 pt-4 flex gap-3">
                  {selectedNotification.notification.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(selectedNotification.notification.id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Cancel Scheduled Send
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetails(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
