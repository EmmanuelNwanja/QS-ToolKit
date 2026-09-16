import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function ClassroomDashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    classroomAPI.getCourses()
      .then(res => setCourses(res.data.courses || []))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  }, []);

  const handleStartCourse = async (courseId) => {
    try {
      const res = await classroomAPI.startCourse(courseId);
      router.push(`/classroom/${res.data.lesson.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start course');
    }
  };

  const handleContinueCourse = async (courseId) => {
    try {
      const res = await classroomAPI.getNextLesson(courseId);
      router.push(`/classroom/${res.data.lesson.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate lesson');
    }
  };

  const handleCustomLesson = async () => {
    if (!customTopic.trim()) return;
    setGenerating(true);
    try {
      const res = await classroomAPI.generateCustomLesson({
        topic: customTopic.trim(),
        difficulty: 'medium',
      });
      router.push(`/classroom/${res.data.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate lesson');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>Classroom — QSToolkit</title></Head>
      <Layout title="🎓 Classroom">
        <div className="max-w-5xl space-y-8">

          {/* ── Course Catalog ──────────────────────────────── */}
          <div>
            <h2 className="font-display font-bold text-primary-800 text-lg mb-1">QS Learning Pathways</h2>
            <p className="text-sm text-gray-500 mb-4">Structured courses with progressive difficulty. Master each level to advance.</p>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="card animate-pulse h-40" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map((course, i) => {
                  const prog = course.user_progress;
                  const started = !!prog;
                  const level = prog?.current_level || 'beginner';
                  const completed = prog?.is_completed;
                  const score = prog?.total_score;

                  return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl">{course.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-bold text-primary-800 text-sm">{course.title}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{course.description}</p>
                        </div>
                      </div>

                      {/* Level badges */}
                      <div className="flex items-center gap-1.5 mb-3">
                        {['beginner', 'intermediate', 'advanced'].map(lvl => (
                          <span
                            key={lvl}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              started && LEVEL_LABELS[level] === lvl
                                ? 'bg-primary-600 text-white'
                                : completed || (started && levelIndex(lvl) < levelIndex(level))
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {LEVEL_LABELS[lvl]}
                          </span>
                        ))}
                      </div>

                      {/* Progress or action */}
                      {completed ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-emerald-600 font-semibold">✓ Completed — {score}%</span>
                          <button
                            onClick={() => handleContinueCourse(course.id)}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Practice Again →
                          </button>
                        </div>
                      ) : started ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-gray-500">{prog.completed_lessons} lessons · </span>
                            <span className="text-xs font-semibold text-primary-700">{score != null ? `${score}%` : '—'}</span>
                          </div>
                          <button
                            onClick={() => handleContinueCourse(course.id)}
                            className="btn-primary text-xs px-4 py-1.5"
                          >
                            Continue →
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartCourse(course.id)}
                          className="w-full btn-primary text-xs py-2"
                        >
                          Start Course
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Custom Learning ─────────────────────────────── */}
          <div className="card border-dashed border-2 border-primary-200 bg-primary-50/30">
            <h3 className="font-display font-bold text-primary-800 text-sm mb-1">Learn Something Custom</h3>
            <p className="text-xs text-gray-500 mb-3">Tell us what you want to learn and we&apos;ll generate a lesson for you.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomLesson()}
                placeholder="e.g. Retaining wall design and measurement"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={handleCustomLesson}
                disabled={!customTopic.trim() || generating}
                className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40 whitespace-nowrap"
              >
                {generating ? 'Generating…' : 'Generate Lesson'}
              </button>
            </div>
          </div>

          {/* ── Quick Links ─────────────────────────────────── */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/classroom/migrate" className="hover:text-primary-600">📦 Migrate Old Data</Link>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

function levelIndex(level) {
  return ['beginner', 'intermediate', 'advanced'].indexOf(level);
}
