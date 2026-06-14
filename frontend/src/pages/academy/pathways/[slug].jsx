import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

export default function PathwayDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [pathway, setPathway] = useState(null);
  const [levels, setLevels] = useState({});
  const [progress, setProgress] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [completingModule, setCompletingModule] = useState(null);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const [pathRes, progRes] = await Promise.allSettled([
          academyAPI.getPathway(slug),
          academyAPI.getProgress(),
        ]);
        if (pathRes.status === 'fulfilled') {
          const data = pathRes.value.data;
          setPathway(data.pathway);
          setLevels(data.levels || {});
          setCompletedCount(data.completed_count || 0);
        }
        if (progRes.status === 'fulfilled') {
          const progressList = progRes.value.data.progress || [];
          setProgress(progressList.find((e) => e.pathway?.slug === slug) || null);
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
      const progressList = progRes.data.progress || [];
      setProgress(progressList.find((e) => e.pathway?.slug === slug) || null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCompleteModule = async (moduleId) => {
    setCompletingModule(moduleId);
    try {
      await academyAPI.completeModule({ pathway_slug: slug, module_id: moduleId });
      toast.success('Module completed! +10 points');
      setCompletedCount(prev => prev + 1);
      // Update levels state to mark module as completed
      setLevels(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(level => {
          updated[level] = updated[level].map(m =>
            m.id === moduleId ? { ...m, completed: true } : m
          );
        });
        return updated;
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to complete module');
    } finally {
      setCompletingModule(null);
    }
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
          {/* Back button */}
          <Link href="/academy/pathways" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <span>←</span> All Pathways
          </Link>

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
                  onClick={handleEnroll}
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
                  <span>Progress — {completedCount} modules completed</span>
                  <span>Level {progress.current_level} of {pathway.levels?.length || 5}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gold-400 transition-all" style={{ width: `${pathway.module_count > 0 ? (completedCount / pathway.module_count) * 100 : 0}%` }} />
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
              const levelModules = levels[level.level_number] || [];
              const levelCompleted = levelModules.filter(m => m.completed).length;

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
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{level.title}</h3>
                        {levelModules.length > 0 && (
                          <span className="text-xs text-gray-400">{levelCompleted}/{levelModules.length} modules</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{level.description}</p>
                      {level.competencies && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {level.competencies.map((c) => (
                            <span key={c} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="px-2.5 py-1 bg-gold-100 text-gold-700 text-xs font-semibold rounded-full flex-shrink-0">Current</span>
                    )}
                  </div>

                  {/* Modules list */}
                  {levelModules.length > 0 && (
                    <div className="mt-4 ml-14 space-y-2">
                      {levelModules.map((mod) => {
                        const typeIcons = { article: '📖', video: '🎬', quiz: '📝', exercise: '💪', case_study: '📋', worksheet: '📄' };
                        return (
                          <div
                            key={mod.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                              mod.completed ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 hover:border-primary-200'
                            }`}
                          >
                            <span className="text-lg">{typeIcons[mod.module_type] || '📄'}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${mod.completed ? 'text-emerald-800' : 'text-gray-900'}`}>{mod.title}</p>
                              <p className="text-xs text-gray-400">{mod.module_type} · {mod.duration_minutes} min · {mod.points} pts</p>
                            </div>
                            {mod.completed ? (
                              <span className="text-emerald-600 text-xs font-semibold">✓ Done</span>
                            ) : progress ? (
                              <button
                                onClick={() => handleCompleteModule(mod.id)}
                                disabled={completingModule === mod.id}
                                className="text-xs px-3 py-1 bg-primary-100 text-primary-700 rounded-full font-medium hover:bg-primary-200 disabled:opacity-50"
                              >
                                {completingModule === mod.id ? '...' : 'Complete'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
