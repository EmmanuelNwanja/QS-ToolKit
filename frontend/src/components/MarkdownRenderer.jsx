import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * MarkdownRenderer — renders AI responses with rich formatting
 * Supports: bold, italic, headers, lists, code blocks, tables, blockquotes
 */
export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-gray-900 mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold text-gray-800 mt-3 mb-1.5 uppercase tracking-wide">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-gray-700 leading-relaxed mb-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ inline, children }) =>
            inline ? (
              <code className="bg-gray-100 text-primary-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
            ) : (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2">
                <code>{children}</code>
              </pre>
            ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-gray-700 border-b border-gray-100">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-300 pl-3 py-1 my-2 bg-primary-50/50 rounded-r">
              <p className="text-sm text-gray-600 italic m-0">{children}</p>
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
