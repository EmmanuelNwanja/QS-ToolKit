import { motion } from "framer-motion";

/**
 * Basic fade entrance animation.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 */
export function FadeIn({
  children,
  duration = 0.5,
  delay = 0,
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration,
        delay,
        ease: [0.215, 0.61, 0.355, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default FadeIn;
