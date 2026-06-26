import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from '../MarkdownRenderer';
import { examAPI } from '../../services/api';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ExplanationModal({ question, examId, onClose }) {
  const [drQInput, setDrQInput] = useState('');
  const [showDrQ, setShowDrQ] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const fetchExplanation = useCallback(async () => {
    if (!examId || !question?.question_text) return;
    setLoadingExplanation(true);
    try {
      const res = await examAPI.explainQuestion(examId, {
        question_text: question.question_text || question.question,
        correct_answer: String(question.correct_answer ?? question.correct_option ?? ''),
        user_answer: question.user_answer !== undefined ? String(question.user_answer) : undefined,
      });
      setAiExplanation(res.data?.explanation || '');
    } catch {
      // Fall back to Ask Dr. Q prompt
    } finally {
      setLoadingExplanation(false);
    }
  }, [examId, question]);

  useEffect(() => {
    const hasStoredExplanation = question?.explanation || question?.ai_explanation;
    if (!hasStoredExplanation && examId) {
      fetchExplanation();
    }
  }, [question, examId, fetchExplanation]);

  if (!question) return null;

  const correctAnswer = question.correct_answer ?? question.correct_option;
  const userAnswer = question.user_answer ?? question.selected_option;
  const storedExplanation = question.explanation || question.ai_explanation || '';
  const explanation = storedExplanation || aiExplanation;

  const handleAskDrQ = () => {
    if (!drQInput.trim()) return;
    const event = new CustomEvent('qst-ai-ask', {
      detail: `Regarding this exam question: "${question.question_text || question.question}". ${drQInput}`
    });
    window.dispatchEvent(event);
    setShowDrQ(false);
    setDrQInput('');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <h3 className="font-display font-bold text-primary-800">Answer Explanation</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Question */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Question</p>
              <p className="text-sm text-gray-900 leading-relaxed">{(question.question_text || question.question || '').replace(/^\d+\.\s*/, '')}</p>
            </div>

            {/* Correct answer */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-2">Correct Answer</p>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  {OPTION_LETTERS[correctAnswer]}
                </span>
                <span className="text-sm font-medium text-emerald-800">
                  {question.options?.[correctAnswer]}
                </span>
              </div>
            </div>

            {/* User's answer (if wrong) */}
            {userAnswer !== correctAnswer && userAnswer !== undefined && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-2">Your Answer</p>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                    {OPTION_LETTERS[userAnswer]}
                  </span>
                  <span className="text-sm font-medium text-red-800">
                    {question.options?.[userAnswer]}
                  </span>
                </div>
              </div>
            )}

            {/* AI Explanation */}
            {explanation ? (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Explanation</p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <MarkdownRenderer content={explanation} />
                </div>
              </div>
            ) : loadingExplanation ? (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Dr. Q is generating an explanation...</span>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> Click &quot;Ask Dr. Q&quot; below to get a detailed AI-powered explanation for this question.
                </p>
              </div>
            )}

            {/* Formula (if present) */}
            {question.formula && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Formula Used</p>
                <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm">
                  {question.formula}
                </div>
              </div>
            )}

            {/* Common mistakes */}
            {question.common_mistakes && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Common Mistakes to Avoid</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800">{question.common_mistakes}</p>
                </div>
              </div>
            )}

            {/* Ask Dr. Q */}
            <div className="border-t border-gray-100 pt-4">
              {!showDrQ ? (
                <button
                  onClick={() => setShowDrQ(true)}
                  className="btn-gold text-sm w-full"
                >
                  Ask Dr. Q for More Clarification
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <label className="label">Ask Dr. Q about this question</label>
                  <textarea
                    value={drQInput}
                    onChange={e => setDrQInput(e.target.value)}
                    placeholder="e.g., Explain step-by-step why option B is correct..."
                    className="input min-h-[80px] resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowDrQ(false)} className="btn-secondary text-xs flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={handleAskDrQ}
                      disabled={!drQInput.trim()}
                      className="btn-gold text-xs flex-1"
                    >
                      Ask Dr. Q
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
