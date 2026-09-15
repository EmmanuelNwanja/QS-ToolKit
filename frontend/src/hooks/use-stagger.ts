"use client";

import { useMemo } from "react";

/**
 * Calculates staggered delays for child elements.
 * Returns a function: (index: number) => delay in seconds.
 */
export function useStagger(
  count: number,
  options: { delay?: number; from?: number; to?: number } = {}
) {
  const { delay = 0.05, from = 0, to } = options;

  const delays = useMemo(() => {
    const end = to ?? (count - 1) * delay;
    return Array.from({ length: count }, (_, i) => {
      const t = count <= 1 ? 0 : (i / (count - 1));
      return from + t * (end - from);
    });
  }, [count, delay, from, to]);

  return (index: number) => delays[Math.min(index, delays.length - 1)];
}
