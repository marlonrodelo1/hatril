import Link from 'next/link';
import { Users } from 'lucide-react';

import { modulosActivos } from '@/lib/ministerios/modulos';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';

/**
 * Las pestañas de un ministerio: el equipo, y una por herramienta encendida.
 *
 * SOLO SALE LO QUE ESE MINISTERIO TIENE
 * -------------------------------------
 * Es la misma regla que `panel/secciones.ts` aplicada un nivel más abajo. Un
 * ministerio de ujieres no enseña una pestaña de seguimiento en gris con un
 * candado: no la enseña. Enseñar lo que no se puede usar convierte un producto
 * que funciona en un catálogo de cosas que faltan.
 *
 * Con un solo módulo encendido no se pinta nada: dos pestañas donde una es
 * «Equipo» y la otra la única herramienta no son una navegación, son dos
 * enlaces. El componente decide eso solo, para que ninguna pantalla tenga que
 * acordarse.
 */
export function PestanasMinisterio({
  ministerio,
  activa,
}: {
  ministerio: MinisterioDetalle;
  /** `'equipo'` es la pantalla base; el resto, el id del módulo. */
  activa: string;
}) {
  const base = `/panel/ministerios/${ministerio.id}`;

  const pestanas = [
    { id: 'equipo', etiqueta: 'El equipo', href: base, Icono: Users },
    ...modulosActivos(ministerio.modulos).map((m) => ({
      id: m.id,
      etiqueta: m.nombre,
      href: `${base}/${m.id}`,
      Icono: m.Icono,
    })),
  ];

  if (pestanas.length < 2) return null;

  return (
    <nav
      aria-label="Secciones del ministerio"
      // `overflow-x-auto` y no envolver: con cinco módulos encendidos en un
      // móvil, las pestañas partidas en dos filas dejan de leerse como una fila
      // de pestañas. Aquí se desliza, que es lo que la gente espera de esto.
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5"
    >
      {pestanas.map((p) => {
        const esActiva = p.id === activa;
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={esActiva ? 'page' : undefined}
            className={
              'inline-flex flex-none items-center gap-2 rounded-lg border px-3.5 py-2 text-[14px] font-semibold no-underline transition-colors hover:no-underline ' +
              (esActiva
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border bg-surface text-muted-foreground hover:bg-surface-alt hover:text-foreground')
            }
          >
            <p.Icono className="size-4" strokeWidth={1.9} aria-hidden />
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
