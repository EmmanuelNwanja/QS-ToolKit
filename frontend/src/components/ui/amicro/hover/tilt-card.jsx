import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * 3D parallax tilt effect following mouse cursor.
 * Amicro (MIT) — converted from TSX to JSX for QSToolkit.
 *
 * QSToolkit: use on feature cards, pricing cards, or any card
 * that benefits from depth/interaction on hover.
 */
export function TiltCard({
  children,
  maxTilt = 15,
  className = "",
  cardClassName = "",
}) {
  const cardRef = useRef(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), springConfig);

  const handleMouseMove = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(relativeX);
    y.set(relativeY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full cursor-pointer ${className}`}
      style={{ perspective: "800px" }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`w-full h-full rounded-2xl border border-gray-200/20 shadow-lg flex items-center justify-center p-6 select-none ${cardClassName}`}
      >
        <div style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }} className="w-full h-full flex flex-col justify-center items-center">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default TiltCard;
