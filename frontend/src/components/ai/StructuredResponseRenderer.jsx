/**
 * StructuredResponseRenderer.jsx
 * Renders AI responses with visual structure: sections, tables, code blocks,
 * and self-critique scores. Enhances readability for QS-specific content.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function StructuredResponseRenderer({ content, critique, showCritique = false }) {
  return (
    <div className="space-y-3">
      {/* Main Content */}
      <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-rose-600 prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Self-Critique Panel */}
      {showCritique && critique && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Quality Check
            </h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              critique.passed
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {critique.passed ? '✅ Passed' : '⚠️ Needs Review'}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {critique.dimensions?.map((dim) => {
              const score = critique.scores?.[dim.name] || 0;
              return (
                <div key={dim.name} className="text-center">
                  <div className="text-xs text-gray-500 truncate" title={dim.label}>
                    {dim.label}
                  </div>
                  <div className="flex gap-0.5 justify-center mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`w-2 h-2 rounded-full ${
                          n <= score
                            ? score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-medium mt-0.5">{score}/5</div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-gray-400">
            Overall: {critique.avgScore}/5
          </div>
        </div>
      )}
    </div>
  );
}
