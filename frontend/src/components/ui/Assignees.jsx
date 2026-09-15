import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

/* ══ Assignees ════════════════════════════════════════════
   A pill that opens a list, and fills up with faces as you
   assign them. One, two, four — the pill grows to hold them
   and they overlap into a stack rather than a row.

   Originally "People picker" from Bencho (MIT).
   QSToolkit: tokens mapped to tailwind gray scale + font-body.
   Used where project assignment or task delegation needs a
   compact, face-driven selector. */

/* QSToolkit: AVATARS placeholder — point at real user images
   when available. Currently shows initials via CSS fallback. */
const AVATARS = {};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ── the cast ──────────────────────────────────────────────
   Bencho used the same four pictures under different names.
   QSToolkit: replaced with QS-relevant roles for our domain. */
const CAST = [
  { id: "kai", name: "Adam Marsh", role: "Design" },
  { id: "mara", name: "Priya Raman", role: "Research" },
  { id: "sofia", name: "Nora Wilder", role: "Engineering" },
  { id: "ines", name: "Marco Bellini", role: "Product" },
];

const W = 264;
const H = 268;

const FACE = 28;
const CORNER = 22;
const LAP = 10;

const quad = (n, gut) => {
  const cell = (FACE - gut) / 2;
  const s = cell / FACE;
  const a = cell / 2;
  const b = FACE - cell / 2;
  const m = FACE / 2;
  if (n <= 1) return [{ cx: m, cy: m, s: 1 }];
  if (n === 2) return [{ cx: a, cy: m, s }, { cx: b, cy: m, s }];
  if (n === 3) return [{ cx: a, cy: a, s }, { cx: b, cy: a, s }, { cx: a, cy: b, s }];
  return [
    { cx: a, cy: a, s }, { cx: b, cy: a, s },
    { cx: a, cy: b, s }, { cx: b, cy: b, s },
  ];
};

export function Assignees({
  corner = CORNER,
  overlap = LAP,
  stack = "Row",
} = {}) {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState(["kai", "mara"]);

  const r = clamp(corner, 0, 26);
  const lap = clamp(overlap, 0, 22);
  const grid = stack === "Grid";

  const spots = quad(picked.length, 4 - (lap / 22) * 2);

  const rail = !picked.length
    ? 0
    : grid
      ? FACE
      : FACE + (picked.length - 1) * (FACE - lap);

  const toggle = (id) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <div
      className="pik"
      style={{
        width: W,
        height: H,
        "--pik-row-r": `${Math.max(0, r - 6)}px`,
        /* QSToolkit: scoped tokens — maps Bencho's design system
           to our gray scale and font-body. No globals leaked. */
        "--fill-on": "#ffffff",
        "--fill-on-rgb": "255, 255, 255",
        "--fill-slab": "#ffffff",
        "--ink": "#111827",
        "--ink-rgb": "17, 24, 39",
        "--card": "#ffffff",
        "--font-ui": "var(--font-body)",
      }}
    >
      <button
        className="pik-pill"
        style={{ borderRadius: r }}
        onClick={() => { setOpen((v) => !v); }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="pik-rail" style={{ width: rail }}>
          <AnimatePresence initial={false}>
            {picked.map((id, i) => {
              const spot = grid ? spots[Math.min(i, spots.length - 1)] : null;
              const tx = spot ? spot.cx - FACE / 2 : i * (FACE - lap);
              const ty = spot ? spot.cy - FACE / 2 : 0;
              const sc = spot ? spot.s : 1;
              return (
              <motion.span
                key={id}
                className="pik-face"
                style={{ zIndex: CAST.length - i }}
                initial={{ scale: 0.2 * sc, opacity: 0, x: tx, y: ty - 10, rotate: -22 }}
                animate={{ scale: sc, opacity: 1, x: tx, y: ty, rotate: 0 }}
                exit={{ scale: 0.2 * sc, opacity: 0, x: tx, y: ty - 6, rotate: 14 }}
                transition={{
                  type: "spring", stiffness: 600, damping: 21, mass: 0.8,
                  x: { type: "spring", stiffness: 660, damping: 34, mass: 0.7 },
                  y: { type: "spring", stiffness: 660, damping: 34, mass: 0.7 },
                  scale: { type: "spring", stiffness: 660, damping: 34, mass: 0.7 },
                  opacity: { duration: 0.12 },
                }}
              >
                <img src={AVATARS[id]} alt="" draggable={false} />
              </motion.span>
              );
            })}
          </AnimatePresence>
        </span>

        {picked.length === 0 && <span className="pik-say">Unassigned</span>}

        <ChevronDown className="pik-chev" size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="pik-card"
            style={{ borderRadius: r }}
            role="listbox"
            aria-multiselectable="true"
            initial={{ opacity: 0, y: -10, scaleX: 0.86, scaleY: 0.72 }}
            animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleX: 0.92, scaleY: 0.86 }}
            transition={{
              type: "spring", stiffness: 460, damping: 23, mass: 0.9,
              opacity: { duration: 0.12 },
            }}
          >
            {CAST.map((p) => {
              const on = picked.includes(p.id);
              return (
                <motion.button
                  key={p.id}
                  className="pik-row"
                  role="option"
                  aria-selected={on}
                  data-on={on || undefined}
                  onClick={() => toggle(p.id)}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring", stiffness: 620, damping: 34, mass: 0.7,
                    delay: 0.04 * CAST.indexOf(p) + 0.03,
                  }}
                >
                  <img className="pik-av" src={AVATARS[p.id]} alt="" draggable={false} />
                  <span className="pik-who">
                    <span className="pik-name">{p.name}</span>
                    <span className="pik-role">{p.role}</span>
                  </span>
                  <span className="pik-mark">
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span
                          className="pik-tick"
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 600, damping: 28, mass: 0.6 }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Assignees;
