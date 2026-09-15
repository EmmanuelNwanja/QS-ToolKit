"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Calculates current scroll progress as a percentage (0–100).
 * Works on window or a specific container element.
 */
export function useScrollProgress(
  containerRef?: React.RefObject<HTMLElement>
) {
  const [progress, setProgress] = useState(0);

  const measure = useCallback(() => {
    const el = containerRef?.current;
    if (!el) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const max = scrollHeight - clientHeight;
    setProgress(max > 0 ? (scrollTop / max) * 100 : 0);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef?.current || window;
    el.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => el.removeEventListener("scroll", measure);
  }, [measure, containerRef]);

  return progress;
}
