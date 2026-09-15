import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Liquid } from "liquid-gooey";

/* ══ Dragging ball ════════════════════════════════════════
   One circle, and the only thing it does is follow your
   finger. The trail is the point: the ball is pinned to the
   pointer with no lag, and a second body chases it a beat
   behind, so the goo between them stretches into a tail
   while you are moving and collapses back when you stop.

   Originally from Bencho (MIT).
   QSToolkit: used as an interactive demo / play element.
   The squeeze-on-hold gives tactile feedback.

   QSToolkit use: interactive demonstrations, onboarding
   play elements, or any context where a draggable object
   with personality adds delight. */

const WELL = { w: 300, h: 200 };

const SWELL = 0.06;

function useGooScale() {
  const box = useRef(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const next = (r.width / (el.offsetWidth || r.width)) || 1;
      setK((was) => (Math.abs(was - next) < 0.001 ? was : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    const t = window.setInterval(read, 500);
    return () => { ro.disconnect(); window.clearInterval(t); };
  }, []);
  return { box, k };
}

export function DraggingBall({
  stretch = 36,
  give = 50,
  size = 56,
  grip = 50,
} = {}) {
  const g = Math.min(1, Math.max(0, grip / 100));
  const { box, k } = useGooScale();

  const armed = useRef(false);
  const grab = () => {
    if (armed.current) return;
    armed.current = true;
  };
  const drop = () => {
    if (!armed.current) return;
    armed.current = false;
  };

  const reach = { x: (WELL.w - size) / 2, y: (WELL.h - size) / 2 };

  return (
    <div
      className="drg-well"
      ref={box}
      style={{ "--k": k, width: WELL.w, height: WELL.h }}
    >
      <Liquid
        className="drg-goo"
        blur={4.5}
        contrast={16}
        /* QSToolkit: fill uses white (raised surface) to match
           our card-based UI. Bencho used --fill-slab which maps
           to white in our light-mode system. */
        fill="#ffffff"
        filterPadding={80}
      >
        <Liquid.Item
          effect="move"
          move={{
            springiness: give / 100,
            stretch: stretch / 100,
            wobble: 0.35,
            trail: 0,
          }}
        >
          <motion.span
            className="drg-ball"
            style={{ width: size, height: size }}
            drag
            dragConstraints={{
              left: -reach.x,
              right: reach.x,
              top: -reach.y,
              bottom: reach.y,
            }}
            dragElastic={0.14}
            dragMomentum={false}
            whileHover={{ scaleX: 1 + SWELL * g, scaleY: 1 + SWELL * g }}
            whileTap={{ scaleX: 1 - 0.16 * g, scaleY: 1 + 0.08 * g }}
            transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.6 }}
            onPointerDown={grab}
            onDragStart={grab}
            onPointerUp={drop}
            onPointerCancel={drop}
            onDragEnd={drop}
          />
        </Liquid.Item>
      </Liquid>
    </div>
  );
}

export default DraggingBall;
