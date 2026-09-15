import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Horizontal page scroll progress indicator bar.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 *
 * QSToolkit: branded with primary-700 color.
 */
export function ProgressIndicator({
  height = 4,
  className = "",
}) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        scaleX,
        height,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        originX: 0,
        zIndex: 9999,
      }}
      className={`bg-primary-700 ${className}`}
    />
  );
}

export default ProgressIndicator;
