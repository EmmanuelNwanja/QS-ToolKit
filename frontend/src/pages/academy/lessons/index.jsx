import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [pathways, setPathways] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState({ pathway_id: '', difficulty: '' });

  useEffect(() => {
    async function load() {
      try {
        const [lessonsRes, pathwaysRes, progressRes] = await Promise.allSettled([
          academyAPI.getLessons(filter.pathway_id ? { pathway_id: filter.pathway_id, difficulty: filter.difficulty || undefined } : {}),
          academyAPI.getPathways(),
          academyAPI.getLessonProgress(),
        ]);
        if (lessonsRes.status === 'fulfilled') setLessons(lessonsRes.value.data.lessons || []);
        if (pathwaysRes.status === 'fulfilled') setPathways(pathwaysRes.value.data.pathways || []);
        if (progressRes.status === 'fulfilled') setProgress(progressRes.value.data);
      } catch { toast.error('Failed to load lessons'); }
      finally { setLoading(false); }
    }
    load();
  }, [filter]);

  const handleGenerate = async (pathwayId, moduleId, topic) => {
    setGenerating(true);
    try {
      const { data } = await academyAPI.generateLesson({ pathway_id: pathwayId, module_id: moduleId, topic, difficulty: 'intermediate' });
      toast.success('Lesson generated!');
      setLessons(prev => [data.lesson || data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate lesson');
    } finally { setGenerating(false); }
  };

  return (
    <ProtectedRoute>
      <Head><title>AI Lessons - QS Academy</title></Head>
      <Layout title="📚 AI Lessons">
        <div className="max-w-7xl space-y-6">
          {/* Progress Summary */}
          {progress && (
            <motion.div {...fadeUp} className="card bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-primary-800">Your Learning Progress</h3>
                  <p className="text-sm text-slate-600 mt-1">{progress.completed || 0} of {progress.total || 0} lessons completed</p>
                </div>
                <div className="text-3xl font-bold text-purple-600">{progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%</div>
              </div>
            </motion.div>
          )}

          {/* Filters */}
          <motion.div {...fadeUp} className="flex flex-wrap gap-3">
            <select value={filter.pathway_id} onChange={e => setFilter(f => ({ ...f, pathway_id: e.target.value }))} className="input text-sm">
              <option value="">All Pathways</option>
              {pathways.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <select value={filter.difficulty} onChange={e => setFilter(f => ({ ...f, difficulty: e.target.value }))} className="input text-sm">
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </motion.div>

          {/* Generate New */}
          <motion.div {...fadeUp} className="card border-dashed border-2 border-purple-300 bg-purple-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-xl">✨</div>
              <div className="flex-1">
                <h4 className="font-semibold text-primary-800">Generate New Lesson</h4>
                <p className="text-sm text-slate-500">Dr. Q will create a personalized lesson for any QS topic</p>
              </div>
              <button
                onClick={() => {
                  const topic = prompt('Enter the QS topic for the lesson:');
                  if (topic) handleGenerate(pathways[0]?.id, 'custom', topic);
                }}
                disabled={generating || !pathways.length}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </motion.div>

          {/* Lessons Grid */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" /></div>
          ) : lessons.length === 0 ? (
            <motion.div {...fadeUp} className="card text-center py-12">
              <p className="text-4xl mb-3">📖</p>
              <h3 className="font-display font-bold text-primary-800 mb-2">No Lessons Yet</h3>
              <p className="text-sm text-slate-500">Generate your first AI lesson to start learning</p>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessons.map((lesson, i) => (
                <motion.div key={lesson.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                  className="card hover:shadow-md transition-shadow cursor-pointer">
                  <Link href={`/academy/lessons/${lesson.id}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-primary-800 line-clamp-2">{lesson.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[lesson.difficulty] || ''}`}>
                          {lesson.difficulty}
                        </span>
                      </div>
                      {lesson.content?.objectives && (
                        <p className="text-sm text-slate-600 line-clamp-2">{lesson.content.objectives[0]}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>⏱ {lesson.estimated_minutes || 15} min</span>
                        <span>📝 {lesson.content?.sections?.length || 0} sections</span>
                        <span className="ml-auto text-purple-600 font-medium">{lesson.lesson_type}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
