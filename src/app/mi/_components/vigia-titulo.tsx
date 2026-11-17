'use client';

import { useEffect, useRef } from 'react';

/**
 * Avisa a la cabecera de `/mi` de cuándo el título grande se ha ido por
 * arriba, para que el chico aparezca en la barra (`CabeceraMiembro`).
 *
 * Es un punto de un píxel al final del bloque del título. Cuando pasa por
 * debajo de la cabecera pegajosa (unos 64 px), la cabecera pasa a
 * `data-recogida="si"`; al volver a verse, a `"no"`. Con un IntersectionObserver
 * y no con el evento de scroll: no corre en cada fotograma.
 */
export function VigiaTitulo() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const punto = ref.current;
    const cabecera = document.querySelector<HTMLElement>('[data-cabecera-miembro]');
    if (!punto || !cabecera || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;
        cabecera.dataset.recogida =
          !entrada.isIntersecting && entrada.boundingClientRect.top < 64
            ? 'si'
            : 'no';
      },
      { rootMargin: '-64px 0px 0px 0px' },
    );
    io.observe(punto);
    return () => io.disconnect();
  }, []);

  return <span ref={ref} aria-hidden className="block h-px" />;
}
