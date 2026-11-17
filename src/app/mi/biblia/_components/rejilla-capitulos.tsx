import Link from 'next/link';
import { clsx } from 'clsx';

import type { Libro } from '@/lib/biblia/libros';

/**
 * Los números de capítulo de un libro, en rejilla.
 *
 * Rejilla de números y no una lista: Salmos tiene 150 y en lista serían diez
 * pantallazos de scroll para llegar al 119.
 *
 * La usan dos sitios: la pantalla de un libro (`?libro=salmos`) y la hoja que
 * abre el nombre del capítulo, para saltar a otro sin volver atrás. Es la misma
 * pieza para que el 23 se vea igual en las dos y un arreglo valga para ambas.
 * Sin `'use client'`: en la pantalla del libro se pinta en el servidor, y en la
 * hoja la importa un componente de cliente.
 *
 * El capítulo en el que se está, `actual`, va como lo elegido en toda la
 * aplicación: naranja suave con su letra (guía visual, «Pestañas, segmentado
 * y opción elegida»). Y con `aria-current`, que es lo que lo anuncia.
 */
export function RejillaCapitulos({
  libro,
  actual,
  alElegir,
}: {
  libro: Pick<Libro, 'slug' | 'nombre' | 'capitulos'>;
  actual?: number;
  /** Para cerrar la hoja al saltar: el componente sigue montado al navegar. */
  alElegir?: () => void;
}) {
  return (
    <ol
      aria-label={`Capítulos de ${libro.nombre}`}
      className="grid grid-cols-6 gap-2 sm:grid-cols-8"
    >
      {Array.from({ length: libro.capitulos }, (_, i) => i + 1).map((n) => {
        const esta = n === actual;
        return (
          <li key={n}>
            <Link
              href={`/mi/biblia?libro=${libro.slug}&cap=${n}`}
              onClick={alElegir}
              aria-current={esta ? 'page' : undefined}
              className={clsx(
                'flex h-11 items-center justify-center rounded-lg border text-body font-semibold tabular-nums no-underline transition-colors duration-150 hover:no-underline motion-reduce:transition-none',
                esta
                  ? 'border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground'
                  : 'border-border bg-surface text-foreground hover:bg-surface-alt hover:text-foreground',
              )}
            >
              {n}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
