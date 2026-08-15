"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Devuelve un valor `progress` 0..1 que indica cuánto ha entrado al viewport
 * el elemento referenciado. 0 = el top del elemento aún está debajo del
 * viewport, 1 = el centro del elemento ha alcanzado el centro del viewport.
 *
 * Se usa para aplicar transformaciones 3D (rotateX, scale, translateY) que
 * dependen del scroll, como en la sección "Cómo funciona" de la landing.
 */
export function useScrollTilt(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = 1 - Math.max(0, Math.min(1, (rect.top + rect.height * 0.4) / vh));
      setProgress(p);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [ref]);

  return progress;
}
