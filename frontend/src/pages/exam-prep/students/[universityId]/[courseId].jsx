import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../../../components/Layout';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { examAPI } from '../../../../services/api';
import toast from 'react-hot-toast';

export default function CourseExamPage() {
  const router = useRouter();
  const { universityId, courseId, mode } = router.query;
  const timedMode = mode !== 'untimed';

  // Step states
  const [step, setStep] = useState('loading'); // loading | select | quiz | submitting | results
  const [university, setUniversity] = useState(null);
  const [course, setCourse] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);

  // Quiz state
  const [examId, setExamId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Results
  const [result, setResult] = useState(null);

  const timerRef = useRef(null);
  const handleSubmitRef = useRef(null);

  // ── Load available exams for this course ──────────────────────
  useEffect(() => {
    if (!universityId || !courseId) return;
    let cancelled = false;
    async function load() {
      try {
        const [examsRes, coursesRes] = await Promise.all([
          examAPI.getPastQuestions({ university: universityId, course: courseId }),
          examAPI.getUniversityCourses(universityId)
        ]);
        const items = examsRes.data?.past_questions || [];
        const uni = coursesRes.data?.university;
        const courseList = coursesRes.data?.courses || [];
        const courseInfo = courseList.find(c => c.id === courseId);
        if (cancelled) return;
        setUniversity(uni);
        setCourse(courseInfo);
        setExams(items);
        setStep('select');
      } catch (err) {
        toast.error('Failed to load exams');
        setStep('select');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [universityId, courseId]);

  // ── Start exam ───────────────────────────────────────────────
  const startExam = useCallback(async (exam) => {
    try {
      setSelectedExam(exam);
      const startRes = await examAPI.startExam(exam.id);
      const data = startRes.data;
      setExamId(exam.id);
      setAttemptId(data.attempt_id || data.id);

      const qRes = await examAPI.getExamQuestions(exam.id, { question_count: exam.total_questions || 50 });
      setQuestions(qRes.data?.questions || []);
      setTimeLeft((exam.time_limit_minutes || 60) * 60);
      setStep('quiz');
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Subscription required. Free trial already used.');
        router.push('/subscription');
      } else {
        toast.error(err.response?.data?.error || 'Failed to start exam');
      }
    }
  }, [router]);

  // ── Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'quiz' || !timedMode) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (handleSubmitRef.current) handleSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, timedMode]);

  // ── Answer question ──────────────────────────────────────────
  const setAnswer = (qId, option) => {
    setAnswers(prev => ({ ...prev, [qId]: option }));
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setStep('submitting');
    clearInterval(timerRef.current);
    try {
      const payload = questions.map(q => ({
        question_id: q.id,
        selected_option: answers[q.id] || null
      }));
      const res = await examAPI.submitExam(examId, {
        attempt_id: attemptId,
        answers: payload,
        time_taken_seconds: timedMode
          ? (selectedExam?.time_limit_minutes || 60) * 60 - timeLeft
          : 0
      });
      setResult(res.data);
      setStep('results');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit exam');
      setStep('quiz');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, questions, answers, examId, attemptId, timedMode, selectedExam, timeLeft]);

  // Keep ref in sync for timer
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  // ── Helpers ──────────────────────────────────────────────────
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const answered = Object.keys(answers).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  // ── Loading ──────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <ProtectedRoute>
        <Head><title>Loading — QSToolkit</title></Head>
        <Layout title="Loading...">
          <div className="max-w-2xl mx-auto space-y-4 py-8">
            <div className="h-6 bg-gray-100 rounded w-1/3 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse" />
            <div className="space-y-3 mt-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // ── Select exam ──────────────────────────────────────────────
  if (step === 'select') {
    const grouped = {};
    exams.forEach(e => {
      const yr = e.year || 'Other';
      if (!grouped[yr]) grouped[yr] = [];
      grouped[yr].push(e);
    });
    const years = Object.keys(grouped).sort((a, b) => b - a);

    return (
      <ProtectedRoute>
        <Head><title>Select Exam — QSToolkit</title></Head>
        <Layout title="Select Exam">
          <div className="max-w-2xl space-y-6">
            <Link href={`/exam-prep/students/${universityId}`} className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
              &larr; Back to courses
            </Link>

            <div>
              <h1 className="font-display text-2xl font-bold text-primary-800">
                {course?.title || 'Exam'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {university?.name ? `${university.name} — ` : ''}
                Select a past question year to begin your {timedMode ? 'timed exam' : 'practice session'}
              </p>
            </div>

            {exams.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-3">📝</p>
                <p className="text-gray-500">No past questions available for this course yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {years.map(yr => (
                  <div key={yr}>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{yr}</h2>
                    <div className="space-y-2">
                      {grouped[yr].map(exam => (
                        <motion.button
                          key={exam.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => startExam(exam)}
                          className="w-full card hover:shadow-card-md hover:border-primary-200 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-700">
                                {exam.exam_name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                {exam.total_questions || '—'} questions · {exam.time_limit_minutes || 60} min · Pass: {exam.passing_score || 50}%
                              </p>
                            </div>
                            <span className={`badge ${
                              exam.difficulty === 'advanced' ? 'badge-red' :
                              exam.difficulty === 'intermediate' ? 'badge-amber' : 'badge-gray'
                            }`}>
                              {timedMode ? '⏱️ Timed' : '📖 Practice'}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // ── Quiz ─────────────────────────────────────────────────────
  if (step === 'quiz') {
    const q = questions[current];
    if (!q) return null;

    return (
      <ProtectedRoute>
        <Head><title>Exam — QSToolkit</title></Head>
        <Layout title={selectedExam?.exam_name || 'Exam'}>
          <div className="max-w-2xl space-y-6">

            {/* Timer & Progress */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Question {current + 1} of {total}</p>
                <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-1">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {timedMode && (
                <div className={`text-right font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-primary-700'}`}>
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>

            {/* Question card */}
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <p className="font-display font-bold text-primary-800 text-lg mb-1">
                Question {current + 1}
              </p>
              <p className="text-gray-800 leading-relaxed mb-6">{(q.question_text || q.question || '').replace(/^\d+\.\s*/, '')}</p>

              <div className="space-y-2">
                {(q.options || []).map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const selected = answers[q.id] === opt;
                  // Strip existing letter prefix to avoid double display
                  const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;
                  return (
                    <button
                      key={idx}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                        selected
                          ? 'border-primary-500 bg-primary-50 text-primary-800'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-sm">{optionText}</span>
                    </button>
                  );
                })}
              </div>

              {!timedMode && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  Practice mode — take your time
                </div>
              )}
            </motion.div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setCurrent(Math.max(0, current - 1))}
                disabled={current === 0}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const next = prompt('Go to question number:');
                    const n = parseInt(next);
                    if (n >= 1 && n <= total) setCurrent(n - 1);
                  }}
                  className="btn-secondary text-xs px-3"
                >
                  Jump to...
                </button>

                {current < total - 1 ? (
                  <button
                    onClick={() => setCurrent(current + 1)}
                    className="btn-primary text-sm"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="btn-primary text-sm bg-green-600 hover:bg-green-700 border-green-600"
                  >
                    {submitting ? 'Submitting...' : 'Submit Exam'}
                  </button>
                )}
              </div>
            </div>

            {/* Question nav grid */}
            <div className="card">
              <p className="text-xs text-gray-400 mb-2">Question Navigator</p>
              <div className="flex flex-wrap gap-1.5">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrent(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all ${
                      i === current
                        ? 'bg-primary-500 text-white'
                        : answers[q.id]
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-50 text-gray-400 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // ── Submitting ───────────────────────────────────────────────
  if (step === 'submitting') {
    return (
      <ProtectedRoute>
        <Head><title>Submitting — QSToolkit</title></Head>
        <Layout title="Submitting...">
          <div className="max-w-md text-center py-16">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Scoring your answers...</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  if (step === 'results') {
    const score = result?.score || result?.percentage || 0;
    const passed = result?.passed;
    const correct = result?.correct_count || 0;
    const totalQ = result?.total_questions || total;

    return (
      <ProtectedRoute>
        <Head><title>Results — QSToolkit</title></Head>
        <Layout title="Exam Results">
          <div className="max-w-2xl space-y-6">
            <Link href={`/exam-prep/students/${universityId}`} className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
              &larr; Back to courses
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card text-center py-8"
            >
              <p className="text-5xl mb-4">{passed ? '🎉' : '📊'}</p>
              <h2 className="font-display text-2xl font-bold text-primary-800 mb-2">
                {passed ? 'Congratulations!' : 'Keep Practicing'}
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                {selectedExam?.exam_name}
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-primary-700">{score}%</p>
                  <p className="text-xs text-gray-400 mt-1">Score</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-primary-700">{correct}/{totalQ}</p>
                  <p className="text-xs text-gray-400 mt-1">Correct</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                    {passed ? 'Pass' : 'Fail'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Result</p>
                </div>
              </div>

              {result?.passing_score && (
                <p className="text-sm text-gray-500 mb-6">
                  Pass mark: {result.passing_score}%
                </p>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setStep('select');
                    setSelectedExam(null);
                    setResult(null);
                    setAnswers({});
                    setCurrent(0);
                  }}
                  className="btn-secondary text-sm"
                >
                  Try Another Exam
                </button>
                <Link
                  href={`/exam-prep/students/${universityId}`}
                  className="btn-primary text-sm"
                >
                  Back to Courses
                </Link>
              </div>
            </motion.div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return null;
}
