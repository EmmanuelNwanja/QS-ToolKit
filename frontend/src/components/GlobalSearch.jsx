import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { projectAPI } from '../services/api';
import { CALCULATORS } from '../utils/helpers';

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ projects: [], calculators: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [router.pathname]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults({ projects: [], calculators: [] });
      return;
    }

    setLoading(true);
    const lower = q.toLowerCase();

    // Filter calculators locally (instant)
    const matchedCalcs = CALCULATORS.filter(c =>
      c.label.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower) ||
      c.category.toLowerCase().includes(lower)
    );

    setResults(prev => ({ ...prev, calculators: matchedCalcs }));

    // Search projects via API (debounced by caller)
    try {
      const res = await projectAPI.list({ limit: 5, search: q });
      setResults(prev => ({
        ...prev,
        projects: (res.data?.projects || []).slice(0, 5),
      }));
    } catch {
      setResults(prev => ({ ...prev, projects: [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const hasResults = results.projects.length > 0 || results.calculators.length > 0;
  const showEmpty = query.length >= 2 && !loading && !hasResults;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
          {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+K
        </kbd>
      </button>

      {/* Overlay + Search Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setOpen(false); setQuery(''); }} />

          <div ref={containerRef} className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Search input */}
            <div className="flex items-center border-b border-gray-100 px-4">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, calculators..."
                className="w-full px-3 py-4 text-sm outline-none bg-transparent"
              />
              {loading && (
                <svg className="animate-spin w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <button
                onClick={() => { setOpen(false); setQuery(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Type at least 2 characters to search
                </div>
              ) : showEmpty ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No results for &quot;{query}&quot;
                </div>
              ) : (
                <div className="py-2">
                  {/* Projects */}
                  {results.projects.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Projects
                      </div>
                      {results.projects.map(p => (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          onClick={() => { setOpen(false); setQuery(''); }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {p.title?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                            <p className="text-xs text-gray-500">{p.client_name || 'No client'} · {p.status}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Calculators */}
                  {results.calculators.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Calculators
                      </div>
                      {results.calculators.map(c => (
                        <Link
                          key={c.id}
                          href={`/calculators/${c.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          onClick={() => { setOpen(false); setQuery(''); }}
                        >
                          <span className="text-lg">{c.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{c.label}</p>
                            <p className="text-xs text-gray-500">{c.description}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{c.category}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {hasResults && (
              <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400 flex items-center gap-4">
                <span>Enter to select</span>
                <span>ESC to close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
