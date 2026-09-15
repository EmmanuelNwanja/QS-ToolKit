import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Layout from '../../../components/Layout';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { academyAPI } from '../../../services/api';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export default function LessonViewer() {
  const router = useRouter();
  const { id } = router.query;
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  useEffect(() => {
    if (!id) return;
    academyAPI.getLesson(id)
      .then(res => {
        setLesson(res.data.lesson);
        setProgress(res.data.progress);
        if (res.data.progress?.status === 'completed') setQuizSubmitted(true);
      })
      .catch(() => toast.error('Failed to load lesson'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleQuizSubmit = () => {
    const questions = lesson.content?.practice_questions || [];
    if (!questions.length) return;
    let correct = 0;
    questions.forEach((q, i) => {
      const userAnswer = (quizAnswers[i] || '').trim().charAt(0).toUpperCase();
      if (userAnswer === q.correct?.charAt(0)?.toUpperCase()) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await academyAPI.completeLesson(id, { quiz_score: quizScore, time_spent_seconds: 0 });
      toast.success('Lesson completed!');
      setProgress(p => ({ ...p, status: 'completed', quiz_score: quizScore }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark complete');
    } finally { setCompleting(false); }
  };

  if (loading) return <ProtectedRoute><Layout title="Loading..."><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" /></div></Layout></ProtectedRoute>;
  if (!lesson) return <ProtectedRoute><Layout title="Not Found"><div className="card text-center py-12"><p>Lesson not found</p><Link href="/academy/lessons" className="text-purple-600 underline mt-2 inline-block">Back to lessons</Link></div></Layout></ProtectedRoute>;

  const content = lesson.content || {};
  const questions = content.practice_questions || [];

  return (
    <ProtectedRoute>
      <Head><title>{lesson.title} — QS Academy</title></Head>
      <Layout title="">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div {...fadeUp}>
            <Link href="/academy/lessons" className="text-sm text-purple-600 hover:underline mb-2 inline-block">← Back to Lessons</Link>
            <h1 className="font-display font-bold text-2xl text-primary-800">{lesson.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lesson.difficulty === 'advanced' ? 'bg-red-100 text-red-700' : lesson.difficulty === 'intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{lesson.difficulty}</span>
              <span>⏱ {lesson.estimated_minutes || 15} min</span>
              {progress?.status === 'completed' && <span className="text-green-600 font-medium">✓ Completed</span>}
            </div>
          </motion.div>

          {/* Objectives */}
          {content.objectives?.length > 0 && (
            <motion.div {...fadeUp} className="card">
              <h3 className="font-semibold text-primary-800 mb-3">🎯 Learning Objectives</h3>
              <ul className="space-y-2">
                {content.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-purple-500 mt-0.5">•</span>{obj}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Content Sections */}
          {content.sections?.map((section, i) => (
            <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }} className="card">
              <h3 className="font-semibold text-primary-800 mb-3">{section.heading}</h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{section.body}</div>
              {section.examples?.length > 0 && (
                <div className="mt-4 bg-purple-50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-purple-700 uppercase mb-2">Examples</h4>
                  {section.examples.map((ex, j) => (
                    <p key={j} className="text-sm text-slate-600 mb-1">💡 {ex}</p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {/* Practice Quiz */}
          {questions.length > 0 && (
            <motion.div {...fadeUp} className="card border-2 border-purple-200">
              <h3 className="font-semibold text-primary-800 mb-4">📝 Practice Questions</h3>
              <div className="space-y-6">
                {questions.map((q, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">{i + 1}. {q.question}</p>
                    <div className="space-y-1">
                      {q.options?.map((opt, j) => {
                        const letter = opt.charAt(0).toUpperCase();
                        const isSelected = quizAnswers[i] === letter;
                        const isCorrect = q.correct?.charAt(0)?.toUpperCase() === letter;
                        let optClass = 'border-slate-200 hover:border-purple-300';
                        if (quizSubmitted && isCorrect) optClass = 'border-green-500 bg-green-50';
                        else if (quizSubmitted && isSelected && !isCorrect) optClass = 'border-red-500 bg-red-50';
                        else if (isSelected) optClass = 'border-purple-500 bg-purple-50';

                        return (
                          <button key={j} disabled={quizSubmitted}
                            onClick={() => setQuizAnswers(a => ({ ...a, [i]: letter }))}
                            className={`block w-full text-left text-sm p-2 rounded-lg border transition-colors ${optClass}`}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && q.explanation && (
                      <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">💡 {q.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
              {!quizSubmitted && (
                <button onClick={handleQuizSubmit} className="btn-primary mt-4 w-full">Submit Answers</button>
              )}
              {quizSubmitted && quizScore !== null && (
                <div className={`mt-4 p-4 rounded-lg text-center ${quizScore >= 70 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  <p className="text-2xl font-bold">{quizScore}%</p>
                  <p className="text-sm">{quizScore >= 70 ? 'Great job!' : 'Keep studying, you got this!'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Takeaways */}
          {content.takeaways?.length > 0 && (
            <motion.div {...fadeUp} className="card bg-green-50 border-green-200">
              <h3 className="font-semibold text-green-800 mb-3">✅ Key Takeaways</h3>
              <ul className="space-y-2">
                {content.takeaways.map((t, i) => (
                  <li key={i} className="text-sm text-green-700">• {t}</li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Complete Button */}
          {progress?.status !== 'completed' && (
            <motion.div {...fadeUp}>
              <button onClick={handleComplete} disabled={completing || !quizSubmitted}
                className="btn-primary w-full py-3 disabled:opacity-50">
                {completing ? 'Marking Complete...' : 'Mark Lesson as Complete'}
              </button>
            </motion.div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
