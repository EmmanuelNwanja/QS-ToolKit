import { motion } from "framer-motion";

/**
 * Bouncing dots loading animation.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 *
 * QSToolkit: use as a lightweight inline loading indicator.
 */
export function BouncingDots() {
  return (
    <div className="flex space-x-2 h-12 items-end pb-2 border-b-2 border-gray-200 w-16 justify-center relative">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 bg-gray-800 rounded-full absolute bottom-2"
          style={{ left: `${i * 14 + 10}px` }}
          animate={{ y: [0, -20, 0], scaleY: [0.8, 1.1, 0.8] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default BouncingDots;
