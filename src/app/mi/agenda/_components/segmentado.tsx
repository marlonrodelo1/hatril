'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef } from 'react';
import { clsx } from 'clsx';

/**
 * Día / Semana / Mes, con una pastilla que se desliza a la opción elegida.
 *
 * SON ENLACES, NO BOTONES
 * -----------------------
 * La vista viaja en la URL (`?v=`), así que cada opción es un `<Link>` y la
 * pantalla se vuelve a pintar en el servidor. Funciona sin JavaScript y el
 * enlace se puede compartir tal cual; la pastilla es lo único que pide cliente.
 *
 * LA PASTILLA RECUERDA DE DÓNDE VIENE
 * -----------------------------------
 * Igual que el subrayado de `Pestanas`: si Next vuelve a montar el componente
 * al cambiar la URL, no sabe dónde estaba la pastilla y aparecería de golpe en
 * su sitio nuevo. Guarda su última posición en `sessionStorage`, se coloca ahí
 * sin transición y desde ahí viaja a la nueva. Si Next lo conserva montado, el
 * recorrido es el mismo y sale igual.
 *
 * Aquí no hace falta medir nada, al revés que en las pestañas: las tres
 * opciones miden un tercio cada una, así que la posición es el índice.
 *
 * Sin `sessionStorage` (navegación privada) o con «reducir movimiento», la
 * pastilla aparece en su sitio y ya está.
 */
export type Vista = 'dia' | 'semana' | 'mes';

const OPCIONES: { id: Vista; texto: string }[] = [
  { id: 'dia', texto: 'Día' },
  { id: 'semana', texto: 'Semana' },
  { id: 'mes', texto: 'Mes' },
];

const ALMACEN = 'hatril:segmentado:agenda';

export function Segmentado({ vista, ancla }: { vista: Vista; ancla: string }) {
  const indice = Math.max(
    0,
    OPCIONES.findIndex((o) => o.id === vista),
  );

  const pastilla = useRef<HTMLSpanElement>(null);

  /*
   * EL VIAJE SE HACE EN EL DOM, NO EN EL ESTADO
   *
   * React ya pinta la pastilla en su sitio (y así sale del servidor: sin
   * JavaScript está bien puesta, solo que no viaja). El efecto solo la lleva un
   * instante a donde estaba, sin transición, y la suelta hacia la nueva. Con
   * estado serían dos renders más por cada toque para mover un `transform`,
   * que es justo lo que React desaconseja hacer en un efecto.
   *
   * `useLayoutEffect` y no `useEffect`: corre antes de pintar, así que el
   * fotograma con la pastilla ya en su sitio nuevo no llega a verse.
   */
  useLayoutEffect(() => {
    const el = pastilla.current;
    if (!el) return;

    let anterior: number | null = null;
    try {
      const crudo = window.sessionStorage.getItem(ALMACEN);
      anterior = crudo === null ? null : Number(crudo);
      window.sessionStorage.setItem(ALMACEN, String(indice));
    } catch {
      anterior = null;
    }

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      anterior === null ||
      !Number.isInteger(anterior) ||
      anterior < 0 ||
      anterior >= OPCIONES.length ||
      anterior === indice ||
      quieto
    ) {
      return;
    }

    el.style.transition = 'none';
    el.style.transform = posicion(anterior);
    // Leer una medida obliga al navegador a colocar la pastilla en el punto de
    // partida ahora; sin esto juntaría los dos cambios y no habría viaje.
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = posicion(indice);
  }, [indice]);

  return (
    <nav
      aria-label="Cómo ver la agenda"
      className="relative grid grid-cols-3 rounded-xl border border-border bg-surface p-1"
    >
      {/* Debajo de los enlaces, del ancho de una opción. `bg-accent` con
          `text-accent-foreground` encima, la pareja de «lo elegido» en toda
          la aplicación (guía, «Pestañas, segmentado y opción elegida»). */}
      <span
        ref={pastilla}
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-accent',
          'transition-transform duration-240 ease-hatril motion-reduce:transition-none',
        )}
        style={{ transform: posicion(indice) }}
      />

      {OPCIONES.map((o) => {
        const elegida = o.id === vista;
        return (
          <Link
            key={o.id}
            href={`/mi/agenda?v=${o.id}&d=${ancla}`}
            scroll={false}
            aria-current={elegida ? 'true' : undefined}
            className={clsx(
              'relative flex h-9 items-center justify-center rounded-lg text-label font-semibold no-underline transition-colors duration-150 hover:no-underline motion-reduce:transition-none',
              elegida
                ? 'text-accent-foreground hover:text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.texto}
          </Link>
        );
      })}
    </nav>
  );
}

/** Cada opción mide un tercio, y `translateX` en % cuenta el ancho propio. */
function posicion(indice: number): string {
  return `translateX(${indice * 100}%)`;
}
