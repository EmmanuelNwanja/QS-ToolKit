import { motion } from "framer-motion";

/**
 * Reveal content block as it scrolls into viewport.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 */
export function ScrollReveal({
  children,
  duration = 0.6,
  yOffset = 30,
  xOffset = 0,
  scale = 0.95,
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, x: xOffset, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{
        duration,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default ScrollReveal;
