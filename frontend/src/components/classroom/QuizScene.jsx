import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Timer({ duration, onTick, running }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          onTick?.(next);
          if (duration && next >= duration) {
            clearInterval(intervalRef.current);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, duration, onTick]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-xs font-mono text-gray-500">
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

export default function QuizScene({ scene, onComplete }) {
  const content = scene?.content || {};
  const questions = content.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState({});

  const handleAnswer = (qIdx, optionIdx) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleShortAnswer = (qIdx, value) => {
    setAnswers(prev => ({ ...prev, [qIdx]: value }));
  };

  const handleSubmit = () => {
    if (submitted) return;
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.type === 'short_answer') {
        const userAns = (answers[i] || '').toLowerCase().trim();
        const correctAns = (q.correct_answer || '').toLowerCase().trim();
        if (userAns === correctAns) correct++;
      } else {
        if (answers[i] === q.correct) correct++;
      }
    });
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    setScore(pct);
    setSubmitted(true);
    onComplete?.({ score: pct, correct, total: questions.length, answers });
  };

  if (questions.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-4xl mb-3">📝</p>
        <p className="text-sm text-gray-500">No questions available yet.</p>
      </div>
    );
  }

  const q = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-primary-800">Quiz</h2>
          <p className="text-xs text-gray-500">
            Q{currentIndex + 1} of {questions.length} · {answeredCount} answered
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Timer running={!submitted} />
          {!submitted && (
            <button onClick={handleSubmit} className="btn-primary text-sm px-5 py-2">
              Submit Quiz
            </button>
          )}
          {submitted && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-800">{score}%</p>
              <p className="text-xs text-gray-500">
                {Object.keys(answers).filter(k => {
                  const q = questions[k];
                  return q?.type === 'short_answer'
                    ? (answers[k] || '').toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()
                    : answers[k] === q?.correct;
                }).length}/{questions.length} correct
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 flex-1 rounded-full transition-all ${
              i === currentIndex ? 'bg-primary-600 scale-y-125' :
              submitted
                ? (answers[i] === questions[i]?.correct || (questions[i]?.type === 'short_answer' && (answers[i] || '').toLowerCase().trim() === (questions[i]?.correct_answer || '').toLowerCase().trim())
                    ? 'bg-emerald-400' : 'bg-red-400')
                : answers[i] !== undefined ? 'bg-emerald-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
              Q{currentIndex + 1}
            </span>
            {q.difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>{q.difficulty}</span>
            )}
          </div>
          <p className="text-sm text-gray-900 leading-relaxed mb-5">{q.question}</p>

          {q.type === 'short_answer' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={answers[currentIndex] || ''}
                onChange={(e) => handleShortAnswer(currentIndex, e.target.value)}
                disabled={submitted}
                placeholder="Type your answer…"
                className="w-full px-4 py-3 rounded-xl border-2 text-sm transition-all border-gray-200 focus:border-primary-500 focus:ring-0 disabled:opacity-60"
              />
              {submitted && (
                <p className="text-xs mt-2">
                  <span className={answers[currentIndex]?.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim() ? 'text-emerald-600' : 'text-red-600'}>
                    {answers[currentIndex]?.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim() ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                  <span className="text-gray-500 ml-2">Answer: {q.correct_answer}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(q.options || []).map((opt, idx) => {
                const selected = answers[currentIndex] === idx;
                const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;
                const isCorrect = idx === q.correct;
                const showResult = submitted && (selected || isCorrect);
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(currentIndex, idx)}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                      showResult
                        ? isCorrect
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : selected
                            ? 'border-red-500 bg-red-50 text-red-800'
                            : 'border-gray-200 bg-white text-gray-700'
                        : selected
                          ? 'border-primary-500 bg-primary-50 text-primary-800 font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-semibold text-gray-500 mr-2">{OPTION_LETTERS[idx]}.</span>
                    {optionText}
                    {showResult && isCorrect && <span className="ml-2 text-emerald-600">✓</span>}
                    {showResult && selected && !isCorrect && <span className="ml-2 text-red-600">✗</span>}
                  </button>
                );
              })}
            </div>
          )}

          {submitted && q.explanation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
              <strong>Explanation:</strong> {q.explanation}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(c => Math.max(0, c - 1))}
          disabled={currentIndex === 0}
          className="btn-secondary text-sm px-4 py-2 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-xs text-gray-500">{currentIndex + 1} / {questions.length}</span>
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(c => c + 1)}
            className="btn-primary text-sm px-4 py-2"
          >
            Next →
          </button>
        ) : (
          !submitted && (
            <button onClick={handleSubmit} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
              Submit Quiz
            </button>
          )
        )}
      </div>
    </div>
  );
}
