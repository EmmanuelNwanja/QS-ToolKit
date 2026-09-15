import { motion } from "framer-motion";

/**
 * Scale transition combined with deep blur/depth effect.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 */
export function ZoomIn({
  children,
  duration = 0.7,
  delay = 0,
  initialScale = 0.85,
  initialBlur = "12px",
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale, filter: `blur(${initialBlur})` }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
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

export default ZoomIn;
