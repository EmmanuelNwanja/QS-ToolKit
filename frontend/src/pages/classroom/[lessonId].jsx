import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import SceneRenderer from '../../components/classroom/SceneRenderer';
import { classroomAPI } from '../../services/classroomAPI';
import toast from 'react-hot-toast';

const SCENE_ICONS = {
  lecture: '📖', quiz: '📝', boq: '📊', rate_analysis: '💰',
  measurement: '📏', cost_plan: '🧮', pbl: '🎯', discussion: '💬',
};

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LessonPlayer() {
  const router = useRouter();
  const { lessonId } = router.query;

  const [lesson, setLesson] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [completedScenes, setCompletedScenes] = useState(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    classroomAPI.getLesson(lessonId)
      .then(res => {
        setLesson(res.data.lesson);
        setScenes(res.data.scenes || []);
        setCompletedScenes(new Set((res.data.completed_scenes || []).map(String)));
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load lesson'); setLoading(false); });
  }, [lessonId]);

  const isCourseLesson = !!lesson?.course_id;

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeScene = scenes[activeIdx];

  const handleSceneComplete = useCallback(async (result) => {
    const sceneId = scenes[activeIdx]?.id;
    if (!sceneId) return;
    try {
      setCompletedScenes(prev => new Set([...prev, String(sceneId)]));
      await classroomAPI.submitSceneResponse(sceneId, { completed: true, result });
    } catch { /* ok */ }
  }, [scenes, activeIdx]);

  const handleNext = useCallback(() => {
    if (activeIdx < scenes.length - 1) {
      setActiveIdx(i => i + 1);
    }
  }, [activeIdx, scenes.length]);

  const handlePrev = () => setActiveIdx(i => Math.max(0, i - 1));

  const handleGenerateContent = async (sceneId) => {
    setGenerating(sceneId);
    try {
      const res = await classroomAPI.generateSceneContent(sceneId);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, content: res.data.content } : s));
      toast.success('Content generated!');
    } catch {
      toast.error('Failed to generate content');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Loading…">
          <div className="text-center py-20">
            <motion.span className="text-4xl block" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>🧠</motion.span>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const progress = scenes.length > 0 ? Math.round((completedScenes.size / scenes.length) * 100) : 0;

  return (
    <ProtectedRoute>
      <Head><title>{lesson?.title || lesson?.topic || 'Lesson'} — QSToolkit</title></Head>
      <Layout title={lesson?.title || lesson?.topic || 'Lesson'}>
        <div className="max-w-5xl">
          <Link href={isCourseLesson ? `/classroom/courses/${lesson.course_id}` : '/classroom'} className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-4">
            &larr; {isCourseLesson ? 'Back to Course' : 'Back to Classroom'}
          </Link>

          {/* Progress bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{completedScenes.size}/{scenes.length} scenes · {lesson?.difficulty || 'medium'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <span className="text-xs font-mono text-gray-500">{formatTime(elapsed)}</span>
          </div>

          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-56 flex-shrink-0 hidden lg:block">
              <div className="card space-y-1 p-3">
                {scenes.map((s, i) => {
                  const done = completedScenes.has(String(s.id));
                  const active = i === activeIdx;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveIdx(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                        active ? 'bg-primary-100 text-primary-800 font-semibold' :
                        done ? 'text-emerald-600 hover:bg-gray-50' :
                        'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{SCENE_ICONS[s.scene_type] || '📄'}</span>
                      <span className="flex-1 truncate">{s.title || s.scene_type?.replace(/_/g, ' ')}</span>
                      {done && <span className="text-emerald-500">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main area */}
            <div className="flex-1 min-w-0">
              {activeScene && (
                <motion.div
                  key={activeScene.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {!activeScene.content ? (
                    <div className="card text-center py-12">
                      <p className="text-4xl mb-3">🔮</p>
                      <p className="text-sm text-gray-600 mb-4">Scene content needs to be generated.</p>
                      <button
                        onClick={() => handleGenerateContent(activeScene.id)}
                        disabled={generating === activeScene.id}
                        className="btn-primary text-sm px-6 py-2"
                      >
                        {generating === activeScene.id ? 'Generating…' : '✨ Generate Content'}
                      </button>
                    </div>
                  ) : (
                    <SceneRenderer
                      scene={activeScene}
                      onComplete={handleSceneComplete}
                      onNext={handleNext}
                    />
                  )}
                </motion.div>
              )}

              {/* Nav buttons */}
              <div className="flex items-center justify-between mt-6">
                <button onClick={handlePrev} disabled={activeIdx === 0} className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">
                  ← Previous
                </button>
                <span className="text-xs text-gray-500">{activeIdx + 1} / {scenes.length}</span>
                {activeIdx < scenes.length - 1 ? (
                  <button onClick={handleNext} className="btn-primary text-sm px-4 py-2">Next →</button>
                  ) : isCourseLesson ? (
                  <Link
                    href={`/classroom/courses/${lesson.course_id}`}
                    className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700"
                  >
                    Check Level Progress →
                  </Link>
                ) : (
                  <Link href="/classroom" className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
                    Finish Lesson
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
