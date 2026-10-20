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
              'flex h-10 items-center justify-center rounded-md px-4 text-[14.5px] font-semibold no-underline hover:no-underline ' +
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
