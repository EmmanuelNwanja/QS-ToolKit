import { useState, useEffect, useRef, useCallback } from 'react';
import { pushAPI } from '../services/api';

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_ICON = {
  feedback_received:       '⭐',
  project_verified:        '✅',
  subscription_expiring:   '⏰',
  subscription_expired:    '❌',
  payment_received:        '💳',
  account_suspended:       '🚫',
  account_unsuspended:     '✅',
  push:                    '📢',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [pushRes, activityRes] = await Promise.allSettled([
        pushAPI.getInbox({ limit: 30 }),
        pushAPI.getActivity({ limit: 30 }),
      ]);

      const pushData = pushRes.status === 'fulfilled'
        ? (pushRes.value.data?.data?.notifications || [])
        : [];

      const activityData = activityRes.status === 'fulfilled'
        ? (activityRes.value.data?.data?.notifications || [])
        : [];

      const pushItems = pushData.map((d) => ({
        id: d.id,
        source: 'push',
        icon: '📢',
        title: d.push_notifications?.title || 'Announcement',
        message: d.push_notifications?.message || '',
        is_read: d.is_read,
        created_at: d.created_at,
        action_url: d.push_notifications?.action_url || null,
      }));

      const activityItems = activityData.map((n) => ({
        id: n.id,
        source: 'activity',
        icon: TYPE_ICON[n.type] || '🔔',
        title: n.title || 'Activity',
        message: n.message || '',
        is_read: n.is_read,
        created_at: n.created_at,
        action_url: null,
      }));

      const combined = [...pushItems, ...activityItems].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setNotifications(combined);
    } catch {
      // Silently ignore — user may not have any notifications yet
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = useCallback(async (notif) => {
    if (notif.is_read) return;
    try {
      if (notif.source === 'push') {
        await pushAPI.markDeliveryRead(notif.id);
      } else {
        await pushAPI.markActivityRead(notif.id);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map(markRead));
  }, [notifications, markRead]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (!prev) fetchNotifications();
      return !prev;
    });
  };

  const handleItemClick = (notif) => {
    markRead(notif);
    if (notif.action_url) window.open(notif.action_url, '_blank', 'noopener');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-500 hover:text-primary-700 rounded-lg hover:bg-gray-100 transition-colors"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">
              Notifications {unreadCount > 0 && (
                <span className="ml-1 text-xs text-white bg-red-500 rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            )}
            {!loading && notifications.map((n) => (
              <button
                key={`${n.source}-${n.id}`}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${
                  !n.is_read ? 'bg-blue-50/40' : ''
                }`}
              >
                {/* Icon */}
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{n.icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <button
                onClick={fetchNotifications}
                className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
