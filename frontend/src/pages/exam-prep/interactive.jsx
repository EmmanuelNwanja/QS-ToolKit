import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { examAPI } from '../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

export default function InteractivePractice() {
  const [setup, setSetup] = useState(true);
  const [form, setForm] = useState({ exam_category: '', exam_name: '', topic: '' });
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const handleStart = async () => {
    if (!form.exam_category || !form.exam_name) { toast.error('Fill in category and exam name'); return; }
    setLoading(true);
    try {
      const { data } = await examAPI.startInteractive(form);
      setQuestions(data.questions || []);
      setDifficulty(data.difficulty || 'medium');
      setSetup(false);
      setCurrentIndex(0);
      setScore(0);
      setResults([]);
      setFinished(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start');
    } finally { setLoading(false); }
  };

  const handleAnswer = async (option) => {
    if (answered) return;
    setSelected(option);
    setAnswered(true);

    const q = questions[currentIndex];
    const letter = option.charAt(0).toUpperCase();
    const correctLetter = q.correct?.charAt(0)?.toUpperCase();
    const wasCorrect = letter === correctLetter;

    if (wasCorrect) setScore(s => s + 1);

    setResults(r => [...r, { question: q.question, selected: option, correct: q.options?.find(o => o.charAt(0) === correctLetter), was_correct: wasCorrect, explanation: q.explanation, topic: q.topic }]);

    try {
      await examAPI.submitAnswer({ question_id: q.id, answer: letter, topic: q.topic || form.topic, was_correct: wasCorrect });
    } catch {}

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1);
        setSelected(null);
        setAnswered(false);
      } else {
        setFinished(true);
      }
    }, 1500);
  };

  const q = questions[currentIndex];

  return (
    <ProtectedRoute>
      <Head><title>Interactive Practice — QS Exam Prep</title></Head>
      <Layout title="🎯 Interactive Practice">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Setup */}
          {setup && (
            <motion.div {...fadeUp} className="card">
              <h2 className="font-display font-bold text-xl text-primary-800 mb-4">Start Interactive Practice</h2>
              <p className="text-sm text-slate-500 mb-4">Answer questions one by one with instant feedback. Difficulty adapts to your performance.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Exam Category</label>
                  <select value={form.exam_category} onChange={e => setForm(f => ({ ...f, exam_category: e.target.value }))} className="input w-full">
                    <option value="">Select category</option>
                    <option value="Nigerian Professional">Nigerian Professional</option>
                    <option value="International">International</option>
                    <option value="University">University</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Exam Name</label>
                  <input value={form.exam_name} onChange={e => setForm(f => ({ ...f, exam_name: e.target.value }))} className="input w-full" placeholder="e.g. NIQS Professional Exam" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Topic (optional)</label>
                  <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className="input w-full" placeholder="e.g. Measurement, Contracts, Cost Planning" />
                </div>
              </div>
              <button onClick={handleStart} disabled={loading || !form.exam_category || !form.exam_name} className="btn-primary w-full mt-4">
                {loading ? 'Loading...' : 'Start Practice'}
              </button>
            </motion.div>
          )}

          {/* Question */}
          {!setup && !finished && q && (
            <motion.div {...fadeUp} key={currentIndex} className="space-y-4">
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{currentIndex + 1} / {questions.length}</span>
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[difficulty]}`}>{difficulty}</span>
                <span className="text-sm font-medium text-green-600">{score}/{currentIndex + (answered ? 1 : 0)}</span>
              </div>

              {/* Question card */}
              <div className="card">
                <p className="text-lg font-medium text-slate-800 mb-4">{q.question}</p>
                <div className="space-y-2">
                  {q.options?.map((opt, i) => {
                    const letter = opt.charAt(0);
                    const isSelected = selected === opt;
                    const isCorrect = answered && q.correct?.charAt(0) === letter;
                    const isWrong = answered && isSelected && !isCorrect;
                    let cls = 'border-slate-200 hover:border-purple-300 hover:bg-purple-50';
                    if (isCorrect) cls = 'border-green-500 bg-green-50';
                    else if (isWrong) cls = 'border-red-500 bg-red-50';
                    else if (isSelected) cls = 'border-purple-500 bg-purple-50';

                    return (
                      <button key={i} disabled={answered} onClick={() => handleAnswer(opt)}
                        className={`block w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${cls}`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {answered && q.explanation && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium mb-1">💡 Explanation</p>
                    <p className="text-sm text-blue-700">{q.explanation}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {finished && (
            <motion.div {...fadeUp} className="space-y-4">
              <div className="card text-center py-8">
                <p className="text-5xl mb-3">{score >= questions.length * 0.7 ? '🎉' : '📚'}</p>
                <h2 className="font-display font-bold text-2xl text-primary-800">{score} / {questions.length}</h2>
                <p className="text-lg text-slate-600 mt-1">{Math.round((score / questions.length) * 100)}%</p>
                <p className="text-sm text-slate-500 mt-2">{score >= questions.length * 0.7 ? 'Great performance!' : 'Keep practicing, you\'ll improve!'}</p>
                <div className="flex gap-3 justify-center mt-4">
                  <button onClick={() => { setSetup(true); setForm({ exam_category: '', exam_name: '', topic: '' }); }} className="btn-primary">New Session</button>
                  <Link href="/exam-prep/analytics" className="btn-secondary">View Analytics</Link>
                </div>
              </div>

              {/* Review */}
              <div className="card">
                <h3 className="font-semibold text-primary-800 mb-3">Review Answers</h3>
                <div className="space-y-3">
                  {results.map((r, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${r.was_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-sm font-medium text-slate-800">{i + 1}. {r.question}</p>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span className={r.was_correct ? 'text-green-700' : 'text-red-700'}>Your answer: {r.selected}</span>
                        {!r.was_correct && <span className="text-green-700">Correct: {r.correct}</span>}
                      </div>
                      {r.explanation && <p className="text-xs text-slate-500 mt-1">💡 {r.explanation}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
