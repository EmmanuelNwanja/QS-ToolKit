import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { examAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/helpers';

const card = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function ExamPrepDashboard() {
  const [status, setStatus] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [stats, setStats] = useState({ taken: 0, avgScore: 0, passRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, attemptsRes] = await Promise.allSettled([
          examAPI.getStatus(),
          examAPI.getAttempts()
        ]);

        if (statusRes.status === 'fulfilled') {
          setStatus(statusRes.value.data);
        }
        if (attemptsRes.status === 'fulfilled') {
          const list = attemptsRes.value.data.attempts || [];
          setAttempts(list.slice(0, 5));

          const total = list.length;
          const avgScore = total > 0
            ? Math.round(list.reduce((sum, a) => sum + (a.score || 0), 0) / total)
            : 0;
          const passed = list.filter(a => a.passed).length;
          const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
          setStats({ taken: total, avgScore, passRate });
        }
      } catch {
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasActiveSub = status?.subscription_status === 'active';
  const hasFreeTrial = status?.free_trial_available === true;
  const subExpired = status?.subscription_status === 'expired';

  return (
    <ProtectedRoute>
      <Head><title>Exam Prep — QSToolkit</title></Head>
      <Layout title="📝 Exam Prep">
        <div className="max-w-6xl space-y-6">

          {/* Subscription banner */}
          {subExpired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4"
            >
              <div>
                <p className="font-semibold text-red-800">Your Exam Prep subscription has expired</p>
                <p className="text-sm text-red-600 mt-1">Renew to continue accessing all exams and track your progress.</p>
              </div>
              <Link href="/subscription" className="btn-gold text-sm">Renew Subscription</Link>
            </motion.div>
          )}

          {!hasActiveSub && !hasFreeTrial && !subExpired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl p-6 text-white"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-primary-200 text-sm uppercase tracking-wide mb-1">Get Started</p>
                  <h2 className="font-display text-xl font-bold">Exam Prep Subscription</h2>
                  <p className="text-primary-200 text-sm mt-1">Access Nigerian &amp; international professional exams, university past questions, and AI-powered explanations.</p>
                </div>
                <Link href="/subscription" className="btn-gold text-sm">Subscribe Now</Link>
              </div>
            </motion.div>
          )}

          {/* Free trial badge */}
          {hasFreeTrial && !hasActiveSub && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-gold-50 to-gold-100 border border-gold-300 rounded-xl p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-gold-200 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-gold-800">1 Free Exam Available!</p>
                <p className="text-sm text-gold-700">Try any professional exam once for free — no subscription required.</p>
              </div>
            </motion.div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Exams Taken', value: stats.taken, icon: '📋', color: 'text-primary-700' },
              { label: 'Avg Score', value: `${stats.avgScore}%`, icon: '📊', color: 'text-blue-600' },
              { label: 'Pass Rate', value: `${stats.passRate}%`, icon: '✅', color: 'text-emerald-600' }
            ].map(s => (
              <motion.div key={s.label} variants={card} initial="hidden" animate="show" className="stat-card text-center">
                <span className="text-2xl mb-1">{s.icon}</span>
                <p className={`stat-value ${s.color} text-xl`}>{loading ? '—' : s.value}</p>
                <p className="stat-label text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick access cards */}
          <div className="grid md:grid-cols-3 gap-5">
            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
              <Link href="/exam-prep/professional" className="card hover:shadow-card-md hover:border-primary-200 transition-all group block">
                <div className="text-3xl mb-3">🏗️</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Professional Exams</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Nigerian (NIQS, QSRBN) &amp; International (RICS, CIOB, PMP, PRINCE2) professional certification prep.</p>
                <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                  Browse Exams <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
              <Link href="/exam-prep/students" className="card hover:shadow-card-md hover:border-primary-200 transition-all group block">
                <div className="text-3xl mb-3">🎓</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">Student Exams</h3>
                <p className="text-xs text-gray-500 leading-relaxed">University past questions from 10 Nigerian universities. Browse by course and year.</p>
                <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                  Browse Universities <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={card} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
              <Link href="/exam-prep/results" className="card hover:shadow-card-md hover:border-primary-200 transition-all group block">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-display font-bold text-primary-800 group-hover:text-primary-600 mb-1">My Results</h3>
                <p className="text-xs text-gray-500 leading-relaxed">View detailed results, score trends, and identify weak areas to improve.</p>
                <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                  View Results <span>&rarr;</span>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* Recent attempts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Recent Attempts</h2>
              <Link href="/exam-prep/results" className="text-sm text-primary-600 hover:underline">View all &rarr;</Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : attempts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm">No exam attempts yet</p>
                <Link href="/exam-prep/professional" className="btn-primary text-sm mt-3 inline-flex">Start Your First Exam</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {attempts.map(a => (
                  <Link
                    key={a.id}
                    href={`/exam-prep/results?attempt=${a.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-700">{a.exam_name || 'Exam'}</p>
                      <p className="text-xs text-gray-500">{formatDate(a.completed_at || a.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className={`text-sm font-bold ${a.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                        {a.score}%
                      </span>
                      <span className={`badge ${a.passed ? 'badge-green' : 'badge-red'}`}>
                        {a.passed ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
