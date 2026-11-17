'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';

const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

function suscribirMovimiento(avisar: () => void) {
  const consulta = window.matchMedia(MENOS_MOVIMIENTO);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}
function pideMenosMovimiento() {
  return window.matchMedia(MENOS_MOVIMIENTO).matches;
}
// «¿Ya se ha hidratado?» sin un `setState` dentro de un efecto: en el servidor
// y durante la hidratación vale `false`, y justo después, `true`.
const sinSuscripcion = () => () => {};
const siempre = () => true;
const nunca = () => false;

/**
 * Cada cuánto cambia la foto. Tiene que coincidir con la duración de
 * `.iglesia-foto-barra` en `globals.css`: con movimiento, el reloj ES esa
 * animación (ver más abajo), y esto solo cuenta cuando no la hay.
 */
const DURACION_MS = 6000;

/** Lo que tiene que recorrer el dedo en horizontal para que cuente como pasar
 *  de foto y no como el temblor de quien empieza a desplazarse hacia abajo. */
const DESLIZAR_PX = 48;

/**
 * Las fotos de la iglesia, de borde a borde, cambiando solas.
 *
 * ERA UN CARRUSEL QUE SE DESPLAZABA Y AHORA ES UN FUNDIDO
 * -------------------------------------------------------
 * Antes era un contenedor con `scroll-snap` dentro de una tarjeta con margen y
 * tres puntos debajo. Marlon aprobó (17-nov, zona 3 del rediseño) la foto a
 * sangre, a casi toda la altura del móvil, con un fundido y un acercamiento
 * lento, y unas barras como las de las historias de Instagram que dicen cuál
 * va y cuánto le queda. Los puntos no decían ninguna de las dos cosas: ni que
 * las fotos cambiaban solas ni cuándo.
 *
 * Lo que se pierde del desplazamiento —arrastrar con el dedo— se recupera con
 * un gesto horizontal sencillo. Sin librería, como antes: un fundido son dos
 * opacidades y una transición.
 *
 * EL RELOJ ES LA ANIMACIÓN DE LA BARRA, NO UN `setInterval`
 * ---------------------------------------------------------
 * La barra se llena con una animación CSS de seis segundos, y al terminar
 * (`animationend`) pasa a la siguiente foto. Con un temporizador aparte, los
 * dos relojes se separan en cuanto el navegador frena la pestaña en segundo
 * plano: se volvía y la foto cambiaba con la barra a medias. Así no pueden
 * discrepar, y pausar es pausar la animación.
 *
 * CON «REDUCIR MOVIMIENTO»
 * ------------------------
 * Ni acercamiento ni barra que se llena: la actual se pinta llena y las fotos
 * cambian igual cada seis segundos, con un temporizador porque ya no hay
 * animación que avise. El fundido se queda, y es a propósito: cambiar de
 * opacidad no es moverse, y sin él cada cambio sería un fogonazo, que es peor
 * para quien pidió menos estímulos.
 *
 * CUÁNDO SE PARA
 * --------------
 * Mientras hay un dedo encima, como en las historias. NO al pasar el ratón: el
 * carrusel ocupa toda la primera pantalla, en un escritorio el cursor cae
 * dentro casi siempre, y la pausa por hover lo dejaba congelado en la primera
 * foto para la mayoría de las visitas (así estuvo escrito al principio).
 */
export function CarruselIglesia({
  imagenes,
  nombre,
  children,
}: {
  imagenes: string[];
  nombre: string;
  /** El texto de la portada, que va encima de las fotos. */
  children?: React.ReactNode;
}) {
  const total = imagenes.length;
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  // Hasta hidratar no se sabe si el sistema pide menos movimiento, y la barra
  // no arranca: si arrancara en el HTML del servidor y la hidratación tardara
  // más de seis segundos —un móvil viejo con mala cobertura—, el `animationend`
  // llegaría antes que el oyente y el carrusel se quedaría en la primera foto.
  const montado = useSyncExternalStore(sinSuscripcion, siempre, nunca);
  const reducido = useSyncExternalStore(
    suscribirMovimiento,
    pideMenosMovimiento,
    nunca,
  );
  const acercamientos = useRef<(HTMLDivElement | null)[]>([]);
  const primeraVez = useRef(true);
  const toque = useRef<{ x: number; y: number } | null>(null);

  function ir(indice: number) {
    setActual(((indice % total) + total) % total);
  }

  // Sin animación no hay `animationend` que avise: aquí manda un temporizador.
  useEffect(() => {
    if (!montado || !reducido || total < 2 || pausado) return;
    const id = setTimeout(() => {
      setActual((a) => (a + 1) % total);
    }, DURACION_MS);
    return () => clearTimeout(id);
  }, [montado, reducido, total, pausado, actual]);

  /*
   * El acercamiento vuelve a empezar en la foto que ENTRA.
   *
   * Todas las fotos llevan la animación siempre puesta, y no solo la activa,
   * por la que SALE: si se le quitara la clase al dejar de ser la actual,
   * volvería de golpe a su tamaño mientras se funde, y ese salto se ve. Así
   * termina su acercamiento tranquila y la que entra arranca desde el
   * principio. La primera vez no se toca: ya empezó a crecer con la página.
   */
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const nodo = acercamientos.current[actual];
    if (!nodo) return;
    nodo.classList.remove('iglesia-foto-acerca');
    void nodo.offsetWidth;
    nodo.classList.add('iglesia-foto-acerca');
  }, [actual]);

  function alTocar(e: React.TouchEvent) {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
    setPausado(true);
  }

  function alSoltar(e: React.TouchEvent) {
    setPausado(false);
    const inicio = toque.current;
    toque.current = null;
    if (!inicio || total < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x;
    const dy = t.clientY - inicio.y;
    // Claramente horizontal: quien baja la página también mueve el dedo un
    // poco a los lados, y eso no puede cambiarle la foto.
    if (Math.abs(dx) > DESLIZAR_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      ir(actual + (dx < 0 ? 1 : -1));
    }
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
     * 84svh y no más: es «casi toda la altura», y lo que queda abajo deja asomar
     * el título de los horarios, que es lo que dice que la página sigue. En un
     * móvil apaisado (unos 360px de alto) el mínimo se queda corto y manda el
     * texto, que es lo que tiene que pasar. En escritorio se acota para que un
     * monitor alto no sea solo foto.
     *
     * `bg-support` debajo de todo: mientras la foto no ha llegado, el texto
     * blanco tiene un fondo oscuro sobre el que leerse.
     */
    <div
      className="relative isolate flex min-h-[84svh] flex-col justify-end overflow-hidden bg-support text-white md:min-h-[min(84svh,760px)] xl:min-h-[min(86svh,820px)]"
      aria-roledescription="carrusel"
      aria-label={`Fotos de ${nombre}`}
      onTouchStart={alTocar}
      onTouchEnd={alSoltar}
      onTouchCancel={() => {
        toque.current = null;
        setPausado(false);
      }}
    >
      {imagenes.map((url, i) => (
        <div
          key={url}
          aria-hidden={i !== actual}
          className={clsx(
            // 900 ms y no los 360 de la base común: entre dos fotos, un fundido
            // de un tercio de segundo se lee como un corte. Es el del prototipo
            // aprobado.
            'absolute inset-0 -z-10 transition-opacity duration-900 ease-hatril',
            i === actual ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div
            ref={(nodo) => {
              acercamientos.current[i] = nodo;
            }}
            className="iglesia-foto-acerca absolute inset-0"
            style={
              pausado && i === actual
                ? { animationPlayState: 'paused' }
                : undefined
            }
          >
            <Image
              src={url}
              alt={`${nombre}, foto ${i + 1}`}
              fill
              // La primera es lo primero que se ve al abrir la página (el LCP):
              // va con prioridad. Las demás se cargan solas, porque aunque
              // estén transparentes caen dentro de la pantalla.
              preload={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </div>
      ))}

      {/*
       * El velo que hace legible el texto de encima.
       *
       * Un color plano al 55%, no un degradado: el sistema de diseño de Hatril
       * los descarta, y aquí además un degradado dejaría el texto bien arriba y
       * mal abajo según la foto. Plano es predecible con cualquier imagen que
       * suba la iglesia, que es lo que importa cuando no controlas las fotos.
       *
       * Negro al 55 % y no el `velo` de las ventanas (carbón al 42 %): sobre el
       * peor punto posible de una foto, el blanco puro, el texto blanco se queda
       * en 4.75:1 con este y no llega a 3.5 con aquel. Uno solo para todas las
       * fotos y no uno por foto: con el fundido, dos velos superpuestos
       * oscurecían el doble a mitad del cambio.
       */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />

      {/*
       * El contenido, alineado con la cabecera y con las secciones de abajo.
       *
       * El relleno de arriba es el alto de la cabecera más aire: la cabecera va
       * encima de la foto, y en una pantalla baja el texto no puede meterse
       * debajo de ella. El de abajo es corto cuando hay barras, que ya traen
       * su propio aire; con una sola foto no las hay, y el último botón se
       * quedaba a ocho píxeles del borde de la foto.
       */}
      <div
        className={clsx(
          'mx-auto flex w-full max-w-[1180px] flex-col px-4 pt-[calc(4rem+env(safe-area-inset-top)+1.5rem)] sm:px-5 md:px-10 xl:pt-[calc(5rem+env(safe-area-inset-top)+2rem)]',
          total > 1 ? 'pb-2 md:pb-6' : 'pb-6 md:pb-12',
        )}
      >
        {children}

        {total > 1 && (
          <div
            role="group"
            aria-label="Elegir foto"
            className="mt-4 grid gap-1.5 md:mt-6"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
          >
            {imagenes.map((url, i) => (
              /*
               * La barra mide 3px, pero el botón que la contiene mide 36 de
               * alto y un tercio del ancho: se pulsa con el pulgar sobre una
               * foto en movimiento. Con los puntos de antes, el área pulsable
               * era el punto mismo y fallaba una de cada dos veces.
               */
              <button
                key={url}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver la foto ${i + 1} de ${total}`}
                aria-current={i === actual ? 'true' : undefined}
                className="flex h-9 cursor-pointer items-center"
              >
                <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/35">
                  <span
                    onAnimationEnd={(e) => {
                      if (
                        e.animationName === 'iglesia-foto-barra' &&
                        i === actual
                      ) {
                        ir(i + 1);
                      }
                    }}
                    className={clsx(
                      'block h-full w-full origin-left bg-white',
                      i < actual && 'scale-x-100',
                      i > actual && 'scale-x-0',
                      i === actual &&
                        (!montado
                          ? 'scale-x-0'
                          : reducido
                            ? 'scale-x-100'
                            : 'iglesia-foto-barra'),
                    )}
                    style={
                      pausado && i === actual
                        ? { animationPlayState: 'paused' }
                        : undefined
                    }
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
