import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { searchAPI } from '../../services/api';

/* ══ Seek ═════════════════════════════════════════════════
   A search icon that becomes a search field with live results.

   ONE OBJECT, NOT TWO. The icon and the field are both
   inside it the whole time — the box's WIDTH is the state.

   QSToolkit: tokens mapped to tailwind gray scale + font-body.
   Live results: queries /search as the user types (min 3 chars),
   renders a predictable grouped dropdown (Projects / BOQs /
   Invoices) and navigates on selection.

   QSToolkit sizing: the field was too large next to the
   notification bell + upgrade button; SHUT/LENS/WIDE/SNUG are
   trimmed to fit the header without crowding. */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const SHUT = 44;
const LENS = 20;
const INSET = (SHUT - LENS) / 2;
const CORNER = 22;
const WIDE = 240;
const SNUG = 190;
const MIN_CHARS = 3;

/* ── one spring, for everything that settles ─────────────── */
const springOf = (tune) => ({
  k: 0.08 + (tune / 100) * 0.16,
  d: 0.62 + (tune / 100) * 0.2,
});

function useSpring(target, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      setAt(target);
      return;
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [target, tune, instant]);

  return at;
}

const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const TYPE_META = {
  projects: { label: 'Projects', href: (r) => `/projects/${r.id}` },
  boqs:     { label: 'BOQs',     href: (r) => `/boq/${r.id}` },
  invoices: { label: 'Invoices', href: () => '/invoices' },
};

export function Search({
  give = 50,
  spring = 50,
  width,
  corner = CORNER,
  onSearch,
} = {}) {
  const router = useRouter();
  const [snug, setSnug] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(max-width: 760px)").matches,
  );
  const [touch, setTouch] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(pointer: coarse)").matches,
  );
  useEffect(() => {
    const room = window.matchMedia("(max-width: 760px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const read = () => { setSnug(room.matches); setTouch(coarse.matches); };
    room.addEventListener("change", read);
    coarse.addEventListener("change", read);
    return () => {
      room.removeEventListener("change", read);
      coarse.removeEventListener("change", read);
    };
  }, []);
  const span = width ?? (snug ? SNUG : WIDE);

  const frame = useRef(null);
  const field = useRef(null);
  const beat = useRef(0);
  const rest = useRef(0);
  const listId = useRef(`sek-list-${Math.random().toString(36).slice(2, 9)}`);

  const [open, setOpen] = useState(false);
  const [press, setPress] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState({ projects: [], boqs: [], invoices: [] });
  const [error, setError] = useState(null);
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const still = stillness();

  useEffect(() => () => {
    window.clearTimeout(beat.current);
    window.clearTimeout(rest.current);
  }, []);

  const target = open ? Math.max(SHUT, span) : SHUT;
  const w = useSpring(target, clamp(spring, 0, 100), still);

  const p = clamp((w - SHUT) / Math.max(1, Math.max(SHUT, span) - SHUT), 0, 1);

  /* ── Live search: debounced, min 3 chars, abortable ────────── */

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_CHARS) {
      setResults({ projects: [], boqs: [], invoices: [] });
      setError(null);
      return;
    }
    setBusy(true);
    try {
      const { data } = await searchAPI.global(trimmed);
      setResults(data?.results || { projects: [], boqs: [], invoices: [] });
      setError(null);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code !== 'QUERY_TOO_SHORT') setError('Search unavailable');
      setResults({ projects: [], boqs: [], invoices: [] });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    if (!open || trimmed.length < MIN_CHARS) {
      setResults({ projects: [], boqs: [], invoices: [] });
      setError(null);
      return undefined;
    }
    const t = setTimeout(() => { runSearch(trimmed); }, 250);
    return () => clearTimeout(t);
  }, [value, open, runSearch]);

  const totalHits =
    (results.projects?.length || 0) +
    (results.boqs?.length || 0) +
    (results.invoices?.length || 0);

  const go = (type, r) => {
    const meta = TYPE_META[type];
    if (!meta) return;
    setOpen(false);
    setValue('');
    router.push(meta.href(r)).catch(() => {});
  };

  useEffect(() => {
    const el = frame.current;
    if (!el || open || still) return;
    let raf = 0;
    let at = { x: 0, y: 0 };
    const publish = () => { raf = 0; setLean(at); };
    const read = (e) => {
      const b = el.getBoundingClientRect();
      const k = b.width / (el.offsetWidth || b.width) || 1;
      const dx = (e.clientX - (b.left + b.width / 2)) / k;
      const dy = (e.clientY - (b.top + b.height / 2)) / k;
      const d = Math.hypot(dx, dy);
      const R = 110;
      if (d > R) {
        if (at.x || at.y) { at = { x: 0, y: 0 }; if (!raf) raf = requestAnimationFrame(publish); }
        return;
      }
      const pull = (1 - d / R) ** 1.4 * (2 + (give / 100) * 5);
      at = { x: (dx / (d || 1)) * pull, y: (dy / (d || 1)) * pull };
      if (!raf) raf = requestAnimationFrame(publish);
    };
    const gone = () => { at = { x: 0, y: 0 }; if (!raf) raf = requestAnimationFrame(publish); };
    document.addEventListener("pointermove", read, { passive: true });
    document.addEventListener("pointerleave", gone);
    return () => {
      document.removeEventListener("pointermove", read);
      document.removeEventListener("pointerleave", gone);
      cancelAnimationFrame(raf);
    };
  }, [open, give, still]);

  const start = () => {
    if (open) return;
    setPress(true);
    window.clearTimeout(beat.current);
    beat.current = window.setTimeout(() => {
      setPress(false);
      setOpen(true);
      field.current?.focus();
    }, still ? 0 : 90);
  };

  const away = (e) => {
    // Don't close when clicking inside the results dropdown.
    if (e && frame.current && frame.current.contains(e.relatedTarget)) return;
    if (value.trim()) return;
    setOpen(false);
  };

  const tapped = () => {
    if (!busy) setBusy(true);
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => setBusy(false), 340);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && value.trim().length >= MIN_CHARS) {
      if (results.projects?.length) { go('projects', results.projects[0]); return; }
      if (results.boqs?.length) { go('boqs', results.boqs[0]); return; }
      if (results.invoices?.length) { go('invoices', results.invoices[0]); return; }
      onSearch?.(value.trim());
    }
    if (e.key !== "Escape") return;
    e.preventDefault();
    setValue("");
    setResults({ projects: [], boqs: [], invoices: [] });
    setOpen(false);
    field.current?.blur();
  };

  const showPanel = open && value.trim().length >= MIN_CHARS;

  return (
    <div
      className="sek"
      ref={frame}
      data-open={open}
      data-press={press}
      data-busy={busy}
      data-flat={still || undefined}
      style={{
        "--sek-r": `${clamp(corner, 0, CORNER)}px`,
        "--w": `${w.toFixed(2)}px`,
        "--p": p.toFixed(3),
        "--say": clamp((p - 0.55) / 0.45, 0, 1).toFixed(3),
        "--lx": `${lean.x.toFixed(2)}px`,
        "--ly": `${lean.y.toFixed(2)}px`,
        "--inset": `${INSET}px`,
        "--lens": `${LENS}px`,
        "--shut": `${SHUT}px`,
        "--frame": `${Math.max(SHUT, span) + 26}px`,
        "--frameh": `${SHUT + 40}px`,
        /* QSToolkit: scoped tokens */
        "--ink": "#111827",
        "--ink-2": "#374151",
        "--ink-3": "#6b7280",
        "--ink-4": "#9ca3af",
        "--ink-5": "#d1d5db",
        "--ink-rgb": "17, 24, 39",
        "--pane": "#f9fafb",
        "--pane-edge": "#e5e7eb",
        "--bg": "#f9fafb",
        "--font-ui": "var(--font-body)",
      }}
    >
      <div className="sek-skin">
        <svg className="sek-lens" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="7.6" cy="7.6" r="5.4" />
          <path d="M11.6 11.6 L15.4 15.4" />
        </svg>

        <input
          ref={field}
          className="sek-field"
          type="text"
          value={value}
          placeholder="Search"
          aria-label="Search projects, BOQs and invoices"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId.current}
          aria-autocomplete="list"
          inputMode={touch ? "none" : undefined}
          tabIndex={open ? 0 : -1}
          onChange={(e) => { setValue(e.target.value); tapped(); }}
          onBlur={away}
          onKeyDown={handleKeyDown}
        />

        {!open && (
          <button className="sek-hit" aria-label="Search" onClick={start} />
        )}
      </div>

      {/* ── Live results dropdown ─────────────────────────────── */}
      {showPanel && (
        <div
          id={listId.current}
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50"
        >
          {busy && totalHits === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
          )}

          {!busy && error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}

          {!busy && !error && totalHits === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No matches for “{value.trim()}”
            </div>
          )}

          {!busy && !error && Object.entries(TYPE_META).map(([type, meta]) => {
            const rows = results[type] || [];
            if (rows.length === 0) return null;
            return (
              <div key={type} className="py-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {meta.label}
                </p>
                {rows.map((r) => (
                  <button
                    key={`${type}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => { e.preventDefault(); go(type, r); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {type === 'invoices' ? (r.invoice_number || r.client_name || 'Invoice') : (r.title || 'Untitled')}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {type === 'projects' && (r.client_name || r.location || r.status || '')}
                      {type === 'boqs' && (r.status ? `Status: ${r.status}` : '')}
                      {type === 'invoices' && (r.client_name || r.invoice_type || '')}
                    </p>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Search;
