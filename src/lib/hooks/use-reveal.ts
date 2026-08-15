"use client";

import { useEffect } from "react";

/**
 * Activa la animación de entrada de los elementos con clase `.reveal`.
 * Usa IntersectionObserver — al entrar al viewport con threshold 0.12,
 * añade la clase `.in` (CSS transitions definidas en globals.css).
 *
 * Soporta retraso por elemento via `data-delay="<ms>"`.
 *
 * Llamar UNA vez en el wrapper cliente del page.
 */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (els.length === 0) return;

    // Activar el modo animado solo cuando JS está corriendo. Sin esta clase
    // los .reveal son visibles por defecto (fallback para no-JS / hidratación lenta).
    document.body.classList.add("js-reveal-active");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const target = e.target as HTMLElement;
            const delay = parseInt(target.dataset.delay || "0", 10);
            window.setTimeout(() => target.classList.add("in"), delay);
            io.unobserve(target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.body.classList.remove("js-reveal-active");
    };
  }, []);
}
