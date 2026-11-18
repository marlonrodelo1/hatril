'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/**
 * Los filtros por situación del listado de iglesias: el segmentado de la guía
 * (pista con borde, la elegida en `bg-accent`) con un indicador que se desliza
 * de una a otra, como el subrayado de `Pestanas`.
 *
 * CADA FILTRO ES UNA URL
 * ----------------------
 * `?ver=` y no un estado de React: la página sigue siendo de servidor y sin
 * JavaScript filtra igual. Entre un filtro y otro el componente sigue montado
 * (Next 16 no cuenta los `searchParams` en la clave de estado del segmento),
 * pero no al volver desde la ficha o al recargar. Así que, como `Pestanas`,
 * guarda la última posición en `sessionStorage`, se coloca ahí sin transición
 * y en el fotograma siguiente viaja a la nueva: el mismo camino sirve para los
 * dos casos.
 *
 * SIN JAVASCRIPT, TAMBIÉN SE VE CUÁL ES
 * -------------------------------------
 * El servidor pinta la elegida con su propio fondo. Al hidratar, el indicador
 * se pone exactamente encima, del mismo color, y solo entonces la elegida
 * suelta el suyo: el cambio no se ve, y quien no tiene JavaScript sigue viendo
 * cuál está marcada. Con «reducir movimiento» el indicador aparece en su sitio
 * y ya está.
 *
 * En el móvil la fila se desliza de lado, sin barra, y la elegida se trae a la
 * vista al entrar: «Suspendidas» es la última y a 375 px queda fuera.
 */
export type FiltroIglesias = {
  id: string;
  etiqueta: string;
  n: number;
  href: string;
};

type Posicion = { x: number; ancho: number };

const ALMACEN = 'hatril:filtros:admin-iglesias';

export function FiltrosIglesias({
  items,
  activo,
}: {
  items: FiltroIglesias[];
  activo: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const pistaRef = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<(Posicion & { animar: boolean }) | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const act = pistaRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !act) return;

    const medir = (): Posicion => ({ x: act.offsetLeft, ancho: act.offsetWidth });
    const nueva = medir();

    // La elegida, a la vista dentro de la fila que se desliza. `scrollLeft` y
    // no `scrollIntoView`, que movería también la página entera.
    if (nav.scrollWidth > nav.clientWidth) {
      const rn = nav.getBoundingClientRect();
      const ra = act.getBoundingClientRect();
      if (ra.left < rn.left || ra.right > rn.right) {
        nav.scrollLeft += ra.left - rn.left - 16;
      }
    }

    let anterior: Posicion | null = null;
    try {
      const crudo = window.sessionStorage.getItem(ALMACEN);
      anterior = crudo ? (JSON.parse(crudo) as Posicion) : null;
      window.sessionStorage.setItem(ALMACEN, JSON.stringify(nueva));
    } catch {
      anterior = null;
    }

    // Si la letra termina de cargar, la elegida cambia de medida: el indicador
    // la sigue, sin animar. El primer aviso del vigía llega solo por empezar a
    // mirar, y se ignora: si no, cortaría el viaje de la posición anterior a
    // la nueva justo cuando empieza.
    let primero = true;
    const vigia = new ResizeObserver(() => {
      if (primero) {
        primero = false;
        return;
      }
      setMarca({ ...medir(), animar: false });
    });
    vigia.observe(act);

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!anterior || quieto || (anterior.x === nueva.x && anterior.ancho === nueva.ancho)) {
      setMarca({ ...nueva, animar: false });
      return () => vigia.disconnect();
    }

    setMarca({ ...anterior, animar: false });
    const marco = requestAnimationFrame(() =>
      requestAnimationFrame(() => setMarca({ ...nueva, animar: true })),
    );
    return () => {
      cancelAnimationFrame(marco);
      vigia.disconnect();
    };
  }, [activo]);

  return (
    <nav
      ref={navRef}
      aria-label="Filtrar por situación"
      className="-mx-4 flex overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <div
        ref={pistaRef}
        className="relative flex flex-none gap-1 rounded-xl border border-border bg-surface p-1"
      >
        {marca && (
          <span
            aria-hidden
            className={clsx(
              'pointer-events-none absolute top-1 bottom-1 left-0 rounded-lg bg-accent',
              marca.animar &&
                'transition-[transform,width] duration-240 ease-hatril motion-reduce:transition-none',
            )}
            style={{ width: marca.ancho, transform: `translateX(${marca.x}px)` }}
          />
        )}
        {items.map((f) => {
          const elegido = f.id === activo;
          return (
            <Link
              key={f.id}
              href={f.href}
              scroll={false}
              aria-current={elegido ? 'page' : undefined}
              className={clsx(
                'relative z-[1] flex h-8 flex-none items-center gap-1.5 rounded-lg px-3 text-label font-semibold whitespace-nowrap no-underline transition-colors duration-150 hover:no-underline motion-reduce:transition-none',
                elegido
                  ? 'text-accent-foreground hover:text-accent-foreground'
                  : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground',
                // El fondo propio, solo hasta que el indicador está encima.
                elegido && !marca && 'bg-accent',
              )}
            >
              {f.etiqueta}
              <span className="font-medium tabular-nums">{f.n}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
