/**
 * Spring configuration presets for Motion/framer-motion.
 * QSToolkit: presets tuned for construction-industry UI —
 * slightly heavier damping for a "solid" feel over bouncy/playful.
 */

export const springPresets = {
  /** Gentle entrance — pages fading in, content appearing */
  gentle: {
    type: "spring" as const,
    stiffness: 120,
    damping: 20,
    mass: 1,
  },
  /** Snappy response — buttons, toggles, small controls */
  snappy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  /** Bouncy — playful elements, notifications */
  bouncy: {
    type: "spring" as const,
    stiffness: 300,
    damping: 15,
    mass: 0.8,
  },
  /** Wobbly — emphasis, attention-grabbing */
  wobbly: {
    type: "spring" as const,
    stiffness: 180,
    damping: 12,
    mass: 1,
  },
  /** Stiff — drag interactions, sliding panels */
  stiff: {
    type: "spring" as const,
    stiffness: 500,
    damping: 40,
    mass: 1,
  },
  /** Slow — large transitions, page morphs */
  slow: {
    type: "spring" as const,
    stiffness: 80,
    damping: 20,
    mass: 1.2,
  },
  /** Molasses — dramatic, weighted transitions */
  molasses: {
    type: "spring" as const,
    stiffness: 50,
    damping: 15,
    mass: 1.5,
  },
} as const;

export type SpringPreset = keyof typeof springPresets;
