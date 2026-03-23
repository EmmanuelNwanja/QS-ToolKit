import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import useAuthStore from '../context/authStore';
import { projectAPI, feedbackAPI, leaderboardAPI, userAPI } from '../services/api';
import { formatNaira, formatCompact, formatDate, CALCULATORS } from '../utils/helpers';

export default function DashboardPage() {
  const { user, planName } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [rank, setRank]   = useState(null);
  const [usage, setUsage] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, projectsRes, rankRes, usageRes] = await Promise.allSettled([
          projectAPI.stats(),
          projectAPI.list({ limit: 5 }),
          leaderboardAPI.getMe(),
          userAPI.getUsage()
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);
        if (projectsRes.status === 'fulfilled') setRecentProjects(projectsRes.value.data.projects || []);
        if (rankRes.status === 'fulfilled') setRank(rankRes.value.data.rank);
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const isProUser = ['pro', 'enterprise'].includes(planName());
  const greeting  = getGreeting();

  return (
    <ProtectedRoute>
      <Head><title>Dashboard — QSToolkit</title></Head>
      <Layout title="Dashboard">
        <div className="space-y-6 max-w-7xl">

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-primary-300 text-sm">{greeting}</p>
              <h1 className="font-display text-2xl font-bold mt-1">
                Welcome back, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-primary-200 text-sm mt-1 capitalize">
                {user?.company_name || user?.university_name || 'QSToolkit Professional'} · {planName()} plan
              </p>
            </div>
            {rank && (
              <div className="hidden md:flex flex-col items-center bg-white/10 rounded-xl px-6 py-4 text-center">
                <span className="text-3xl font-bold font-display text-gold-400">#{rank.rank_by_rating}</span>
                <span className="text-xs text-primary-200 mt-1">Leaderboard Rank</span>
                <span className="text-sm text-white mt-0.5">⭐ {rank.avg_rating}/10</span>
              </div>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Projects',    value: stats?.total || 0,              icon: '📁', color: 'text-primary-700' },
              { label: 'Active Projects',   value: stats?.active || 0,             icon: '🔄', color: 'text-blue-600' },
              { label: 'Completed',         value: stats?.completed || 0,          icon: '✅', color: 'text-emerald-600' },
              { label: 'Total Value',       value: formatCompact(stats?.total_value || 0), icon: '💰', color: 'text-gold-600' }
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{s.icon}</span>
                </div>
                <p className={`stat-value ${s.color}`}>{loading ? '—' : s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Usage meter */}
          {usage && (
            <div className="card">
              <h2 className="section-title mb-4">📊 Monthly Usage</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { label: 'Calculator Uses', used: usage.calculator?.used_this_month, limit: usage.calculator?.limit, icon: '🧮' },
                  { label: 'Projects Logged', used: usage.projects?.used,              limit: usage.projects?.limit,    icon: '📁' }
                ].map(u => {
                  const pct = u.limit ? Math.min((u.used / u.limit) * 100, 100) : 0;
                  const unlimited = u.limit === null;
                  return (
                    <div key={u.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{u.icon} {u.label}</span>
                        <span className="text-sm text-gray-500">
                          {u.used} / {unlimited ? '∞' : u.limit}
                        </span>
                      </div>
                      {!unlimited && (
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-gold-500' : 'bg-primary-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isProUser && (
                <div className="mt-4 p-3 bg-gold-50 border border-gold-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-gold-800">⬆ Upgrade for more calculator uses, BOQs & invoices</p>
                  <Link href="/subscription" className="btn-gold text-xs px-3 py-1.5">Upgrade</Link>
                </div>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Recent projects */}
            <div className="lg:col-span-3 card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">📁 Recent Projects</h2>
                <Link href="/projects" className="text-sm text-primary-600 hover:underline">View all →</Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">No projects yet</p>
                  <Link href="/projects/new" className="btn-primary text-sm mt-3 inline-flex">Add First Project</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentProjects.map(p => (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-700">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.client_name || 'No client'} · {p.state || p.location || '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-xs font-medium text-gray-700">{formatNaira(p.estimated_value)}</span>
                        <span className={`badge ${p.status === 'active' ? 'badge-blue' : p.status === 'completed' ? 'badge-green' : 'badge-amber'}`}>
                          {p.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick calculators */}
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">🧮 Calculators</h2>
                <Link href="/calculators" className="text-sm text-primary-600 hover:underline">All →</Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CALCULATORS.slice(0, 6).map(c => (
                  <Link key={c.id} href={`/calculators/${c.id}`}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all text-center group">
                    <span className="text-xl mb-1">{c.icon}</span>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700 leading-tight">{c.label.split(' ').slice(0, 2).join(' ')}</span>
                  </Link>
                ))}
              </div>
              <Link href="/calculators" className="btn-secondary w-full text-center mt-3 text-sm">
                View All 8 Calculators
              </Link>
            </div>
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤️';
  return 'Good evening 🌙';
}
