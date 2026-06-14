import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

export default function PathwayDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [pathway, setPathway] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const [pathRes, progRes] = await Promise.allSettled([
          academyAPI.getPathway(slug),
          academyAPI.getProgress(),
        ]);
        if (pathRes.status === 'fulfilled') setPathway(pathRes.value.data.pathway);
        if (progRes.status === 'fulfilled') {
          const enrollments = progRes.value.data.enrollments || [];
          setProgress(enrollments.find((e) => e.pathway_slug === slug) || null);
        }
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [slug]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await academyAPI.enrollPathway(slug);
      toast.success('Enrolled successfully!');
      const progRes = await academyAPI.getProgress();
      const enrollments = progRes.data.enrollments || [];
      setProgress(enrollments.find((e) => e.pathway_slug === slug) || null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleSwitch = () => {
    setShowSwitchModal(false);
    handleEnroll();
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Pathway">
          <div className="max-w-4xl space-y-4">
            <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!pathway) {
    return (
      <ProtectedRoute>
        <Layout title="Pathway Not Found">
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">Pathway not found.</p>
            <Link href="/academy/pathways" className="btn-primary mt-4 inline-flex text-sm">Browse Pathways</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>{pathway.title} — QS Academy</title></Head>
      <Layout title={pathway.title}>
        <div className="max-w-4xl space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl p-8 text-white">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-primary-300 text-xs uppercase tracking-wide mb-1">{pathway.focus_area}</p>
                <h1 className="font-display text-2xl font-bold">{pathway.title}</h1>
                <p className="text-primary-200 text-sm mt-2 max-w-xl leading-relaxed">{pathway.description}</p>
              </div>
              {!progress ? (
                <button
                  onClick={() => {
                    if (enrollments?.length > 0) setShowSwitchModal(true);
                    else handleEnroll();
                  }}
                  disabled={enrolling}
                  className="bg-gold-500 hover:bg-gold-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll in Pathway'}
                </button>
              ) : (
                <div className="bg-white/10 rounded-xl px-6 py-4 text-center">
                  <p className="text-xs text-primary-300">Current Level</p>
                  <p className="text-3xl font-bold text-gold-400 font-display">{progress.current_level}</p>
                </div>
              )}
            </div>
            {progress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-primary-300 mb-1">
                  <span>Progress</span>
                  <span>Level {progress.current_level} of {pathway.levels?.length || 5}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gold-400 transition-all" style={{ width: `${((progress.current_level) / (pathway.levels?.length || 5)) * 100}%` }} />
                </div>
              </div>
            )}
          </motion.div>

          {/* Levels */}
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-primary-800">Pathway Levels</h2>
            {(pathway.levels || []).map((level, i) => {
              const isCurrent = progress && progress.current_level === level.level_number;
              const isCompleted = progress && progress.current_level > level.level_number;
              const isLocked = progress && progress.current_level < level.level_number - 1;

              return (
                <motion.div
                  key={level.level_number}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`card border-l-4 transition-all ${
                    isCurrent ? 'border-l-gold-500 bg-gold-50/50' :
                    isCompleted ? 'border-l-emerald-500' :
                    'border-l-gray-200'
                  } ${isLocked ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' :
                      isCurrent ? 'bg-gold-100 text-gold-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {isCompleted ? '✓' : level.level_number}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{level.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{level.description}</p>
                      {level.competencies && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {level.competencies.map((c) => (
                            <span key={c} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">{c}</span>
                          ))}
                        </div>
                      )}
                      {level.outcomes && (
                        <p className="text-xs text-gray-400 mt-2">Outcome: {level.outcomes}</p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="px-2.5 py-1 bg-gold-100 text-gold-700 text-xs font-semibold rounded-full flex-shrink-0">Current</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Switch pathway modal */}
        <AnimatePresence>
          {showSwitchModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                <div className="text-3xl mb-3">⚠️</div>
                <h3 className="font-display text-lg font-bold text-primary-800 mb-2">Switch Pathway?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  You are already enrolled in another pathway. Switching will start fresh on this new track. Your previous progress will be saved.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowSwitchModal(false)} className="btn-secondary px-5 py-2 text-sm">
                    Cancel
                  </button>
                  <button onClick={handleSwitch} className="btn-primary px-5 py-2 text-sm">
                    Yes, Switch
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </ProtectedRoute>
  );
}
