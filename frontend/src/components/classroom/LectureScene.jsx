import { useState } from 'react';
import { motion } from 'framer-motion';

export default function LectureScene({ scene, onComplete }) {
  const [reviewed, setReviewed] = useState(false);
  const content = scene?.content || {};

  const handleComplete = () => {
    setReviewed(true);
    onComplete?.();
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="font-display font-bold text-primary-800 text-lg">
                {content.title || scene.title || 'Lecture'}
              </h2>
              {content.estimated_time && (
                <p className="text-xs text-gray-400">~{content.estimated_time} min read</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {(content.sections || []).map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <h3 className="font-display font-semibold text-primary-800 mb-2">
                {section.heading}
              </h3>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {section.body}
              </div>
              {section.examples?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {section.examples.map((ex, j) => (
                    <div key={j} className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-xs">
                      <span className="font-semibold text-primary-700">Example:</span>{' '}
                      <span className="text-gray-700">{ex}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {!content.sections?.length && content.body && (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {content.body}
            </div>
          )}
        </div>
      </motion.div>

      {content.key_points?.length > 0 && (
        <div className="card bg-amber-50 border-amber-200">
          <h3 className="font-display font-semibold text-amber-800 text-sm mb-3">🔑 Key Points</h3>
          <ul className="space-y-2">
            {content.key_points.map((point, i) => (
              <li key={i} className="text-xs text-amber-900 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleComplete}
          disabled={reviewed}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            reviewed
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {reviewed ? '✓ Reviewed' : "I've reviewed this"}
        </button>
      </div>
    </div>
  );
}
