import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import ExamInterface from '../../../components/exam-prep/ExamInterface';
import ExamResults from '../../../components/exam-prep/ExamResults';
import { examAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function ExamDetailPage() {
  const router = useRouter();
  const { slug, examId, active } = router.query;
  const [status, setStatus] = useState(null);
  const [examInfo, setExamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [starting, setStarting] = useState(false);

  // Exam-in-progress state
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [examResult, setExamResult] = useState(null);

  const isActive = active === '1' || active === 1;

  // Load exam info
  useEffect(() => {
    async function load() {
      try {
        const [statusRes, examsRes] = await Promise.allSettled([
          examAPI.getStatus(),
          examAPI.getExams({})
        ]);
        if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
        if (examsRes.status === 'fulfilled') {
          const exams = examsRes.value.data?.exams || [];
          const found = exams.find(e => e.slug === slug);
          setExamInfo(found || null);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  // When active=1, fetch questions
  useEffect(() => {
    if (!isActive || !examId) return;
    async function loadQuestions() {
      setQuestionsLoading(true);
      try {
        const res = await examAPI.getExamQuestions(examId);
        const qs = res.data.questions || [];
        if (qs.length === 0) {
          toast.error('No questions available for this exam yet.');
          router.replace(`/exam-prep/professional/${slug}`);
          return;
        }
        setQuestions(qs);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load questions');
        router.replace(`/exam-prep/professional/${slug}`);
      } finally {
        setQuestionsLoading(false);
      }
    }
    loadQuestions();
  }, [isActive, examId, slug, router]);

  const hasSub = status?.active === true || status?.subscription_status === 'active';
  const hasFreeTrial = status?.free_trial_available === true;
  const canStart = hasSub || hasFreeTrial;

  const handleStart = async () => {
    if (!canStart) {
      router.push('/subscription');
      return;
    }
    setShowConfirm(true);
  };

  const confirmStart = async () => {
    setStarting(true);
    try {
      const res = await examAPI.startExam(slug);
      const id = res.data.exam_id;
      if (id) {
        router.push(`/exam-prep/professional/${slug}?examId=${id}&active=1`);
      } else {
        toast.error('Failed to start exam — no exam ID returned');
      }
      setShowConfirm(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start exam');
    } finally {
      setStarting(false);
    }
  };

  const handleExamComplete = useCallback((result) => {
    setExamResult(result);
  }, []);

  // Exam in progress — show ExamInterface
  if (isActive && questions.length > 0 && !examResult) {
    return (
      <ProtectedRoute>
        <Head><title>Exam in Progress — QSToolkit</title></Head>
        <ExamInterface
          examId={examId}
          questions={questions}
          timeLimit={examInfo?.time_limit_minutes || 60}
          onComplete={handleExamComplete}
        />
      </ProtectedRoute>
    );
  }

  // Exam completed — show results
  if (examResult) {
    return (
      <ProtectedRoute>
        <Head><title>Exam Results — QSToolkit</title></Head>
        <Layout title="Exam Results">
          <div className="max-w-3xl space-y-6">
            <Link href="/exam-prep/professional" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
              &larr; Back to Professional Exams
            </Link>
            <ExamResults attempt={examResult} />
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setExamResult(null); setQuestions([]); router.replace(`/exam-prep/professional/${slug}`); }} className="btn-primary text-sm px-6 py-2.5">
                Back to Exam Info
              </button>
              <Link href="/exam-prep/results" className="btn-secondary text-sm px-6 py-2.5">
                View All Results
              </Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // Loading questions
  if (isActive && questionsLoading) {
    return (
      <ProtectedRoute>
        <Head><title>Loading Exam — QSToolkit</title></Head>
        <Layout title="Loading Exam...">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <motion.span
                className="text-4xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🧠
              </motion.span>
            </div>
            <p className="text-sm text-gray-500">Loading exam questions...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // Detail view
  if (!examInfo && !loading) {
    return (
      <ProtectedRoute>
        <Head><title>Exam Not Found — QSToolkit</title></Head>
        <Layout title="Exam Not Found">
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-gray-500 mb-4">Exam not found</p>
            <Link href="/exam-prep/professional" className="btn-primary text-sm">Browse Exams</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Head><title>{examInfo?.exam_name || 'Exam'} — QSToolkit</title></Head>
      <Layout title={examInfo?.exam_name || 'Loading...'}>
        <div className="max-w-3xl space-y-6">

          <Link href="/exam-prep/professional" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Professional Exams
          </Link>

          {loading ? (
            <div className="card space-y-4">
              <div className="h-8 bg-gray-100 rounded w-2/3 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
            </div>
          ) : examInfo && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{examInfo?.body || examInfo?.category}</p>
                    <h1 className="font-display text-2xl font-bold text-primary-800">{examInfo?.exam_name}</h1>
                  </div>
                  <span className={`badge ${
                    examInfo?.difficulty === 'Expert' ? 'badge-red' :
                    examInfo?.difficulty === 'Advanced' ? 'badge-amber' :
                    examInfo?.difficulty === 'Intermediate' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {examInfo?.difficulty || 'Intermediate'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">{examInfo?.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Format', value: examInfo?.format || 'MCQ', icon: '📝' },
                    { label: 'Duration', value: `${examInfo?.time_limit_minutes || 60} min`, icon: '⏱️' },
                    { label: 'Pass Mark', value: examInfo?.passing_score > 0 ? `${examInfo.passing_score}%` : '—', icon: '🎯' },
                    { label: 'Body', value: examInfo?.body || examInfo?.category, icon: '🏛️' }
                  ].map(d => (
                    <div key={d.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <span className="text-lg">{d.icon}</span>
                      <p className="text-xs text-gray-500 mt-1">{d.label}</p>
                      <p className="text-sm font-semibold text-primary-800">{d.value}</p>
                    </div>
                  ))}
                </div>

                {examInfo?.topics?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-display font-bold text-primary-800 text-sm mb-3">Topics Covered</h3>
                    <div className="flex flex-wrap gap-2">
                      {examInfo.topics.map(t => (
                        <span key={t} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button onClick={handleStart} className="btn-primary text-base px-8 py-3">
                    {hasSub ? 'Start Exam' : hasFreeTrial ? 'Start Free Trial Exam' : 'Subscribe to Start'}
                  </button>
                  {!hasSub && !hasFreeTrial && (
                    <Link href="/subscription" className="text-sm text-primary-600 hover:underline">
                      View plans &rarr;
                    </Link>
                  )}
                </div>
              </motion.div>

              {!hasSub && hasFreeTrial && (
                <div className="p-4 bg-gold-50 border border-gold-200 rounded-xl text-sm text-gold-800">
                  <strong>🎁 Free Trial:</strong> This will use your 1 free exam attempt. No subscription required.
                </div>
              )}
              {!hasSub && !hasFreeTrial && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  An active Exam Prep subscription is required to access this exam.
                </div>
              )}
            </>
          )}

          <AnimatePresence>
            {showConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => !starting && setShowConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="font-display text-xl font-bold text-primary-800 mb-2">Start Exam?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {hasSub
                      ? `You are about to start the ${examInfo?.exam_name}. Your timer will begin immediately.`
                      : `This will use your 1 free exam attempt for the ${examInfo?.exam_name}. You have no more free trials remaining after this.`
                    }
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={starting}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmStart}
                      disabled={starting}
                      className="btn-primary text-sm"
                    >
                      {starting ? 'Starting...' : 'Yes, Start Exam'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
