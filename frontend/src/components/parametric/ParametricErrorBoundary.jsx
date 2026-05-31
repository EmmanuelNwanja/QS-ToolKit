/**
 * Design Compliance Checklist:
 * ─────────────────────────────
 * [x] Colors  → primary-700, gray-500 (existing tokens)
 * [x] Buttons → btn-primary (from globals.css)
 * [x] Cards   → card (from globals.css)
 * [x] Icons   → Emoji-based (matching existing app pattern)
 * [x] Layout  → Standalone fallback, no external dependencies
 * [x] Spacing → Tailwind scale
 * [x] No hex codes, no arbitrary spacing
 */

import { Component } from 'react';

export default class ParametricErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card max-w-lg mx-auto mt-8 text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <h2 className="section-title mb-2">Parametric Engine Error</h2>
          <p className="text-sm text-gray-500 mb-4">
            The Smart Parametric Calculator encountered an unexpected error.
            The rest of QSToolkit is unaffected.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-primary text-xs"
          >
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-4 text-xs text-left bg-gray-100 p-3 rounded-lg overflow-auto max-h-32 text-gray-600">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
