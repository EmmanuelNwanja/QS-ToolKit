import { motion } from "framer-motion";

/**
 * Loading skeleton with smooth shimmer sweep.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 *
 * QSToolkit: use for content placeholders while data loads.
 */
export function Skeleton({
  className = "",
  shimmerColor = "dark",
}) {
  const isDark = shimmerColor === "dark";

  const shimmerGradient = isDark
    ? "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0) 100%)";

  return (
    <div
      className={`relative overflow-hidden rounded-md bg-gray-200/50 ${className}`}
    >
      <motion.div
        initial={{ x: "-150%" }}
        animate={{ x: "150%" }}
        transition={{
          repeat: Infinity,
          duration: 1.6,
          ease: "easeInOut",
        }}
        style={{
          background: shimmerGradient,
        }}
        className="absolute inset-0 w-[80%] h-full"
      />
    </div>
  );
}

export default Skeleton;
