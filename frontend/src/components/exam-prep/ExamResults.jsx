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
  const timeTaken = attempt.time_spent_seconds || attempt.time_taken || 0;
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

        {(attempt.detailed_results || attempt.questions) && (attempt.detailed_results || attempt.questions).length > 0 ? (
          <div className="space-y-4">
            {(attempt.detailed_results || attempt.questions).map((q, i) => {
              const userAnswer = q.user_answer ?? q.selected_option;
              const correctAnswer = q.correct_answer ?? q.correct_option;
              const isCorrect = q.is_correct !== undefined ? q.is_correct : userAnswer === correctAnswer;
              const questionType = q.question_type || 'mcq';

              // Normalize answers to letter index (0=A, 1=B, etc.) for option highlighting
              const toLetterIdx = (val) => {
                if (val === null || val === undefined) return -1;
                const s = String(val).trim();
                if (!s) return -1;
                if (/^[A-F]$/i.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
                const idx = parseInt(s, 10);
                if (!isNaN(idx) && idx >= 0 && idx < 6) return idx;
                const match = s.match(/^\(?\[?\s*([A-F])\s*\)?\]?[.:\s)/]/i);
                if (match) return match[1].toUpperCase().charCodeAt(0) - 65;
                return -1;
              };
              const userIdx = toLetterIdx(userAnswer);
              const correctIdx = toLetterIdx(correctAnswer);

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

                  {/* Options or text answer */}
                  <div className="ml-9 space-y-1.5 mb-3">
                    {questionType === 'mcq' || questionType === 'true_false' || (q.options && q.options.length > 0) ? (
                      (q.options || []).map((opt, idx) => {
                        const isUserAnswer = userIdx === idx;
                        const isCorrectOpt = correctIdx === idx;
                        let optClass = 'bg-white border-gray-200';
                        if (isCorrectOpt) optClass = 'bg-emerald-100 border-emerald-300 text-emerald-800';
                        else if (isUserAnswer && !isCorrect) optClass = 'bg-red-100 border-red-300 text-red-800';
                        const optionText = opt?.replace(/^[A-F][.):\s]+\s*/i, '').trim() || opt;

                        return (
                          <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${optClass}`}>
                            <span className="font-bold flex-shrink-0">{OPTION_LETTERS[idx]}.</span>
                            <span className="flex-1">{optionText}</span>
                            {isCorrectOpt && <span className="text-emerald-600 font-bold">✓ Correct</span>}
                            {isUserAnswer && !isCorrectOpt && <span className="text-red-600 font-bold">✗ Your answer</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg border text-xs ${!isCorrect ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <p className="font-bold text-gray-500 mb-1">Your answer:</p>
                          <p className={!isCorrect ? 'text-red-700' : 'text-emerald-800'}>{userAnswer || '(no answer)'}</p>
                          {!isCorrect && <span className="text-red-600 font-bold">✗</span>}
                        </div>
                        {!isCorrect && q.correct_answer && (
                          <div className="p-3 rounded-lg border text-xs bg-emerald-50 border-emerald-200">
                            <p className="font-bold text-emerald-600 mb-1">Model answer:</p>
                            <p className="text-emerald-800">{q.correct_answer}</p>
                          </div>
                        )}
                        {q.ai_feedback && (
                          <div className="p-3 rounded-lg border text-xs bg-blue-50 border-blue-200">
                            <p className="font-bold text-blue-600 mb-1">AI Assessment:</p>
                            <p className="text-blue-800">{q.ai_feedback}</p>
                            {q.marks_earned !== undefined && (
                              <p className="text-blue-600 mt-1 font-medium">Score: {q.marks_earned}/{q.marks_possible}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-9 flex gap-2">
                    <button
                      onClick={() => setShowExplanation(q)}
                      className="text-xs text-primary-600 hover:underline font-medium"
                    >
                      📖 View Explanation
                    </button>
                    {questionType === 'mcq' && (
                      <button
                        onClick={() => {
                          const event = new CustomEvent('qst-ai-ask', {
                            detail: `Explain why the correct answer to this question is "${q.options?.[correctIdx]}" and not "${q.options?.[userIdx]}": ${q.question_text || q.question}`
                          });
                          window.dispatchEvent(event);
                        }}
                        className="text-xs text-gold-600 hover:underline font-medium"
                      >
                        🤖 Ask Dr. Q
                      </button>
                    )}
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
          examId={attempt?.exam_id}
          onClose={() => setShowExplanation(null)}
        />
      )}
    </div>
  );
}
