import { motion } from "framer-motion";

/**
 * Fade with upward translation.
 * Amicro (MIT) - converted from TSX to JSX for QSToolkit.
 */
export function FadeUp({
  children,
  duration = 0.6,
  delay = 0,
  yOffset = 20,
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default FadeUp;
