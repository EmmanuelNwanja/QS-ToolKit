import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { academyAPI } from '../../services/api';
import DrQThinkingAnimation from './DrQThinkingAnimation';

const TOTAL_TIME = 15 * 60;
const RED_ZONE = 2 * 60;

export default function AdmissionTestModal({ open, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [curating, setCurating] = useState(false);
  const [result, setResult] = useState(null);
  const [drQ, setDrQ] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const timerRef = useRef(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setCurating(true);
      setLoading(true);
      const res = await academyAPI.startAdmission();
      const data = res.data;
      // If already passed, pass result back immediately (user can retake if they want)
      if (data.passed) {
        onComplete?.({ passed: true, score: data.score });
        return;
      }
      setQuestions(data.questions || []);
      if (data.resumed) {
        toast('Resuming your admission test...', { icon: '📝' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load questions. Please try again.';
      toast.error(msg);
    } finally {
      setCurating(false);
      setLoading(false);
    }
  }, [onComplete]);

  useEffect(() => {
    if (open) {
      fetchQuestions();
      setTimeLeft(TOTAL_TIME);
      setCurrent(0);
      setAnswers({});
      setSubmitted(false);
      setResult(null);
      setDrQ(false);
    }
  }, [open, fetchQuestions]);

  // Timer only starts after questions are loaded (not during curating)
  useEffect(() => {
    if (!open || submitted || drQ || loading || curating || questions.length === 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (handleSubmitRef.current) handleSubmitRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [open, submitted, drQ, loading, curating, questions.length]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = (qIdx, option) => {
    // Store the full option text (e.g., "B. 10 blocks/m²") for scoring
    setAnswers((a) => ({ ...a, [qIdx]: option }));
  };

  const handleSubmitRef = useRef(null);

  const handleSubmit = useCallback(async () => {
    clearInterval(timerRef.current);
    setConfirmSubmit(false);
    setDrQ(true);
    try {
      // Build payload with question_index as number and full answer text
      const payload = Object.entries(answers)
        .filter(([qIdx]) => qIdx !== undefined && qIdx !== null)
        .map(([qIdx, answer]) => ({
          question_index: Number(qIdx),
          answer: String(answer || ''),
        }));
      const res = await academyAPI.submitAdmission({ answers: payload });
      setResult(res.data);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
      setDrQ(false);
    }
  }, [answers]);

  // Keep ref in sync for timer
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  if (!open) return null;

  if (drQ && !submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <DrQThinkingAnimation message="Evaluating your responses..." />
        </div>
      </div>
    );
  }

  if (submitted && result) {
    const isExcellent = result.score >= 80;
    const isGood = result.score >= 60;
    const isLearning = result.score < 60;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center"
        >
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{isExcellent ? '🌟' : isGood ? '🎓' : '📚'}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-primary-800 mb-2">
            {isExcellent ? 'Outstanding Performance!' : isGood ? 'Great Job!' : 'Assessment Complete!'}
          </h2>
          <p className="text-4xl font-bold text-primary-700 my-4">{result.score}%</p>
          <p className="text-sm text-gray-500 mb-2">
            You answered {result.correct_count} out of {result.total_questions || result.total} correctly.
          </p>
          {isLearning && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-2">
              📊 Dr. Q has analyzed your responses and created a personalized learning pathway just for you!
            </p>
          )}
          {result.recommended_pathway && (
            <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 my-4">
              <p className="text-xs text-gold-700 uppercase tracking-wide mb-1">Your Personalized Pathway</p>
              <p className="font-semibold text-gold-800">{result.recommended_pathway.name}</p>
              {result.recommended_pathway.focus_area && (
                <p className="text-xs text-gold-600 mt-1">{result.recommended_pathway.focus_area}</p>
              )}
            </div>
          )}
          <button
            onClick={() => onComplete?.(result)}
            className="btn-primary px-8 py-2.5 text-sm mt-4"
          >
            {isLearning ? 'Start Learning Pathway →' : 'Continue to Academy →'}
          </button>
        </motion.div>
      </div>
    );
  }

  // Curating state — show while AI generates questions
  if (curating || (loading && questions.length === 0)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center"
        >
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <motion.span
              className="text-4xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              🧠
            </motion.span>
          </div>
          <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Curating Your Entry Test</h2>
          <p className="text-sm text-gray-500 mb-6">
            Dr. Q is personalizing your admission assessment based on your profile. This may take a moment...
          </p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-primary-400 rounded-full"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
              />
            ))}
          </div>
          <button
            onClick={() => onComplete?.({ passed: false })}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  const q = questions[current];
  const total = questions.length;
  const isRed = timeLeft <= RED_ZONE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-primary-800">QS Admission Test</h2>
            <p className="text-xs text-gray-500">Question {current + 1} of {total || '...'}</p>
          </div>
          <div className={`text-2xl font-bold font-mono ${isRed ? 'text-red-500 animate-pulse' : 'text-primary-700'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i === current ? 'bg-primary-600 scale-y-125' :
                  answers[i] !== undefined ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {q ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-base font-medium text-gray-900 mb-4">{q.question?.replace(/^\d+\.\s*/, '')}</p>
                <div className="space-y-2">
                  {(q.options || []).map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    // Strip existing letter prefix from option if present to avoid double display
                    const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;
                    return (
                      <button
                        key={i}
                        onClick={() => selectAnswer(current, opt)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                          answers[current] === opt
                            ? 'border-primary-500 bg-primary-50 text-primary-800 font-medium'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-semibold text-gray-500 mr-2">{letter}.</span>
                        {optionText}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">No questions available. Please try again later.</p>
              <button onClick={() => onComplete?.({ passed: false })} className="btn-secondary px-4 py-2 text-sm">Close</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-40"
          >
            ← Previous
          </button>
          <div className="flex gap-2">
            {current < total - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                className="btn-primary px-5 py-2 text-sm"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700"
              >
                Submit Test
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Confirm submit dialog */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center">
            <p className="font-semibold text-gray-900 mb-2">Submit your test?</p>
            <p className="text-sm text-gray-500 mb-4">
              {Object.keys(answers).length} of {total} questions answered.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary px-4 py-2 text-sm">
                Review Answers
              </button>
              <button onClick={handleSubmit} className="btn-primary px-4 py-2 text-sm">
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
