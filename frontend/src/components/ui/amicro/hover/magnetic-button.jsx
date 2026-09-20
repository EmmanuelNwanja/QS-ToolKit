import { useRef } from "react";
import { motion, useSpring } from "framer-motion";

/**
 * A button that pulls slightly towards the user's cursor.
 * Amicro (MIT) - converted from TSX to JSX for QSToolkit.
 *
 * QSToolkit: use on primary CTAs, "Get Started" buttons,
 * or any button that benefits from magnetic pull feedback.
 */
export function MagneticButton({
  children,
  range = 45,
  strength = 0.35,
  className = "",
  onClick,
}) {
  const ref = useRef(null);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.6 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const dist = Math.hypot(clientX - centerX, clientY - centerY);

    if (dist < range) {
      x.set((clientX - centerX) * strength);
      y.set((clientY - centerY) * strength);
    } else {
      x.set(0);
      y.set(0);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x, y }}
      className={`relative inline-flex items-center justify-center rounded-full bg-primary-700 text-white font-semibold text-sm h-11 px-6 shadow hover:scale-[1.03] transition-all cursor-pointer select-none border-0 ${className}`}
    >
      <span className="relative z-10 block pointer-events-none">{children}</span>
    </motion.button>
  );
}

export default MagneticButton;
