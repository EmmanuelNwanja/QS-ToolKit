import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { academyAPI } from '../../services/api';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await academyAPI.getAnalytics();
        setAnalytics(res.data);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="📊 Analytics">
          <div className="max-w-6xl space-y-6">
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const pathways = analytics?.pathways || [];
  const arena = analytics?.arena || { wins: 0, losses: 0, draws: 0 };
  const earnings = analytics?.token_earnings || [];
  const strengths = analytics?.strengths || [];
  const weaknesses = analytics?.weaknesses || [];
  const recommendations = analytics?.recommendations || [];

  const totalArena = arena.wins + arena.losses + arena.draws;
  const winRate = totalArena > 0 ? Math.round((arena.wins / totalArena) * 100) : 0;

  return (
    <ProtectedRoute>
      <Head><title>Analytics — QS Academy</title></Head>
      <Layout title="📊 Progress Analytics">
        <div className="max-w-6xl space-y-6">
          {/* Pathway progress */}
          <motion.div {...fadeUp} className="card">
            <h2 className="section-title mb-4">🛤️ Pathway Progress</h2>
            {pathways.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No pathways enrolled yet. <Link href="/academy/pathways" className="text-primary-600 hover:underline">Browse pathways →</Link></p>
            ) : (
              <div className="space-y-4">
                {pathways.map((p) => (
                  <div key={p.slug}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-500">Level {p.current_level} / {p.total_levels}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full bg-primary-600 transition-all" style={{ width: `${(p.current_level / p.total_levels) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Token earnings chart */}
            <motion.div {...fadeUp} className="card">
              <h2 className="section-title mb-4">🪙 Token Earnings</h2>
              {earnings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No earnings yet. Complete contests to earn tokens.</p>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {earnings.slice(-12).map((e, i) => {
                    const maxVal = Math.max(...earnings.map((x) => x.amount || 0), 1);
                    const height = ((e.amount || 0) / maxVal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500">{e.amount}</span>
                        <div className="w-full bg-gold-400 rounded-t transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                        <span className="text-[9px] text-gray-400 truncate w-full text-center">{e.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Arena performance */}
            <motion.div {...fadeUp} className="card">
              <h2 className="section-title mb-4">⚔️ Arena Performance</h2>
              {totalArena === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No contests played yet. <Link href="/academy/arena" className="text-primary-600 hover:underline">Enter the Arena →</Link></p>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-8 mb-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600 font-display">{arena.wins}</p>
                      <p className="text-xs text-gray-500 mt-1">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-500 font-display">{arena.losses}</p>
                      <p className="text-xs text-gray-500 mt-1">Losses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-400 font-display">{arena.draws}</p>
                      <p className="text-xs text-gray-500 mt-1">Draws</p>
                    </div>
                  </div>
                  {/* Win rate bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Win Rate</span>
                      <span className="font-semibold text-primary-700">{winRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${winRate}%` }} />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Strengths / Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div {...fadeUp} className="card">
              <h2 className="section-title mb-3">💪 Strengths</h2>
              {strengths.length === 0 ? (
                <p className="text-sm text-gray-500">Complete your admission to see strengths.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {strengths.map((s) => (
                    <span key={s} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">{s}</span>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div {...fadeUp} className="card">
              <h2 className="section-title mb-3">🎯 Areas to Improve</h2>
              {weaknesses.length === 0 ? (
                <p className="text-sm text-gray-500">Complete your admission to see weaknesses.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {weaknesses.map((w) => (
                    <span key={w} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-200">{w}</span>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <motion.div {...fadeUp} className="card">
              <h2 className="section-title mb-3">🤖 Dr. Q Recommendations</h2>
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary-50">
                    <span className="text-lg flex-shrink-0">{r.icon || '💡'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                      {r.action_url && (
                        <Link href={r.action_url} className="text-xs text-primary-600 hover:underline mt-1 inline-block">
                          {r.action_label || 'View →'}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
