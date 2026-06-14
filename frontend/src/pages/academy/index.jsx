import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import StrengthsWeaknessesModal from '../../components/academy/StrengthsWeaknessesModal';
import AdmissionTestModal from '../../components/academy/AdmissionTestModal';
import { academyAPI } from '../../services/api';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function AcademyDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [pathwayProgress, setPathwayProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSWModal, setShowSWModal] = useState(false);
  const [showAdmission, setShowAdmission] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, analyticsRes, progressRes] = await Promise.allSettled([
          academyAPI.getStatus(),
          academyAPI.getAnalytics(),
          academyAPI.getProgress(),
        ]);
        if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
        if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
        if (progressRes.status === 'fulfilled') setPathwayProgress(progressRes.value.data.progress || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const isAdmitted = status?.admission_completed;
  const isActive = status?.subscription_active;

  const handleSWComplete = () => {
    setShowSWModal(false);
    setShowAdmission(true);
  };

  const handleAdmissionComplete = (result) => {
    setShowAdmission(false);
    if (result?.passed) {
      toast.success('Welcome to QS Academy! 🎓');
      router.push('/academy/pathways');
    } else if (result) {
      toast.error(`You scored ${result.score}%. The pass mark is ${result.pass_mark || 60}%. Please try again.`);
    }
    // Reload status to reflect admission completion
    academyAPI.getStatus().then(res => setStatus(res.data)).catch(() => {});
  };

  return (
    <ProtectedRoute>
      <Head><title>QS Academy — QSToolkit</title></Head>
      <Layout title="🎓 QS Academy">
        <div className="max-w-7xl space-y-6">

          {/* Subscription banner */}
          {!isActive && (
            <motion.div {...fadeUp} className="bg-gradient-to-r from-gold-500 to-gold-600 rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-gold-100 text-sm">QS Academy Subscription</p>
                <h2 className="font-display text-xl font-bold mt-1">Unlock Your Full Potential</h2>
                <p className="text-gold-100 text-sm mt-1">Get access to all pathways, contests, and learning resources.</p>
              </div>
              <Link href="/subscription" className="bg-white text-gold-700 px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gold-50 transition-colors">
                Subscribe Now
              </Link>
            </motion.div>
          )}

          {/* Welcome / admission CTA */}
          {!isAdmitted ? (
            <motion.div {...fadeUp} className="bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl p-8 text-white text-center">
              <div className="text-4xl mb-3">👋</div>
              <h2 className="font-display text-2xl font-bold mb-2">Welcome to QS Academy</h2>
              <p className="text-primary-200 text-sm max-w-lg mx-auto mb-6">
                Start by telling Dr. Q about your strengths and weaknesses. This helps us personalise your learning pathway.
              </p>
              <button
                onClick={() => setShowSWModal(true)}
                className="bg-gold-500 hover:bg-gold-600 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                Start Your Admission →
              </button>
            </motion.div>
          ) : (
            <>
              {/* Quick stats */}
              <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Tokens Earned', value: analytics?.tokens_earned || 0, icon: '🪙', color: 'text-gold-600' },
                  { label: 'Contests Won', value: analytics?.contests_won || 0, icon: '🏆', color: 'text-emerald-600' },
                  { label: 'Courses Done', value: analytics?.courses_completed || 0, icon: '📚', color: 'text-primary-700' },
                  { label: 'Pathway Level', value: analytics?.current_level || 1, icon: '⬆️', color: 'text-blue-600' },
                ].map((s) => (
                  <div key={s.label} className="stat-card">
                    <span className="text-2xl mb-1">{s.icon}</span>
                    <p className={`stat-value ${s.color}`}>{loading ? '—' : s.value}</p>
                    <p className="stat-label">{s.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Pathway Progress */}
              {pathwayProgress.length > 0 && (
                <motion.div {...fadeUp} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-bold text-primary-800">My Learning Pathways</h2>
                    <Link href="/academy/pathways" className="text-xs text-primary-600 hover:underline">View all →</Link>
                  </div>
                  <div className="space-y-3">
                    {pathwayProgress.slice(0, 3).map((p) => {
                      const pct = p.progress_percent || 0;
                      return (
                        <Link
                          key={p.enrollment_id}
                          href={`/academy/pathways/${p.pathway?.slug}`}
                          className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 truncate">
                                {p.pathway?.title || 'Pathway'}
                              </h3>
                              <span className="text-xs text-gray-400">Level {p.pathway?.current_level || 1}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-primary-500' : 'bg-gold-500'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {p.completed_modules}/{p.total_modules} modules · {pct}% complete
                            </p>
                          </div>
                          <span className="text-xs text-primary-600 group-hover:text-primary-700 font-medium flex-shrink-0">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recommended pathway */}
              {analytics?.recommended_pathway && (
                <motion.div {...fadeUp} className="card bg-gradient-to-r from-primary-800 to-primary-700 text-white">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-primary-300 text-xs uppercase tracking-wide mb-1">Dr. Q Recommends</p>
                      <h3 className="font-display text-xl font-bold">{analytics.recommended_pathway.name}</h3>
                      <p className="text-primary-200 text-sm mt-1">{analytics.recommended_pathway.focus_area}</p>
                    </div>
                    <Link
                      href={`/academy/pathways/${analytics.recommended_pathway.slug}`}
                      className="bg-gold-500 hover:bg-gold-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Start Pathway →
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* Quick links */}
              <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { href: '/academy/pathways', icon: '🛤️', label: 'Pathways', desc: 'Browse all 7 career tracks' },
                  { href: '/academy/resources', icon: '📖', label: 'Resources', desc: 'Learning materials & guides' },
                  { href: '/academy/arena', icon: '⚔️', label: 'Arena', desc: 'Test your knowledge' },
                  { href: '/academy/analytics', icon: '📊', label: 'Analytics', desc: 'Track your progress' },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="card hover:shadow-md transition-shadow border-l-4 border-l-primary-500 group">
                    <span className="text-2xl mb-2 block">{link.icon}</span>
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-700">{link.label}</h3>
                    <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
                  </Link>
                ))}
              </motion.div>

              {/* Recent activity */}
              {analytics?.recent_activity && analytics.recent_activity.length > 0 && (
                <motion.div {...fadeUp} className="card">
                  <h2 className="section-title mb-4">📋 Recent Activity</h2>
                  <div className="space-y-3">
                    {analytics.recent_activity.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <span className="text-lg">{item.icon || '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{item.time_ago}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        <StrengthsWeaknessesModal
          open={showSWModal}
          onComplete={handleSWComplete}
          existingProfile={status?.profile}
        />
        <AdmissionTestModal open={showAdmission} onComplete={handleAdmissionComplete} />
      </Layout>
    </ProtectedRoute>
  );
}
