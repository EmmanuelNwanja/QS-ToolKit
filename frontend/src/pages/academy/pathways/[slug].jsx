import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import PathwayLevelContent from '../../../components/academy/PathwayLevelContent';
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

  const handleSubmitProject = async (projectData) => {
    // In a real implementation, this would upload the file and submit to the backend
    // For now, we'll simulate the submission
    toast.success('Project submitted for AI review!');
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
                <LevelAccordion
                  key={level.level_number}
                  level={level}
                  levelModules={levelModules}
                  isCurrent={isCurrent}
                  isCompleted={isCompleted}
                  isLocked={isLocked}
                  levelCompleted={levelCompleted}
                  progress={progress}
                  onCompleteModule={handleCompleteModule}
                  onSubmitProject={handleSubmitProject}
                  completingModule={completingModule}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

/**
 * Level Accordion Component - Expandable level with interactive content
 */
function LevelAccordion({ 
  level, 
  levelModules, 
  isCurrent, 
  isCompleted, 
  isLocked, 
  levelCompleted, 
  progress, 
  onCompleteModule, 
  onSubmitProject,
  completingModule,
  index 
}) {
  const [isExpanded, setIsExpanded] = useState(isCurrent || false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`border rounded-xl overflow-hidden transition-all ${
        isCurrent ? 'border-gold-300 bg-gold-50/30 shadow-sm' :
        isCompleted ? 'border-emerald-200 bg-emerald-50/20' :
        isLocked ? 'border-gray-200 bg-gray-50 opacity-60' :
        'border-gray-200 hover:border-primary-200 hover:shadow-sm'
      }`}
    >
      {/* Level Header - Always visible and clickable */}
      <button
        onClick={() => !isLocked && setIsExpanded(!isExpanded)}
        disabled={isLocked}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/50 transition-colors"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
          isCompleted ? 'bg-emerald-100 text-emerald-700' :
          isCurrent ? 'bg-gold-100 text-gold-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {isCompleted ? '✓' : level.level_number}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{level.title}</h3>
            {levelModules.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {levelCompleted}/{levelModules.length} completed
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{level.description}</p>
          {level.competencies && level.competencies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {level.competencies.slice(0, 3).map((c) => (
                <span key={c} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">{c}</span>
              ))}
              {level.competencies.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                  +{level.competencies.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isCurrent && (
            <span className="px-3 py-1 bg-gold-100 text-gold-700 text-xs font-semibold rounded-full">
              🎯 Current
            </span>
          )}
          {isCompleted && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              ✓ Done
            </span>
          )}
          {isLocked && (
            <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">
              🔒
            </span>
          )}
          {!isLocked && (
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Level Content - Expandable */}
      <AnimatePresence>
        {isExpanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="pt-4">
                <PathwayLevelContent
                  level={level}
                  modules={levelModules}
                  onCompleteModule={onCompleteModule}
                  onSubmitProject={onSubmitProject}
                  userProgress={{
                    points: levelModules.filter(m => m.completed).length * 10,
                    badges: isCompleted ? ['level_complete'] : [],
                    streak: 0
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
