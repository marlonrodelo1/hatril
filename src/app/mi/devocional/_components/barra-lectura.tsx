'use client';

import { useEffect, useRef } from 'react';

/**
 * La línea naranja de arriba que se llena mientras se lee.
 *
 * PARA QUÉ
 * --------
 * Un devocional largo en un móvil son cinco o seis pantallazos, y sin nada que
 * lo diga no se sabe si queda un párrafo o media página. La barra contesta eso
 * sin ocupar sitio (zona 2 del rediseño, 17-nov; la idea es el «Reading
 * Progress» de 21st).
 *
 * SE LLENA HASTA EL FINAL DE LA LECTURA, NO DE LA PÁGINA
 * ------------------------------------------------------
 * Debajo del devocional va el archivo de los anteriores, que puede ser largo.
 * Medida contra la página entera, la barra se quedaba a medias justo cuando ya
 * se había leído todo. Se mide contra `hasta`, el «Lo he leído» del final: la
 * barra está llena cuando ese botón asoma por encima de la barra de abajo.
 *
 * PEGADA AL BORDE DE ARRIBA DE LA PANTALLA
 * ----------------------------------------
 * Y no bajo la cabecera: su alto cambia con el subtítulo y con la zona segura
 * del iPhone, y una barra colocada a ojo debajo de ella acaba un píxel encima
 * o un píxel separada. El borde de la pantalla no se mueve.
 *
 * SIN TRANSICIÓN
 * --------------
 * La mueve el desplazamiento, cuadro a cuadro con `requestAnimationFrame`: una
 * transición encima solo la haría ir detrás del dedo. Así, además, con
 * «reducir movimiento» no hay nada que apagar. Escribe el `transform` directo
 * sobre el elemento, sin estado de React: un render por cuadro de scroll sería
 * trabajo tirado.
 *
 * Es solo para la vista: `aria-hidden`. Quien usa lector de pantalla ya sabe
 * por dónde va, y un `progressbar` que cambia sesenta veces por segundo sería
 * ruido.
 */
export function BarraLectura({ hasta }: { hasta: string }) {
  const barra = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let pendiente = 0;

    const medir = () => {
      pendiente = 0;
      const fin = document.getElementById(hasta);
      const finY = fin
        ? fin.getBoundingClientRect().bottom + window.scrollY
        : document.documentElement.scrollHeight;
      // Lo que tapa la barra de abajo de `/mi`, que lo publica ella misma.
      const tapa =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--alto-barra-mi',
          ),
        ) || 0;
      const recorrido = finY - (window.innerHeight - tapa);
      // Si todo cabe en la pantalla no hay nada que medir: vacía, no llena,
      // para que no parezca un adorno.
      const p =
        recorrido > 0 ? Math.min(1, Math.max(0, window.scrollY / recorrido)) : 0;
      if (barra.current) barra.current.style.transform = `scaleX(${p})`;
    };

    const pedir = () => {
      if (!pendiente) pendiente = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    // Cambiar el tamaño de la letra, o que cargue la foto de la portada,
    // alarga la página sin que haya scroll: hay que volver a medir.
    const observador = new ResizeObserver(pedir);
    observador.observe(document.body);

    return () => {
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      observador.disconnect();
      cancelAnimationFrame(pendiente);
    };
  }, [hasta]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-0.5"
    >
      <span
        ref={barra}
        className="block h-full origin-left bg-primary"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
