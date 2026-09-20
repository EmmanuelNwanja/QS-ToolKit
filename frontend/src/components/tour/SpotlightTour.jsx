import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * SpotlightTour - anchored coach-mark tour engine for QSToolkit.
 *
 * Renders a dimmed backdrop with a rounded "spotlight" cutout over a real DOM
 * element (matched by CSS selector), plus a tooltip card pinned beside it with
 * a step counter and Back / Next / Skip controls. Guidance points at the actual
 * interface instead of floating in the middle of the screen.
 *
 * Zero new dependencies: inline SVG icons, brand colors from tailwind config.
 * Steps without a `target` render as a centered card. Anchored steps whose
 * target never appears are skipped automatically so the tour never stalls.
 */

export const TOUR_REVEAL_EVENT = 'qst:tour-reveal-target';

const VIEWPORT_MARGIN = 12;
const TOOLTIP_GAP = 14;
const TOOLTIP_WIDTH = 340;
const ACCENT = '#1a3c5e';      // primary-700
const ACCENT_GOLD = '#f59e0b'; // gold-500

export function TourStep({
  target,
  title,
  body,
  tip,
  placement = 'bottom',
  padding = 8,
  radius = 14,
}) {
  return { target, title, body, tip, placement, padding, radius };
}

function Icon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  close: 'M18 6L6 18M6 6l12 12',
  left: 'M19 12H5M12 19l-7-7 7-7',
  right: 'M5 12h14M12 5l7 7-7 7',
  check: 'M20 6L9 17l-5-5',
};

export default function SpotlightTour({ steps, isOpen, startStep = 0, onClose, onStepChange }) {
  const [current, setCurrent] = useState(startStep);
  const [rect, setRect] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const [mounted, setMounted] = useState(false);
  const tipRef = useRef(null);
  const rafRef = useRef(null);
  const revealAsked = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) setCurrent(startStep);
  }, [isOpen, startStep]);

  const step = steps[current];
  const total = steps.length;
  const isFirst = current === 0;
  const isLast = current === total - 1;

  const finish = useCallback((completed) => {
    onClose({ completed, step: current });
  }, [onClose, current]);

  const goTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(index, total - 1));
    setCurrent(clamped);
    onStepChange?.(clamped);
  }, [total, onStepChange]);

  const goNext = useCallback(() => {
    if (isLast) { finish(true); return; }
    goTo(current + 1);
  }, [isLast, finish, goTo, current]);

  const goPrev = useCallback(() => { if (!isFirst) goTo(current - 1); }, [isFirst, goTo, current]);

  /* ── Measure target + position tooltip ──────────────────────────── */

  const positionTooltip = useCallback((r, preferred) => {
    const tip = tipRef.current;
    const tw = tip?.offsetWidth ?? TOOLTIP_WIDTH;
    const th = tip?.offsetHeight ?? 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!r) {
      setTipPos({
        top: Math.max(VIEWPORT_MARGIN, (vh - th) / 2),
        left: Math.max(VIEWPORT_MARGIN, (vw - tw) / 2),
        arrow: 'none', arrowOffset: 0,
      });
      return;
    }

    const fitsBottom = r.top + r.height + TOOLTIP_GAP + th <= vh - VIEWPORT_MARGIN;
    const fitsTop = r.top - TOOLTIP_GAP - th >= VIEWPORT_MARGIN;
    const fitsRight = r.left + r.width + TOOLTIP_GAP + tw <= vw - VIEWPORT_MARGIN;
    const fitsLeft = r.left - TOOLTIP_GAP - tw >= VIEWPORT_MARGIN;

    const order = [preferred || 'bottom', 'bottom', 'top', 'right', 'left'];
    let placement = 'center';
    for (const p of order) {
      if (p === 'bottom' && fitsBottom) { placement = 'bottom'; break; }
      if (p === 'top' && fitsTop) { placement = 'top'; break; }
      if (p === 'right' && fitsRight) { placement = 'right'; break; }
      if (p === 'left' && fitsLeft) { placement = 'left'; break; }
    }

    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
    let top = 0; let left = 0; let arrow = 'none'; let arrowOffset = 0;

    if (placement === 'bottom' || placement === 'top') {
      left = clamp(r.left + r.width / 2 - tw / 2, VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN);
      const centerX = r.left + r.width / 2;
      arrowOffset = clamp(centerX - left, 20, tw - 20);
      if (placement === 'bottom') { top = r.top + r.height + TOOLTIP_GAP; arrow = 'top'; }
      else { top = r.top - TOOLTIP_GAP - th; arrow = 'bottom'; }
    } else if (placement === 'right' || placement === 'left') {
      top = clamp(r.top + r.height / 2 - th / 2, VIEWPORT_MARGIN, vh - th - VIEWPORT_MARGIN);
      const centerY = r.top + r.height / 2;
      arrowOffset = clamp(centerY - top, 20, th - 20);
      if (placement === 'right') { left = r.left + r.width + TOOLTIP_GAP; arrow = 'left'; }
      else { left = r.left - TOOLTIP_GAP - tw; arrow = 'right'; }
    } else {
      top = clamp((vh - th) / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - th - VIEWPORT_MARGIN));
      left = clamp((vw - tw) / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN));
      arrow = 'none';
    }

    setTipPos({ top, left, arrow, arrowOffset });
  }, []);

  const reposition = useCallback(() => {
    if (!step) return;
    if (!step.target) { setRect(null); positionTooltip(null, step.placement); return; }

    const el = document.querySelector(step.target);
    if (!el) { setRect(null); positionTooltip(null, step.placement); return; }

    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); positionTooltip(null, step.placement); return; }
    const pad = step.padding ?? 8;
    const next = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    setRect(next);
    positionTooltip(next, step.placement);
  }, [step, positionTooltip]);

  /* ── Locate target on step change (with retry for late mounts) ──── */

  useEffect(() => {
    if (!isOpen || !step) return undefined;
    let active = true;
    let tries = 0;
    revealAsked.current = false;

    const attempt = () => {
      if (!active) return;
      if (step.target) {
        const el = document.querySelector(step.target);
        const hidden = !el || el.getBoundingClientRect().width === 0 || el.offsetParent === null;
        if (hidden && !revealAsked.current) {
          // Ask the host to reveal a collapsed drawer target, then retry.
          revealAsked.current = true;
          window.dispatchEvent(new CustomEvent(TOUR_REVEAL_EVENT, { detail: { selector: step.target } }));
          setTimeout(attempt, 320);
          return;
        }
        if (el && !hidden) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          setTimeout(() => { if (active) reposition(); }, 260);
          return;
        }
        tries += 1;
        if (tries > 12) {
          if (isLast) finish(true); else goTo(current + 1);
          return;
        }
        setTimeout(attempt, 100);
        return;
      }
      reposition();
    };

    attempt();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current]);

  /* ── Keep spotlight glued on scroll / resize ────────────────────── */

  useEffect(() => {
    if (!isOpen) return undefined;
    const onMove = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(reposition);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, reposition]);

  /* ── Keyboard navigation ────────────────────────────────────────── */

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, goNext, goPrev, finish]);

  /* ── Lock body scroll while tour is open ────────────────────────── */

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!mounted || !isOpen || !step) return null;

  const hasSpotlight = !!rect;

  return createPortal(
    <div className="fixed inset-0 z-[80]" aria-live="polite" role="dialog" aria-modal="true">
      {/* Click zones: left edge = back, anywhere else = advance */}
      <button
        type="button"
        aria-label="Previous step"
        onClick={goPrev}
        disabled={isFirst}
        className={`absolute inset-y-0 left-0 w-[26%] ${isFirst ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ background: 'transparent', border: 0 }}
      />
      <button
        type="button"
        aria-label={isLast ? 'Finish tour' : 'Next step'}
        onClick={goNext}
        className="absolute inset-y-0 right-0 w-[74%] cursor-pointer"
        style={{ background: 'transparent', border: 0 }}
      />

      {/* Spotlight cutout: padded box whose massive box-shadow dims everything else */}
      {hasSpotlight && (
        <div
          className="absolute pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: step.radius ?? 14,
            boxShadow: '0 0 0 9999px rgba(14, 31, 49, 0.72)',
            outline: `2px solid ${ACCENT_GOLD}`,
            outlineOffset: 2,
          }}
        />
      )}

      {/* Clicking the highlighted element itself advances */}
      {hasSpotlight && (
        <button
          type="button"
          aria-label={isLast ? 'Finish tour' : 'Next step'}
          onClick={goNext}
          className="absolute cursor-pointer"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, background: 'transparent', border: 0 }}
        />
      )}

      {/* Full-screen dim when there's no target */}
      {!hasSpotlight && <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />}

      {/* Tooltip card */}
      <div
        ref={tipRef}
        className="absolute w-[340px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl transition-[top,left] duration-300 ease-out"
        style={{
          top: tipPos?.top ?? -9999,
          left: tipPos?.left ?? -9999,
          visibility: tipPos ? 'visible' : 'hidden',
        }}
      >
        {tipPos && tipPos.arrow !== 'none' && (
          <span
            className="absolute w-3 h-3 bg-white rotate-45"
            style={{
              ...(tipPos.arrow === 'top' && { top: -6, left: tipPos.arrowOffset - 6 }),
              ...(tipPos.arrow === 'bottom' && { bottom: -6, left: tipPos.arrowOffset - 6 }),
              ...(tipPos.arrow === 'left' && { left: -6, top: tipPos.arrowOffset - 6 }),
              ...(tipPos.arrow === 'right' && { right: -6, top: tipPos.arrowOffset - 6 }),
            }}
          />
        )}

        <div className="relative p-5">
          <button
            onClick={() => finish(false)}
            aria-label="Skip tour"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icon d={ICONS.close} size={15} />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Step {current + 1} of {total}
          </p>

          <h3 className="font-display font-bold text-lg text-primary-800 leading-snug pr-6 mb-1.5">
            {step.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>

          {step.tip && (
            <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 bg-gold-50 border border-gold-100">
              <span className="mt-0.5 text-xs">💡</span>
              <p className="text-xs font-medium leading-relaxed text-gold-700">{step.tip}</p>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4 mb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to step ${i + 1}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 22 : 6,
                  backgroundColor: i === current ? ACCENT : i < current ? 'rgba(26, 60, 94, 0.4)' : '#E5E7EB',
                }}
              />
            ))}
          </div>

          <p className="text-[11px] text-gray-400 mb-3">
            Click anywhere to continue{isFirst ? '' : ' · click the left edge to go back'}.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => finish(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors mr-auto"
            >
              Skip tour
            </button>

            {!isFirst && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1 py-2 px-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <Icon d={ICONS.left} size={13} /> Back
              </button>
            )}

            {isLast && step.cta ? (
              <a
                href={step.cta.href || '#'}
                onClick={(e) => {
                  if (step.cta?.onClick) { e.preventDefault(); step.cta.onClick(); }
                  finish(true);
                }}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-white text-sm font-semibold active:scale-[0.98] transition-all"
                style={{ backgroundColor: ACCENT }}
              >
                {step.cta.label} <Icon d={ICONS.right} size={13} />
              </a>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-white text-sm font-semibold active:scale-[0.98] transition-all"
                style={{ backgroundColor: ACCENT }}
              >
                {isLast ? <><Icon d={ICONS.check} size={13} /> Done</> : <>Next <Icon d={ICONS.right} size={13} /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
