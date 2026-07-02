import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { examAPI } from '../../services/api';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ExamInterface({ examId, questions: initialQuestions, timeLimit, onComplete }) {
  const [questions] = useState(initialQuestions || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef(null);

  const handleSubmitRef = useRef(null);

  // Timer countdown
  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmitRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [submitted]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleTextAnswer = (questionId, text) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }));
  };

  const toggleFlag = (questionId) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = useCallback(async (autoTimeout = false) => {
    if (submitting || submitted) return;
    if (!autoTimeout) {
      const unanswered = questions.filter(q => {
        const val = answers[q.id];
        return val === undefined || val === '' || val === null;
      }).length;
      if (unanswered > 0) {
        setShowSubmitConfirm(true);
        return;
      }
    }

    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, value]) => {
          const q = questions.find(qq => qq.id === questionId);
          const qType = q?.question_type || 'mcq';
          // MCQ: send as selected_option (index); text: send as answer (string)
          if (qType === 'mcq' || qType === 'true_false' || (!qType && q?.options?.length)) {
            return { question_id: questionId, selected_option: value };
          }
          return { question_id: questionId, answer: value };
        }),
        time_taken: timeLimit * 60 - timeRemaining
      };
      const res = await examAPI.submitExam(examId, payload);
      setSubmitted(true);
      if (onComplete) onComplete(res.data);
      if (autoTimeout) toast.success('Time\'s up! Your exam has been submitted.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit exam');
    } finally {
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  }, [answers, questions, examId, timeLimit, timeRemaining, submitting, submitted, onComplete]);

  // Keep ref in sync with latest handleSubmit (timer uses ref to avoid stale closure)
  useEffect(() => { handleSubmitRef.current = handleSubmit; });

  const question = questions[currentIndex];
  const answeredCount = Object.entries(answers).filter(([id, val]) => val !== undefined && val !== '' && val !== null).length;
  const isTimeLow = timeRemaining < 300;

  if (!question) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-display font-bold text-primary-800 text-sm hidden sm:block">Exam in Progress</h2>
          <span className="text-xs text-gray-500">
            Q {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-mono text-lg font-bold ${isTimeLow ? 'text-red-600 animate-pulse' : 'text-primary-700'}`}>
            ⏱️ {formatTime(timeRemaining)}
          </div>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="btn-primary text-xs px-4 py-2"
          >
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="max-w-2xl"
            >
              {/* Question text */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                    Q{currentIndex + 1}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">
                    {(question.question_type || 'mcq').replace('_', ' ')}
                  </span>
                  {question.marks && (
                    <span className="text-xs text-gray-400">[{question.marks} mark{question.marks > 1 ? 's' : ''}]</span>
                  )}
                  {flagged.has(question.id) && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">🚩 Flagged</span>
                  )}
                </div>
                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{(question.question_text || question.question || '').replace(/^\d+\.\s*/, '')}</p>
              </div>

              {/* Render input based on question type */}
              {(question.question_type === 'mcq' || question.question_type === 'true_false') || (!question.question_type && question.options?.length > 0) ? (
                /* MCQ / True-False: Option buttons */
                <div className="space-y-2">
                  {(question.options || []).map((opt, idx) => {
                    const selected = answers[question.id] === idx;
                    const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(question.id, idx)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                          selected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          selected ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {OPTION_LETTERS[idx]}
                        </span>
                        <span className="text-sm text-gray-800 leading-relaxed">{optionText}</span>
                      </button>
                    );
                  })}
                </div>
              ) : question.question_type === 'short_answer' ? (
                /* Short answer: single-line text input */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={answers[question.id] || ''}
                    onChange={e => handleTextAnswer(question.id, e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none text-sm"
                  />
                  {question.max_words && (
                    <p className="text-xs text-gray-400">Max {question.max_words} words</p>
                  )}
                </div>
              ) : (
                /* Long answer, essay, scenario, mock_interview: textarea */
                <div className="space-y-3">
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={e => handleTextAnswer(question.id, e.target.value)}
                    placeholder={
                      question.question_type === 'mock_interview'
                        ? 'Type your interview response...'
                        : question.question_type === 'essay'
                          ? 'Write your essay response...'
                          : 'Type your detailed answer...'
                    }
                    rows={8}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none text-sm resize-y"
                  />
                  <div className="flex items-center justify-between">
                    {question.max_words && (
                      <p className="text-xs text-gray-400">Max {question.max_words} words</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {(answers[question.id] || '').split(/\s+/).filter(Boolean).length} words
                    </p>
                  </div>
                </div>
              )}

              {/* Flag button */}
              <button
                onClick={() => toggleFlag(question.id)}
                className={`mt-4 text-xs font-medium px-4 py-2 rounded-lg border transition-all ${
                  flagged.has(question.id)
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {flagged.has(question.id) ? '🚩 Unflag Question' : '🚩 Flag for Review'}
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Question palette (sidebar) */}
        <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto p-4 hidden lg:block flex-shrink-0">
          <h3 className="font-display font-bold text-primary-800 text-xs mb-3">Question Palette</h3>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {questions.map((q, i) => {
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-10 h-10 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                    isCurrent
                      ? 'ring-2 ring-primary-500 bg-primary-700 text-white'
                      : isFlagged
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : isAnswered
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" />
              <span className="text-gray-600">Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
              <span className="text-gray-600">Unanswered ({questions.length - answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
              <span className="text-gray-600">Flagged ({flagged.size})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden flex-shrink-0">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="btn-secondary text-xs px-4 py-2 disabled:opacity-40"
        >
          &larr; Previous
        </button>
        <span className="text-xs text-gray-500">{currentIndex + 1} / {questions.length}</span>
        <button
          onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
          disabled={currentIndex === questions.length - 1}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
        >
          Next &rarr;
        </button>
      </div>

      {/* Submit confirmation modal */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => !submitting && setShowSubmitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-display text-xl font-bold text-primary-800 mb-2">Submit Exam?</h3>
              <p className="text-sm text-gray-600 mb-2">
                You have <strong className="text-red-600">{questions.length - answeredCount} unanswered</strong> question{questions.length - answeredCount !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                You still have <strong>{formatTime(timeRemaining)}</strong> remaining.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowSubmitConfirm(false)} disabled={submitting} className="btn-secondary text-sm">
                  Go Back
                </button>
                <button onClick={() => handleSubmit(false)} disabled={submitting} className="btn-primary text-sm">
                  {submitting ? 'Submitting...' : 'Submit Anyway'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
