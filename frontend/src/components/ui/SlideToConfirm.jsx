import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

/* ══ Slide to confirm ═════════════════════════════════════
   A handle you push across a track. It follows the finger
   exactly, and past the mark it takes over and finishes the
   journey itself.

   Originally from Bencho (MIT).
   QSToolkit: tokens mapped to tailwind gray scale + font-body.
   The handle becomes the confirmation — it unfurls leftward
   and fills the track, arrow becoming a check mark.

   QSToolkit use: payment confirmations, dangerous actions,
   subscription upgrades — anywhere we need deliberate user
   commitment before executing. */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const SPAN = 280;
const H = 56;
const PAD = 4;
const GRIP = H - PAD * 2;
const MIN = 220;
const MAX = 380;

const CORNER = H / 2;
const SPEED = 50;

const SWELL = 1.03;

const HOLD = 1500;

export function SlideToConfirm({
  corner = CORNER,
  speed = SPEED,
  width = SPAN,
} = {}) {
  const [done, setDone] = useState(false);
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);
  const track = useRef(null);
  const grip = useRef(null);
  const beat = useRef(0);

  const x = useMotionValue(0);
  const anchor = useMotionValue(0);
  const pulse = useMotionValue(1);
  const shown = useMotionValue(1);

  const span = clamp(Math.round(width), MIN, MAX);
  const TRAVEL = span - PAD * 2 - GRIP;

  const r = clamp(corner, 0, CORNER);
  const gripR = Math.max(0, r - PAD);
  const mark = TRAVEL;

  const stiff = 260 + (clamp(speed, 0, 100) / 100) * 640;
  const spring = {
    type: "spring",
    stiffness: stiff,
    damping: 2 * Math.sqrt(stiff * 0.9),
    mass: 0.9,
  };
  const home = { ...spring, damping: 2 * Math.sqrt(stiff * 0.9) * 0.62 };

  useEffect(() => () => {
    window.clearTimeout(beat.current);
    loose.current?.();
  }, []);

  const loose = useRef(null);
  const live = useRef({ move: () => {}, up: () => {} });

  const watch = () => {
    loose.current?.();
    const onMove = (e) => live.current.move(e);
    const onUp = (e) => { live.current.up(e); loose.current?.(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    loose.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      loose.current = null;
    };
  };

  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL));
  const wide = useTransform([seen, anchor], ([v, a]) =>
    GRIP + clamp(a - v, 0, TRAVEL));

  const over = useTransform(x, (v) => Math.max(0, -v));
  const squash = useTransform(over, (o) => 1 - Math.min(0.08, o / 110));
  const wash = useTransform(seen, (v) => v + GRIP);
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0]);
  const arrow = useTransform([seen, shown], ([v, on]) =>
    on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1));

  const sx = useTransform(squash, (q) => q * (hot && !held && !done ? SWELL : 1));
  const sy = useTransform(squash, (q) => (1 / q) * (hot && !held && !done ? SWELL : 1));

  const local = (clientX) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return 0;
    const k = box.width / span;
    return (clientX - box.left) / (k || 1);
  };

  const finish = () => {
    setDone(true);
    anchor.set(x.get());
    animate(shown, 0, { duration: 0.12 });
    animate(x, 0, spring);
    animate(pulse, [1, 0.974, 1], {
      duration: 0.46,
      times: [0, 0.62, 1],
      ease: [0.33, 0.55, 0.2, 1],
      delay: 0.1,
    });
    beat.current = window.setTimeout(() => {
      setDone(false);
      animate(shown, 1, { duration: 0.2, delay: 0.12 });
      animate(anchor, 0, { type: "spring", stiffness: 380, damping: 34, mass: 0.9 });
    }, HOLD);
  };

  const down = (e) => {
    if (done) return;
    e.stopPropagation();
    grip.current = { id: e.pointerId, grab: null, moved: false };
    setHeld(true);
    try { track.current?.setPointerCapture(e.pointerId); } catch { /* not live */ }
    watch();
  };

  const move = (e) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const at = local(e.clientX);
    if (g.grab === null) { g.grab = at - x.get(); return; }
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x.get()) > 0.5) g.moved = true;
    x.set(next);
  };

  const up = (e) => {
    const g = grip.current;
    if (!g) return;
    grip.current = null;
    try { track.current?.releasePointerCapture?.(e.pointerId); } catch { /* never captured */ }
    setHeld(false);
    if (x.get() >= mark) finish();
    else {
      if (g.moved) animate(x, 0, home);
    }
  };

  live.current = { move, up };

  return (
    <div className="sld" style={{ width: span, height: H,
      /* QSToolkit: scoped tokens */
      "--fill-on": "#ffffff",
      "--fill-on-rgb": "255, 255, 255",
      "--fill-slab": "#ffffff",
      "--ink": "#111827",
      "--ink-rgb": "17, 24, 39",
      "--card": "#ffffff",
      "--font-ui": "var(--font-body)",
      "--pane-edge": "#e5e7eb",
    }}>
      <motion.div
        className="sld-track"
        ref={track}
        style={{ borderRadius: r, scale: pulse }}
        data-held={held || undefined}
        data-done={done || undefined}
        onPointerDown={down}
      >
        <motion.i
          className="sld-wash"
          aria-hidden="true"
          style={{ width: wash, borderRadius: gripR }}
        />

        <motion.span className="sld-say" style={{ opacity: say }}>
          Slide to confirm
        </motion.span>

        <motion.button
          type="button"
          className="sld-grip"
          onPointerEnter={() => setHot(true)}
          onPointerLeave={() => setHot(false)}
          style={{
            x: seen,
            scaleX: sx,
            scaleY: sy,
            width: wide,
            borderRadius: gripR,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.7 }}
          aria-label={done ? "Confirmed" : "Slide to confirm"}
        >
          <motion.span className="sld-arrow" style={{ opacity: arrow }} aria-hidden="true">
            <ArrowRight size={20} strokeWidth={2.4} />
          </motion.span>

          <motion.span
            className="sld-done"
            aria-hidden="true"
            initial={false}
            animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.7 }}
            transition={{ duration: 0.18, ease: [0.33, 0.55, 0.2, 1] }}
          >
            <Check size={19} strokeWidth={2.8} />
            Confirmed
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  );
}

export default SlideToConfirm;
