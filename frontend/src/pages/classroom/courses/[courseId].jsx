import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { classroomAPI } from '../../../services/classroomAPI';
import toast from 'react-hot-toast';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const LEVEL_DESC = {
  beginner: 'Foundation concepts and basic skills',
  intermediate: 'Applied practice with real scenarios',
  advanced: 'Complex problems and professional-level work',
};

export default function CourseDetail() {
  const router = useRouter();
  const { courseId } = router.query;
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await classroomAPI.getCourseProgress(courseId);
      setCourse(res.data.course);
      setProgress(res.data.progress || null);
      setStarted(res.data.started);
      setLessons(res.data.lessons || []);
    } catch {
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const handleStart = async () => {
    setGenerating(true);
    try {
      const res = await classroomAPI.startCourse(courseId);
      toast.success('Course started!');
      router.push(`/classroom/${res.data.lesson.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start course');
      setGenerating(false);
    }
  };

  const handleNextLesson = async () => {
    setGenerating(true);
    try {
      const res = await classroomAPI.getNextLesson(courseId);
      router.push(`/classroom/${res.data.lesson.lesson_id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate lesson');
      setGenerating(false);
    }
  };

  const handleCompleteLevel = async () => {
    try {
      const res = await classroomAPI.completeLevel(courseId);
      if (res.data.passed) {
        toast.success(res.data.course_completed ? 'Course completed!' : `${LEVEL_LABELS[res.data.current_level]} unlocked!`);
        fetchData();
      } else {
        toast(res.data.message, { icon: '📊' });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to check level');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Loading…">
          <div className="text-center py-20">
            <motion.span className="text-4xl block" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>🎓</motion.span>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!course) {
    return (
      <ProtectedRoute>
        <Layout title="Course Not Found">
          <div className="text-center py-16">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-gray-600 mb-4">Course not found.</p>
            <Link href="/classroom" className="btn-primary text-sm px-5 py-2">← Back to Classroom</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const currentLevel = progress?.current_level || 'beginner';
  const completed = progress?.is_completed;
  const levelLessons = lessons.filter(l => l.level === currentLevel);
  const completedInLevel = levelLessons.filter(l => l.status === 'completed').length;
  const scoreInLevel = levelLessons.filter(l => l.score !== null);
  const avgScore = scoreInLevel.length > 0
    ? Math.round(scoreInLevel.reduce((s, l) => s + Number(l.score), 0) / scoreInLevel.length)
    : null;

  return (
    <ProtectedRoute>
      <Head><title>{course.title} - QSToolkit</title></Head>
      <Layout title={`${course.icon} ${course.title}`}>
        <div className="max-w-3xl space-y-6">
          <Link href="/classroom" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            ← Back to Classroom
          </Link>

          {/* Course info */}
          <div className="card">
            <p className="text-sm text-gray-600 mb-4">{course.description}</p>

            {/* Level progress */}
            <div className="flex items-center gap-2 mb-4">
              {LEVELS.map((lvl, idx) => {
                const isActive = !completed && currentLevel === lvl;
                const isDone = completed || LEVELS.indexOf(currentLevel) > idx;
                return (
                  <div key={lvl} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive ? 'bg-primary-600 text-white' :
                      isDone ? 'bg-emerald-500 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-primary-800' : isDone ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {LEVEL_LABELS[lvl]}
                    </span>
                    {idx < LEVELS.length - 1 && <div className={`w-8 h-0.5 ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                  </div>
                );
              })}
            </div>

            {completed ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">🏆</p>
                <p className="font-bold text-emerald-800">Course Completed!</p>
                <p className="text-sm text-emerald-600">Final score: {progress.total_score}%</p>
              </div>
            ) : started ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Current level: <strong>{LEVEL_LABELS[currentLevel]}</strong></span>
                  <span className="text-gray-500">{completedInLevel} lessons · {avgScore != null ? `${avgScore}%` : '-'}</span>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleNextLesson} disabled={generating} className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40">
                    {generating ? 'Generating…' : '📖 Next Lesson'}
                  </button>
                  {completedInLevel > 0 && (
                    <button onClick={handleCompleteLevel} className="btn-secondary text-sm px-5 py-2.5">
                      ✓ Check Level Progress
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-400">{LEVEL_DESC[currentLevel]}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">You haven&apos;t started this course yet.</p>
                <button onClick={handleStart} disabled={generating} className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40">
                  {generating ? 'Generating…' : '🚀 Start Course'}
                </button>
              </div>
            )}
          </div>

          {/* Lesson history */}
          {lessons.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-primary-800 text-sm mb-3">Lesson History</h3>
              <div className="space-y-2">
                {lessons.map((lesson, i) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      href={`/classroom/${lesson.id}`}
                      className="card flex items-center justify-between hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-800 truncate">{lesson.title}</p>
                        <p className="text-xs text-gray-500">
                          {LEVEL_LABELS[lesson.level] || 'Custom'} · {lesson.completed_scenes}/{lesson.total_scenes} scenes
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {lesson.score != null && (
                          <span className={`text-xs font-bold ${lesson.score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {lesson.score}%
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          lesson.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {lesson.status === 'completed' ? 'Done' : 'In Progress'}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
