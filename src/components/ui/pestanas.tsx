'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Pestañas de sección: texto con un subrayado naranja que viaja a la elegida.
 *
 * Eran botones con borde (las del ministerio), y parecían acciones, no un
 * sitio donde se está. Marlon aprobó el cambio en la presentación de la base
 * común (17-nov).
 *
 * EL SUBRAYADO VIAJA AUNQUE LA PÁGINA CAMBIE
 * ------------------------------------------
 * Cada pestaña es una página distinta, así que el componente se monta de nuevo
 * en cada una y no recuerda dónde estaba. Para que el subrayado se deslice en
 * vez de aparecer, guarda su última posición en `sessionStorage` con una
 * `clave` por grupo de pestañas: al montarse se coloca ahí sin transición y en
 * el siguiente fotograma viaja a la nueva. Sin `sessionStorage` (navegación
 * privada) o con «reducir movimiento», aparece en su sitio y ya está.
 */
export type Pestana = {
  id: string;
  etiqueta: string;
  href: string;
  icono?: ReactNode;
};

type Posicion = { x: number; ancho: number };

export function Pestanas({
  items,
  activa,
  etiqueta,
  clave,
}: {
  items: Pestana[];
  activa: string;
  /** El nombre del grupo para un lector: «Secciones del ministerio». */
  etiqueta: string;
  /** Para recordar la posición entre páginas: «ministerio». */
  clave: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [raya, setRaya] = useState<(Posicion & { animar: boolean }) | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const act = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !act) return;

    const nueva = { x: act.offsetLeft, ancho: act.offsetWidth };
    const almacen = `hatril:pestanas:${clave}`;
    let anterior: Posicion | null = null;
    try {
      const crudo = window.sessionStorage.getItem(almacen);
      anterior = crudo ? (JSON.parse(crudo) as Posicion) : null;
      window.sessionStorage.setItem(almacen, JSON.stringify(nueva));
    } catch {
      anterior = null;
    }

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!anterior || quieto || anterior.x === nueva.x) {
      setRaya({ ...nueva, animar: false });
      return;
    }

    setRaya({ ...anterior, animar: false });
    const marco = requestAnimationFrame(() =>
      requestAnimationFrame(() => setRaya({ ...nueva, animar: true })),
    );
    return () => cancelAnimationFrame(marco);
  }, [activa, clave]);

  return (
    <nav
      ref={navRef}
      aria-label={etiqueta}
      className="relative -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((p) => {
        const esActiva = p.id === activa;
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={esActiva ? 'page' : undefined}
            className={clsx(
              'inline-flex h-11 flex-none items-center gap-2 px-3 text-body font-semibold no-underline transition-colors duration-150 hover:no-underline',
              esActiva
                ? 'text-foreground hover:text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.icono}
            {p.etiqueta}
          </Link>
        );
      })}
      {raya && (
        <span
          aria-hidden
          className={clsx(
            'pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary',
            raya.animar &&
              'transition-[transform,width] duration-240 ease-hatril motion-reduce:transition-none',
          )}
          style={{ width: raya.ancho, transform: `translateX(${raya.x}px)` }}
        />
      )}
    </nav>
  );
}
