import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const RED_ZONE = 2 * 60;

export default function ContestPage() {
  const router = useRouter();
  const { id } = router.query;
  const [contest, setContest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await academyAPI.getContests({});
        const found = (res.data.contests || []).find((c) => String(c.id) === String(id));
        if (found) {
          setContest(found);
          if (found.status === 'in_progress' && found.questions) {
            setQuestions(found.questions);
            setTimeLeft(found.time_remaining || found.time_limit * 60);
            setStarted(true);
          }
        }
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!started || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, submitted]);

  const selectAnswer = (qIdx, option) => {
    setAnswers((a) => ({ ...a, [qIdx]: option }));
  };

  const handleSubmit = useCallback(async () => {
    clearInterval(timerRef.current);
    setConfirmSubmit(false);
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([qIdx, answer]) => ({
        question_index: Number(qIdx),
        answer,
      }));
      const res = await academyAPI.submitContest(id, { answers: payload });
      setResults(res.data);
      setSubmitted(true);
    } catch {
      toast.error('Submission failed. Please try again.');
      setSubmitting(false);
    }
  }, [answers, id]);

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Contest">
          <div className="max-w-3xl space-y-4">
            <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!contest) {
    return (
      <ProtectedRoute>
        <Layout title="Contest Not Found">
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">Contest not found.</p>
            <Link href="/academy/arena" className="btn-primary mt-4 inline-flex text-sm">Back to Arena</Link>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (submitted && results) {
    return (
      <ProtectedRoute>
        <Head><title>Contest Results — QS Academy</title></Head>
        <Layout title="Contest Results">
          <div className="max-w-3xl mx-auto space-y-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card text-center py-10">
              <div className="text-5xl mb-4">{results.won ? '🏆' : results.draw === true ? '🤝' : '📊'}</div>
              <h2 className="font-display text-3xl font-bold text-primary-800 mb-2">
                {results.won ? 'You Won!' : results.draw === true ? "It's a Draw!" : 'Contest Complete'}
              </h2>
              <p className="text-5xl font-bold text-primary-700 my-4">{results.score}%</p>
              <p className="text-sm text-gray-500">{results.correct_count} / {results.total} correct</p>

              {results.points_earned !== undefined && (
                <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mt-6 max-w-sm mx-auto">
                  <p className="text-xs text-gold-700 uppercase tracking-wide mb-1">Points Earned</p>
                  <p className="text-2xl font-bold text-gold-700">+{results.points_earned} 🪙</p>
                </div>
              )}

              {results.opponent_result && (
                <div className="mt-4 text-sm text-gray-500">
                  <p>Opponent scored: {results.opponent_result.score}%</p>
                </div>
              )}
            </motion.div>

            {/* Breakdown */}
            {results.breakdown && results.breakdown.length > 0 && (
              <div className="card">
                <h3 className="section-title mb-3">Question Breakdown</h3>
                <div className="space-y-2">
                  {results.breakdown.map((b, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${b.correct ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${b.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {b.correct ? '✓' : '✗'}
                      </span>
                      <p className="text-sm text-gray-700 flex-1 truncate">{b.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Link href="/academy/arena" className="btn-primary px-6 py-2 text-sm">Back to Arena</Link>
              <Link href="/academy/analytics" className="btn-secondary px-6 py-2 text-sm">View Analytics</Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const q = questions[current];
  const total = questions.length;
  const isRed = timeLeft <= RED_ZONE;

  return (
    <ProtectedRoute>
      <Head><title>{contest.topic} — QS Arena</title></Head>
      <Layout title={contest.topic}>
        <div className="max-w-3xl space-y-4">
          {/* Contest header */}
          <div className="card flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">{contest.topic}</h2>
              <p className="text-xs text-gray-500">Question {current + 1} of {total}</p>
            </div>
            <div className={`text-2xl font-bold font-mono px-4 py-2 rounded-xl ${isRed ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-primary-50 text-primary-700'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2.5 flex-1 rounded-full transition-all ${
                  i === current ? 'bg-primary-600 scale-y-125' :
                  answers[i] !== undefined ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Question */}
          <div className="card min-h-[300px]">
            {q ? (
              <AnimatePresence mode="wait">
                <motion.div key={current} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <p className="text-base font-medium text-gray-900 mb-5">{q.question}</p>
                  <div className="space-y-2">
                    {(q.options || []).map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => selectAnswer(current, opt)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm transition-all ${
                          answers[current] === opt
                            ? 'border-primary-500 bg-primary-50 text-primary-800 font-medium'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span className="mr-2 font-semibold text-gray-400">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-12 text-gray-400">Loading question...</div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn-secondary px-5 py-2 text-sm disabled:opacity-40">
              ← Previous
            </button>
            <div className="flex gap-2">
              {current < total - 1 ? (
                <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary px-5 py-2 text-sm">Next →</button>
              ) : (
                <button onClick={() => setConfirmSubmit(true)} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
                  Submit Contest
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Confirm dialog */}
        {confirmSubmit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center">
              <p className="font-semibold text-gray-900 mb-2">Submit your answers?</p>
              <p className="text-sm text-gray-500 mb-4">
                {Object.keys(answers).length} of {total} questions answered.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setConfirmSubmit(false)} className="btn-secondary px-4 py-2 text-sm">Review</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-4 py-2 text-sm">
                  {submitting ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
