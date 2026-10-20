import Link from 'next/link';

/**
 * Hoy · Padrón · Historial, debajo de las pestañas del ministerio.
 *
 * Un control segmentado y no tres pestañas más: las del ministerio dicen qué
 * herramienta, y esto dice qué parte de ESA herramienta. Con las dos filas
 * iguales no se distingue cuál manda. A ancho completo en el móvil, que es
 * donde se usa la puerta, para que cada parte sea un blanco de dedo entero.
 */
const PARTES = [
  { id: 'hoy', etiqueta: 'Hoy', ruta: '' },
  { id: 'padron', etiqueta: 'Padrón', ruta: '/padron' },
  { id: 'historial', etiqueta: 'Historial', ruta: '/historial' },
] as const;

export function SeccionesReparto({
  ministerioId,
  activa,
}: {
  ministerioId: string;
  activa: (typeof PARTES)[number]['id'];
}) {
  const base = `/panel/ministerios/${ministerioId}/reparto`;

  return (
    <nav
      aria-label="Partes del reparto"
      className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-alt p-1 sm:inline-grid sm:w-auto sm:self-start"
    >
      {PARTES.map((p) => {
        const esActiva = p.id === activa;
        return (
          <Link
            key={p.id}
            href={`${base}${p.ruta}`}
            aria-current={esActiva ? 'page' : undefined}
            className={
              // `rounded-sm` (6 px) dentro del `rounded-lg` (8 px) con `p-1`: con el
              // mismo radio dentro y fuera, las esquinas no casan.
              'flex h-10 items-center justify-center rounded-sm px-4 text-[14px] font-semibold no-underline transition-colors hover:no-underline ' +
              (esActiva
                ? 'border border-border bg-surface text-foreground'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
