import { useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { examAPI } from '../../services/api';
import toast from 'react-hot-toast';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function PracticeExam({ questions, answersMeta, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const handleAnswer = (qIdx, optionIdx) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`)) {
      return;
    }

    let correctCount = 0;
    const topicStats = {};
    const detailed = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const meta = answersMeta[i];
      const userLetter = answers[i] !== undefined ? OPTION_LETTERS[answers[i]] : '';
      const correctLetter = meta?.correct_answer || '';
      const isCorrect = userLetter === correctLetter;
      if (isCorrect) correctCount++;

      const topic = q.topic || meta?.topic || 'general';
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
      topicStats[topic].total++;
      if (isCorrect) topicStats[topic].correct++;

      detailed.push({
        question: q.question,
        options: q.options,
        user_answer: userLetter,
        correct_answer: correctLetter,
        is_correct: isCorrect,
        explanation: meta?.explanation || '',
        topic,
        difficulty: q.difficulty
      });
    }

    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    onComplete({ percentage, correctCount, total: questions.length, topicStats, detailed });
  };

  const q = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-primary-800">Personalized Practice Exam</h2>
          <p className="text-xs text-gray-500">Question {currentIndex + 1} of {questions.length} · {answeredCount} answered</p>
        </div>
        <button onClick={handleSubmit} className="btn-primary text-sm px-5 py-2">
          Submit Practice
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 flex-1 rounded-full transition-all ${
              i === currentIndex ? 'bg-primary-600 scale-y-125' :
              answers[i] !== undefined ? 'bg-emerald-400' : 'bg-gray-200'
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
            {q.topic && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.topic}</span>
            )}
            {q.difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>{q.difficulty}</span>
            )}
          </div>
          <p className="text-sm text-gray-900 leading-relaxed mb-5">{(q.question || '').replace(/^\d+\.\s*/, '')}</p>
          <div className="space-y-2">
            {(q.options || []).map((opt, idx) => {
              const selected = answers[currentIndex] === idx;
              const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(currentIndex, idx)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                    selected
                      ? 'border-primary-500 bg-primary-50 text-primary-800 font-medium'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-gray-500 mr-2">{OPTION_LETTERS[idx]}.</span>
                  {optionText}
                </button>
              );
            })}
          </div>
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
          <button onClick={handleSubmit} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
            Submit Practice
          </button>
        )}
      </div>
    </div>
  );
}

function PracticeResults({ result, onRetry }) {
  const { percentage, correctCount, total, topicStats, detailed } = result;
  const passed = percentage >= 60;

  const topicList = Object.entries(topicStats)
    .map(([topic, s]) => ({
      topic,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      correct: s.correct,
      total: s.total
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div className="space-y-6">
      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card text-center ${
          passed
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
        }`}
      >
        <span className="text-5xl mb-4 block">{passed ? '🌟' : '📚'}</span>
        <h2 className="font-display text-2xl font-bold text-primary-800 mb-1">
          {passed ? 'Great Work!' : 'Keep Practicing!'}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {passed ? 'You have a solid grasp of these topics.' : 'Review the weak areas below to improve.'}
        </p>
        <div className="grid grid-cols-2 gap-6 max-w-xs mx-auto">
          <div>
            <p className="text-3xl font-bold font-display text-primary-800">{percentage}%</p>
            <p className="text-xs text-gray-500">Score</p>
          </div>
          <div>
            <p className="text-3xl font-bold font-display text-primary-800">{correctCount}/{total}</p>
            <p className="text-xs text-gray-500">Correct</p>
          </div>
        </div>
      </motion.div>

      {/* Topic breakdown */}
      <div className="card">
        <h3 className="font-display font-bold text-primary-800 text-sm mb-4">Topic Performance</h3>
        <div className="space-y-3">
          {topicList.map(t => (
            <div key={t.topic} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 truncate">{t.topic}</span>
                  <span className={`text-xs font-bold ${t.accuracy >= 70 ? 'text-emerald-600' : t.accuracy >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {t.accuracy}% ({t.correct}/{t.total})
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      t.accuracy >= 70 ? 'bg-emerald-500' : t.accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${t.accuracy}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Question review */}
      <div className="card">
        <h3 className="font-display font-bold text-primary-800 text-sm mb-4">Question Review</h3>
        <div className="space-y-4">
          {detailed.map((d, i) => (
            <div key={i} className={`p-4 rounded-xl border ${d.is_correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.is_correct ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                  Q{i + 1}
                </span>
                <span className="text-xs text-gray-500">{d.topic}</span>
                {!d.is_correct && (
                  <span className="text-xs text-red-600 ml-auto">
                    Your answer: {d.user_answer || '—'} · Correct: {d.correct_answer}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 mb-2">{d.question}</p>
              {d.explanation && (
                <p className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-gray-100">
                  <strong className="text-primary-700">Explanation:</strong> {d.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button onClick={onRetry} className="btn-primary text-sm px-6 py-2.5">
          Generate New Practice Exam
        </button>
        <Link href="/exam-prep" className="btn-secondary text-sm px-6 py-2.5">
          Back to Exam Prep
        </Link>
      </div>
    </div>
  );
}

export default function PracticeExamPage() {
  const [phase, setPhase] = useState('idle'); // idle | generating | ready | results
  const [questions, setQuestions] = useState([]);
  const [answersMeta, setAnswersMeta] = useState([]);
  const [result, setResult] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);

  const generate = useCallback(async () => {
    setPhase('generating');
    try {
      const res = await examAPI.generatePractice({ question_count: 10 });
      const data = res.data;
      setQuestions(data.questions || []);
      setAnswersMeta(data._answers || []);
      setWeakTopics(data.weak_topics || []);
      setPhase('ready');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate practice exam');
      setPhase('idle');
    }
  }, []);

  const handleComplete = (r) => {
    setResult(r);
    setPhase('results');
  };

  const handleRetry = () => {
    setPhase('idle');
    setResult(null);
    setQuestions([]);
    setAnswersMeta([]);
    generate();
  };

  return (
    <ProtectedRoute>
      <Head><title>Practice Exam — QSToolkit</title></Head>
      <Layout title="📚 Personalized Practice">
        <div className="max-w-3xl space-y-6">
          <Link href="/exam-prep" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
            &larr; Back to Exam Prep
          </Link>

          {/* Idle state — show generate button */}
          {phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card text-center py-10"
            >
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🎯</span>
              </div>
              <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Personalized Practice Exam</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                Dr. Q will analyze your past exam performance and generate targeted questions. If you have past exams, weak areas will be prioritized.
              </p>
              <button onClick={generate} className="btn-primary text-base px-8 py-3">
                Generate Practice Exam
              </button>
            </motion.div>
          )}

          {/* Generating state */}
          {phase === 'generating' && (
            <div className="card text-center py-10">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <motion.span
                  className="text-4xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🧠
                </motion.span>
              </div>
              <h2 className="font-display text-xl font-bold text-primary-800 mb-2">Generating Your Practice Exam</h2>
              <p className="text-sm text-gray-500 mb-6">Dr. Q is preparing your targeted questions...</p>
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
            </div>
          )}

          {/* Weak topics indicator */}
          {phase === 'ready' && weakTopics.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <strong>Weak areas targeted:</strong> {weakTopics.join(', ')}
            </div>
          )}

          {/* Exam in progress */}
          {phase === 'ready' && questions.length > 0 && (
            <PracticeExam
              questions={questions}
              answersMeta={answersMeta}
              onComplete={handleComplete}
            />
          )}

          {/* Results */}
          {phase === 'results' && result && (
            <PracticeResults result={result} onRetry={handleRetry} />
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
