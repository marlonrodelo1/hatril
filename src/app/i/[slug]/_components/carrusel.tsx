'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * Las fotos de la iglesia, pasando solas.
 *
 * SIN LIBRERÍA
 * ------------
 * Un carrusel son dos cosas: una lista que se desplaza y unos puntos para
 * saltar. El desplazamiento lo hace el navegador con `scroll-snap`, así que solo
 * queda decidir cuándo pasar de foto. Meter aquí una dependencia de WebGL o de
 * animación para eso son cientos de kilobytes en la página que más visitas
 * sueltas recibe, y muchas desde un móvil con mala cobertura.
 *
 * SE PUEDE ARRASTRAR
 * ------------------
 * Porque es un contenedor con scroll de verdad. En un móvil se pasa con el dedo
 * sin que hayamos escrito una línea para ello, y con teclado funcionan las
 * flechas. Los carruseles hechos con `transform` pierden las dos cosas y hay que
 * reimplementarlas.
 *
 * CUÁNDO SE PARA, Y CUÁNDO NO
 * ---------------------------
 * Se para al tocarlo con el dedo y si el sistema pide menos movimiento
 * (`prefers-reduced-motion`).
 *
 * NO se para al pasar el ratón por encima, aunque es lo habitual en un carrusel
 * y así estaba escrito al principio. Ocupa el alto del hero: en un escritorio el
 * cursor cae dentro casi siempre, así que la pausa por hover dejaba el carrusel
 * congelado en la primera foto para la mayoría de las visitas. La pausa es
 * correcta en una tira pequeña dentro de un artículo; en la primera pantalla de
 * la web, no.
 */
export function CarruselIglesia({
  imagenes,
  nombre,
  children,
}: {
  imagenes: string[];
  nombre: string;
  /** El contenido del hero, que va encima de las fotos. */
  children?: React.ReactNode;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [parado, setParado] = useState(false);

  /*
   * EL SCROLL MANDA. EL ESTADO SOLO PINTA.
   *
   * Y esto costó un rato. La versión anterior guardaba la foto actual en el
   * estado y un efecto la traducía a `scrollTo({behavior:'smooth'})`. No
   * funcionaba, y el motivo es sutil: el desplazamiento suave tarda, y mientras
   * dura dispara `onScroll` decenas de veces con posiciones INTERMEDIAS. Cada
   * una recalculaba la foto actual —todavía la 0— y el efecto volvía a mandar
   * el scroll al principio. El carrusel se peleaba consigo mismo y no se movía.
   *
   * Ahora hay un solo sentido: quien quiere cambiar de foto llama a `irA()`, que
   * habla con el DOM directamente; `onScroll` solo actualiza el estado para
   * saber qué punto pintar relleno. El estado nunca vuelve a mover el scroll.
   */
  function irA(indice: number) {
    const nodo = pista.current;
    if (!nodo) return;
    nodo.scrollTo({ left: nodo.clientWidth * indice, behavior: 'smooth' });
  }

  // Pasar de foto cada cinco segundos. Con una sola no hay nada que pasar.
  useEffect(() => {
    if (imagenes.length < 2 || parado) return;

    const menosMovimiento = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (menosMovimiento) return;

    const id = setInterval(() => {
      const nodo = pista.current;
      if (!nodo || nodo.clientWidth === 0) return;
      const siguiente =
        (Math.round(nodo.scrollLeft / nodo.clientWidth) + 1) % imagenes.length;
      nodo.scrollTo({ left: nodo.clientWidth * siguiente, behavior: 'smooth' });
    }, 5000);

    return () => clearInterval(id);
  }, [imagenes.length, parado]);

  // Lo único que hace el estado: saber qué punto va relleno. Sirve igual para el
  // paso automático, para los puntos y para cuando alguien arrastra con el dedo.
  function alDesplazar() {
    const nodo = pista.current;
    if (!nodo || nodo.clientWidth === 0) return;
    setActual(Math.round(nodo.scrollLeft / nodo.clientWidth));
  }

  return (
    /*
     * EL ALTO LO MANDA EL TEXTO, NO LA FOTO
     *
     * Antes cada diapositiva medía 520px fijos y el texto iba encima en
     * `absolute`. En un móvil de 320px la descripción de la iglesia ocupa nueve
     * líneas, y el texto se salía por abajo de la foto y seguía por encima del
     * fondo crema: el titular sobre la imagen y el botón fuera. No se veía en
     * un iPhone normal, solo en los pequeños y con descripciones largas, que es
     * justo lo que escribe una iglesia cuando le dejas un campo de texto.
     *
     * Ahora el alto es un mínimo, no una medida: el contenido va en el flujo y
     * la fotografía se estira detrás con `absolute inset-0`. Si el texto crece,
     * la foto crece con él.
     *
     * Y el mínimo va en `svh` acotado con `min()`: un móvil apaisado tiene unos
     * 360px de alto, así que 460px fijos dejaban la primera pantalla sin que se
     * viera nada más que la foto.
     */
    <div
      className="relative flex min-h-[min(460px,86svh)] items-center overflow-hidden rounded-2xl border border-border md:min-h-[min(560px,84svh)] lg:min-h-[min(620px,86svh)]"
      onTouchStart={() => setParado(true)}
    >
      <div
        ref={pista}
        onScroll={alDesplazar}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${nombre}`}
      >
        {imagenes.map((url, i) => (
          <div
            key={url}
            className="relative h-full w-full flex-none snap-center"
            aria-roledescription="diapositiva"
            aria-label={`Foto ${i + 1} de ${imagenes.length}`}
          >
            <Image
              src={url}
              alt={`${nombre}, foto ${i + 1}`}
              fill
              // La primera se carga con prioridad porque es lo primero que se ve
              // al abrir la página; las demás, cuando toquen.
              priority={i === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1180px) calc(100vw - 80px), 1100px"
              className="object-cover"
            />

            {/*
             * El velo que hace legible el texto de encima.
             *
             * Un color plano al 55%, no un degradado: el sistema de diseño de
             * Hatril los descarta, y aquí además un degradado dejaría el texto
             * bien arriba y mal abajo según la foto. Plano es predecible con
             * cualquier imagen que suba la iglesia, que es lo que importa
             * cuando no controlas las fotos.
             */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[#1A1A1A]/55"
            />
          </div>
        ))}
      </div>

      {/* El contenido va FUERA del contenedor con scroll: dentro se desplazaría
          con las fotos y habría que repetirlo en cada una. El `py` de abajo deja
          sitio a los puntos para que no caigan sobre el último botón. */}
      {children && (
        <div className="relative w-full px-5 py-12 sm:px-8 md:px-12 md:py-16">
          {children}
        </div>
      )}

      {imagenes.length > 1 && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          {imagenes.map((url, i) => (
            /*
             * El punto mide 8px, pero el botón que lo contiene mide 44: es el
             * mínimo de un objetivo táctil, y estos se pulsan con el pulgar
             * sobre una foto en movimiento. Antes el área pulsable era el punto
             * mismo y fallaba una de cada dos veces.
             */
            <button
              key={url}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ver la foto ${i + 1}`}
              aria-current={i === actual}
              className="group/punto flex size-11 items-center justify-center"
            >
              <span
                className={
                  'h-2 rounded-full transition-all ' +
                  (i === actual
                    ? 'w-7 bg-white'
                    : 'w-2 bg-white/50 group-hover/punto:bg-white/80')
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
