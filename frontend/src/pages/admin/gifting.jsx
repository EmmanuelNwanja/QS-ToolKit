import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { giftingAPI } from '../../services/api';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   Admin → Gifting Analytics
   Aggregate performance of the gifting programme: revenue, batches,
   recipients, anonymous share, plan mix, monthly trend, top recipients.
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function GiftedSubscriptionsBadge({ count }) {
  if (!count) return <span className="text-xs text-gray-400">No gifts yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
      🎁 {count} gifted subscription{count === 1 ? '' : 's'}
    </span>
  );
}

export default function AdminGiftingPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    giftingAPI.adminAnalytics()
      .then(({ data }) => setAnalytics(data))
      .catch(() => toast.error('Failed to load gifting analytics'))
      .finally(() => setLoading(false));
  }, []);

  const ngn = (v) => `₦${Number(v || 0).toLocaleString()}`;
  const maxTrend = Math.max(1, ...(analytics?.monthly_trend || []).map(t => t.revenue));

  return (
    <ProtectedAdminRoute>
      <AdminLayout title="Gifting Analytics">
        <Head><title>Gifting Analytics · QSToolkit Admin</title></Head>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Gifting Analytics</h1>
          <p className="text-sm text-gray-400">Donor-sponsored subscriptions across the platform</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : !analytics ? (
          <p className="text-sm text-gray-400">No data available.</p>
        ) : (
          <div className="space-y-6">
            {/* ── Totals ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Gift Revenue" value={ngn(analytics.totals.revenue_ngn)} sub="paid batches" accent="text-emerald-700" />
              <StatCard label="Gift Batches" value={analytics.totals.batches} sub="completed payments" />
              <StatCard label="Recipients Gifted" value={analytics.totals.recipients_gifted} sub="subscriptions activated" accent="text-primary-700" />
              <StatCard label="Anonymous Donors" value={`${analytics.totals.anonymous_share}%`} sub="share of batches" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* ── Monthly trend ── */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue trend (last 12 months)</h2>
                {(analytics.monthly_trend || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No completed gift payments yet.</p>
                ) : (
                  <div className="flex items-end gap-2 h-40">
                    {analytics.monthly_trend.map(t => (
                      <div key={t.month} className="flex-1 flex flex-col items-center gap-1" title={`${t.month}: ${ngn(t.revenue)}`}>
                        <div className="w-full bg-gold-400 rounded-t" style={{ height: `${Math.max(4, (t.revenue / maxTrend) * 130)}px` }} />
                        <span className="text-[9px] text-gray-400">{t.month.slice(5)}/{t.month.slice(2, 4)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Plan mix ── */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue by plan</h2>
                {(analytics.by_plan || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No data yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {analytics.by_plan.map(p => {
                      const max = Math.max(...analytics.by_plan.map(x => x.revenue), 1);
                      return (
                        <li key={p.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700 capitalize">{p.name}</span>
                            <span className="text-gray-400">{ngn(p.revenue)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-700 rounded-full" style={{ width: `${(p.revenue / max) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* ── Recipient type mix ── */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Gifted subscriptions by account type</h2>
                {(analytics.by_user_type || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No activations yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {analytics.by_user_type.map(t => (
                      <li key={t.name} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-gray-700">
                          {t.name === 'student' ? '🎓 Students' : t.name === 'professional' ? '📐 Professionals' : t.name}
                        </span>
                        <GiftedSubscriptionsBadge count={t.count} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ── Top gifted users ── */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Most-gifted members</h2>
                {(analytics.top_gifted_users || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No gifts yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {analytics.top_gifted_users.map((u, i) => (
                      <li key={u.email_masked || i} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email_masked}</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">{u.gifts}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Recent batches ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent gift batches</h2>
              {(analytics.recent_batches || []).length === 0 ? (
                <p className="text-xs text-gray-400">No batches yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b">
                      <th className="pb-2 font-medium">Donor</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium">Recipients</th>
                      <th className="pb-2 font-medium">Activated</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analytics.recent_batches.map(b => (
                      <tr key={b.id}>
                        <td className="py-2 font-medium text-gray-700">{b.donor_display}</td>
                        <td className="py-2 capitalize">{b.plan_name} · {b.billing_cycle}</td>
                        <td className="py-2">{b.recipient_count}</td>
                        <td className="py-2">{b.activated_count}{b.failed_count > 0 ? <span className="text-red-400"> ({b.failed_count} failed)</span> : ''}</td>
                        <td className="py-2">{ngn(b.amount_ngn)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : b.payment_status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                            {b.payment_status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">{new Date(b.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
