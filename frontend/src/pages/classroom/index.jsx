import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

const SCENE_TYPE_ICONS = {
  lecture: '📖', quiz: '📝', boq: '📊', rate_analysis: '💰',
  measurement: '📏', cost_plan: '🧮', pbl: '🎯', discussion: '💬',
};

export default function ClassroomDashboard() {
  const [lessons, setLessons] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lessonsRes, analyticsRes] = await Promise.all([
        classroomAPI.getLessons({ scene_type: filter === 'all' ? undefined : filter }),
        classroomAPI.getAnalytics(),
      ]);
      setLessons(lessonsRes.data.lessons || []);
      setAnalytics(analyticsRes.data);
    } catch {
      toast.error('Failed to load classroom data');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await classroomAPI.deleteLesson(id);
      setLessons(prev => prev.filter(l => l.id !== id));
      toast.success('Lesson deleted');
    } catch {
      toast.error('Failed to delete lesson');
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Classroom — QSToolkit</title></Head>
      <Layout title="🎓 Scene-Based Learning">
        <div className="max-w-5xl space-y-6">
          {/* Analytics */}
          {analytics && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Lessons', value: analytics.total_lessons || 0, icon: '📚' },
                { label: 'Avg Score', value: `${analytics.avg_score || 0}%`, icon: '📊' },
                { label: 'Time Spent', value: `${analytics.time_spent_minutes || 0}m`, icon: '⏱️' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card text-center"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <p className="font-bold text-primary-800 mt-1">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Header & Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All scene types</option>
                {Object.entries(SCENE_TYPE_ICONS).map(([key, icon]) => (
                  <option key={key} value={key}>{icon} {key.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <Link href="/classroom/new" className="btn-primary text-sm px-5 py-2">
              + New Lesson
            </Link>
          </div>

          {/* Lessons grid */}
          {loading ? (
            <div className="text-center py-16">
              <motion.span className="text-4xl block" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>🧠</motion.span>
            </div>
          ) : lessons.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-5xl mb-4">🎓</p>
              <h3 className="font-display font-bold text-primary-800 mb-2">No Lessons Yet</h3>
              <p className="text-sm text-gray-500 mb-6">Create your first scene-based lesson to get started.</p>
              <Link href="/classroom/new" className="btn-primary text-sm px-6 py-2.5">
                + Create Lesson
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((lesson, i) => {
                const progress = lesson.total_scenes > 0
                  ? Math.round((lesson.completed_scenes / lesson.total_scenes) * 100)
                  : 0;
                return (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="card hover:shadow-md transition-shadow"
                  >
                    <Link href={`/classroom/${lesson.id}`}>
                      <h3 className="font-display font-bold text-primary-800 text-sm mb-1 hover:underline">
                        {lesson.title || lesson.topic}
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        {lesson.total_scenes} scenes · {lesson.difficulty || 'medium'} · {new Date(lesson.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{progress}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {(lesson.scene_types || []).slice(0, 4).map(t => (
                            <span key={t} className="text-sm" title={t}>{SCENE_TYPE_ICONS[t] || '📄'}</span>
                          ))}
                          {(lesson.scene_types || []).length > 4 && (
                            <span className="text-xs text-gray-400">+{(lesson.scene_types || []).length - 4}</span>
                          )}
                        </div>
                        {lesson.score != null && (
                          <span className="text-xs font-bold text-primary-700">{lesson.score}%</span>
                        )}
                      </div>
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDelete(lesson.id); }}
                      className="mt-3 text-xs text-gray-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
