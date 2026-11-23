'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un número que sube desde cero la primera vez que aparece en pantalla.
 *
 * QUIETO DE ENTRADA
 * -----------------
 * El servidor lo pinta ya con su valor final, y así se queda si no hay
 * JavaScript, si el móvil pide reducir movimiento o si la tarjeta nunca llega
 * a verse. Solo al entrar en pantalla por primera vez cuenta de 0 a su valor,
 * en 0,9 s: un número que arranca en 0 y se queda en 0 hasta que se mira sería
 * una cifra falsa en la primera captura.
 */
export function CuentaQueSube({
  valor,
  miles = false,
}: {
  valor: number;
  /** Con separador de miles a la colombiana y española (2.450.000). */
  miles?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mostrado, setMostrado] = useState(valor);
  const formato = (n: number) =>
    miles ? Math.round(n).toLocaleString('es-CO') : String(Math.round(n));

  useEffect(() => {
    const el = ref.current;
    if (!el || valor === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    let marco = 0;
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const paso = (t: number) => {
          const p = Math.min(1, (t - t0) / 900);
          setMostrado(valor * (1 - Math.pow(1 - p, 3)));
          if (p < 1) marco = requestAnimationFrame(paso);
        };
        marco = requestAnimationFrame(paso);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(marco);
    };
  }, [valor]);

  return (
    <span ref={ref} className="tabular-nums">
      {formato(mostrado)}
    </span>
  );
}
