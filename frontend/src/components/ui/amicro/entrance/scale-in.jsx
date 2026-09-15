import { motion } from "framer-motion";

/**
 * Scale transition from small to actual size.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 */
export function ScaleIn({
  children,
  duration = 0.5,
  delay = 0,
  initialScale = 0.92,
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration,
        delay,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default ScaleIn;
