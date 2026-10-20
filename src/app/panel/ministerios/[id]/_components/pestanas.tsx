import Link from 'next/link';
import { Users, Wallet } from 'lucide-react';

import {
  esPastor,
  puede,
  puedeGestionarDesdeDentro,
  puedeGestionarMinisterio,
  puedeVerFondoDe,
  type ContextoPermisos,
} from '@/lib/auth/permisos';
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
 *
 * Y SOLO LO QUE ESA PERSONA PUEDE ABRIR
 * -------------------------------------
 * El equipo lo ve cualquiera de la iglesia; las herramientas, quien lleva el
 * ministerio. Antes las pestañas de módulo salían a todos, y a quien solo
 * miraba Turnos o Repertorio le rebotaban con «no tienes permiso» al pulsarlas.
 * Cada condición de aquí copia la del `layout.tsx` de ese módulo: si se separan,
 * vuelve el rebote o desaparece una pestaña que sí abriría.
 *
 * Quien solo mira se queda con «El equipo», y por la regla de arriba no se
 * pinta la barra.
 */
export function PestanasMinisterio({
  ctx,
  ministerio,
  activa,
}: {
  ctx: ContextoPermisos;
  ministerio: MinisterioDetalle;
  /** `'equipo'` es la pantalla base; el resto, el id del módulo. */
  activa: string;
}) {
  const base = `/panel/ministerios/${ministerio.id}`;

  // `requireGestionMinisterio`, la puerta de todos los layouts de módulo.
  const gestiona = puedeGestionarMinisterio(ctx, ministerio.id);
  // `requirePermiso('ver_seguimiento')`, la puerta de más del layout de
  // seguimiento: llevar el ministerio no basta para leer por qué alguien dejó
  // de venir.
  const veSeguimiento = esPastor(ctx) || puede(ctx, 'ver_seguimiento');
  // `requireGestionMinisterio(id, { desdeDentro: true })`, la del reparto: el
  // padrón solo lo ve el equipo, y `gestionar_ministerios` no es estar en él.
  const dentro = puedeGestionarDesdeDentro(ctx, ministerio.id);

  const herramientas = gestiona
    ? modulosActivos(ministerio.modulos).filter((m) => {
        if (m.id === 'seguimiento') return veSeguimiento;
        if (m.id === 'reparto') return dentro;
        return true;
      })
    : [];

  // El fondo no es un módulo del ministerio: sale si el pastor le vinculó uno
  // desde Finanzas. La puerta, la de `fondo/guarda.ts`: quien lo lleva desde
  // dentro y con Finanzas encendida. Al final, porque es lo que menos se abre.
  const conFondo = ministerio.conFondo && puedeVerFondoDe(ctx, ministerio.id);

  const pestanas = [
    { id: 'equipo', etiqueta: 'El equipo', href: base, Icono: Users },
    ...herramientas.map((m) => ({
      id: m.id,
      etiqueta: m.nombre,
      href: `${base}/${m.id}`,
      Icono: m.Icono,
    })),
    ...(conFondo
      ? [{ id: 'fondo', etiqueta: 'Fondo', href: `${base}/fondo`, Icono: Wallet }]
      : []),
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
