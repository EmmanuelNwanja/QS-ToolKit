import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { examAPI } from '../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-primary-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ExamAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([examAPI.getAnalytics(), examAPI.getWeaknesses()])
      .then(([a, w]) => {
        if (a.status === 'fulfilled') setAnalytics(a.value.data);
        if (w.status === 'fulfilled') setWeaknesses(w.value.data.weaknesses || []);
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedRoute><Layout title="Analytics"><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" /></div></Layout></ProtectedRoute>;

  const overall = analytics?.overall || {};
  const exams = analytics?.exams || [];

  return (
    <ProtectedRoute>
      <Head><title>Exam Analytics — QS Exam Prep</title></Head>
      <Layout title="📊 Exam Analytics">
        <div className="max-w-7xl space-y-6">
          {/* Overall Stats */}
          <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="📝" label="Total Attempts" value={overall.total_attempts || 0} color="bg-blue-100" />
            <StatCard icon="📊" label="Average Score" value={`${overall.avg || 0}%`} color="bg-purple-100" />
            <StatCard icon="🏆" label="Best Score" value={`${overall.best || 0}%`} color="bg-green-100" />
            <StatCard icon="✅" label="Pass Rate" value={`${overall.pass_rate || 0}%`} color="bg-amber-100" />
          </motion.div>

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <motion.div {...fadeUp} className="card border-amber-200 bg-amber-50">
              <h3 className="font-semibold text-amber-800 mb-3">⚠️ Areas Needing Improvement</h3>
              <div className="space-y-2">
                {weaknesses.map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                    <span className="text-sm font-medium text-slate-800 flex-1">{w.topic}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.level === 'easy' ? 'bg-green-100 text-green-700' : w.level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{w.level}</span>
                    <span className="text-sm font-medium text-red-600">{w.accuracy}%</span>
                    <span className="text-xs text-slate-400">{w.attempts} attempts</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Per-Exam Breakdown */}
          {exams.length === 0 ? (
            <motion.div {...fadeUp} className="card text-center py-12">
              <p className="text-4xl mb-3">📊</p>
              <h3 className="font-display font-bold text-primary-800 mb-2">No Exam Data Yet</h3>
              <p className="text-sm text-slate-500 mb-4">Complete some exams to see your analytics</p>
              <Link href="/exam-prep/interactive" className="btn-primary text-sm">Start Interactive Practice</Link>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam, i) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-primary-800">{exam.exam_name}</h3>
                      <p className="text-xs text-slate-500">{exam.exam_category} • {exam.total_attempts} attempts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-700">{exam.avg_score}%</p>
                      <p className="text-xs text-slate-500">avg score</p>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-slate-500 w-12">Best</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{ width: `${exam.best_score}%` }} />
                    </div>
                    <span className="text-xs font-medium text-green-600 w-12 text-right">{exam.best_score}%</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-slate-500 w-12">Avg</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-3">
                      <div className="bg-purple-500 h-3 rounded-full" style={{ width: `${exam.avg_score}%` }} />
                    </div>
                    <span className="text-xs font-medium text-purple-600 w-12 text-right">{exam.avg_score}%</span>
                  </div>

                  {/* Topic Breakdown */}
                  {Object.keys(exam.topic_breakdown || {}).length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Topic Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(exam.topic_breakdown).map(([topic, data]) => {
                          const rate = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                          return (
                            <div key={topic} className="p-2 bg-slate-50 rounded">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-700 truncate">{topic}</span>
                                <span className={`text-xs font-medium ${rate >= 70 ? 'text-green-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                              </div>
                              <div className="bg-slate-200 rounded-full h-1.5 mt-1">
                                <div className={`h-1.5 rounded-full ${rate >= 70 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pass Probability */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Pass probability:</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${(exam.pass_probability || 0) >= 0.7 ? 'bg-green-500' : (exam.pass_probability || 0) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.round((exam.pass_probability || 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{Math.round((exam.pass_probability || 0) * 100)}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <motion.div {...fadeUp} className="flex gap-3">
            <Link href="/exam-prep/interactive" className="btn-primary flex-1 text-center">Start Practice</Link>
            <Link href="/exam-prep" className="btn-secondary flex-1 text-center">Back to Dashboard</Link>
          </motion.div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
