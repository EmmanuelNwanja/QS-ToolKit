import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ExplanationModal from './ExplanationModal';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ExamResults({ attempt, onBack: _onBack }) {
  const [showExplanation, setShowExplanation] = useState(null);

  if (!attempt) return null;

  const score = attempt.score || 0;
  const passed = attempt.passed;
  const totalQuestions = attempt.total_questions || attempt.questions?.length || 0;
  const correctCount = attempt.correct_count || Math.round((score / 100) * totalQuestions);
  const timeTaken = attempt.time_taken || 0;
  const timeMinutes = Math.floor(timeTaken / 60);
  const timeSeconds = timeTaken % 60;

  return (
    <div className="space-y-6">
      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card text-center ${
          passed
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
        }`}
      >
        <div className="mb-4">
          <span className="text-5xl">{passed ? '🎉' : '😔'}</span>
        </div>
        <h2 className="font-display text-3xl font-bold text-primary-800 mb-1">
          {passed ? 'Congratulations!' : 'Keep Practicing!'}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {passed ? 'You passed the exam!' : 'You didn\'t pass this time. Review the explanations below to improve.'}
        </p>

        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
          <div>
            <p className="text-3xl font-bold font-display text-primary-800">{score}%</p>
            <p className="text-xs text-gray-500">Your Score</p>
          </div>
          <div>
            <p className="text-3xl font-bold font-display text-primary-800">{correctCount}/{totalQuestions}</p>
            <p className="text-xs text-gray-500">Correct</p>
          </div>
          <div>
            <p className="text-3xl font-bold font-display text-primary-800">{timeMinutes}:{String(timeSeconds).padStart(2, '0')}</p>
            <p className="text-xs text-gray-500">Time Taken</p>
          </div>
        </div>

        {attempt.pass_mark > 0 && (
          <p className="text-xs text-gray-500 mt-4">
            Pass mark: {attempt.pass_mark}% · You needed {attempt.pass_mark}% to pass
          </p>
        )}
      </motion.div>

      {/* Question breakdown */}
      <div className="card">
        <h3 className="font-display font-bold text-primary-800 mb-4">Question-by-Question Breakdown</h3>

        {attempt.questions && attempt.questions.length > 0 ? (
          <div className="space-y-4">
            {attempt.questions.map((q, i) => {
              const userAnswer = q.user_answer ?? q.selected_option;
              const correctAnswer = q.correct_answer ?? q.correct_option;
              const isCorrect = userAnswer === correctAnswer;

              return (
                <motion.div
                  key={q.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`p-4 rounded-xl border ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isCorrect ? '✓' : '✗'}
                    </span>
                    <p className="text-sm text-gray-900 leading-relaxed flex-1">
                      <span className="font-mono text-xs text-gray-400 mr-2">Q{i + 1}</span>
                      {(q.question_text || q.question || '').replace(/^\d+\.\s*/, '')}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="ml-9 space-y-1.5 mb-3">
                    {(q.options || []).map((opt, idx) => {
                      const isUserAnswer = userAnswer === idx;
                      const isCorrectOpt = correctAnswer === idx;
                      let optClass = 'bg-white border-gray-200';
                      if (isCorrectOpt) optClass = 'bg-emerald-100 border-emerald-300 text-emerald-800';
                      else if (isUserAnswer && !isCorrect) optClass = 'bg-red-100 border-red-300 text-red-800';
                      // Strip existing letter prefix to avoid double display
                      const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;

                      return (
                        <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${optClass}`}>
                          <span className="font-bold flex-shrink-0">{OPTION_LETTERS[idx]}.</span>
                          <span className="flex-1">{optionText}</span>
                          {isCorrectOpt && <span className="text-emerald-600 font-bold">✓ Correct</span>}
                          {isUserAnswer && !isCorrectOpt && <span className="text-red-600 font-bold">✗ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="ml-9 flex gap-2">
                    <button
                      onClick={() => setShowExplanation(q)}
                      className="text-xs text-primary-600 hover:underline font-medium"
                    >
                      📖 View Explanation
                    </button>
                    <button
                      onClick={() => {
                        const event = new CustomEvent('qst-ai-ask', {
                          detail: `Explain why the correct answer to this question is "${q.options?.[correctAnswer]}" and not "${q.options?.[userAnswer]}": ${q.question_text || q.question}`
                        });
                        window.dispatchEvent(event);
                      }}
                      className="text-xs text-gold-600 hover:underline font-medium"
                    >
                      🤖 Ask Dr. Q
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            Detailed question breakdown is available after completing the exam.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Link href="/exam-prep" className="btn-secondary text-sm">
          ← Back to Dashboard
        </Link>
        <Link href={`/exam-prep/professional/${attempt.exam_slug || ''}`} className="btn-primary text-sm">
          🔄 Retake Exam
        </Link>
      </div>

      {/* Explanation modal */}
      {showExplanation && (
        <ExplanationModal
          question={showExplanation}
          onClose={() => setShowExplanation(null)}
        />
      )}
    </div>
  );
}
