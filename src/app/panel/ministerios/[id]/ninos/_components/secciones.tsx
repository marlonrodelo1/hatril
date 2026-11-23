import Link from 'next/link';

/**
 * Tablón · Cronograma · Drive · Familias, debajo de las pestañas del
 * ministerio. El control segmentado del reparto (`reparto/_components`), con
 * el mismo porqué: las pestañas de arriba dicen qué herramienta, y esto qué
 * parte de ella.
 *
 * El Tablón primero porque es lo del domingo: publicar lo que se hizo. Las
 * Familias, al final, porque se abren de vez en cuando; cuando hay peticiones
 * sin resolver, el Tablón lo avisa arriba.
 */
const PARTES = [
  { id: 'tablon', etiqueta: 'Tablón', ruta: '' },
  { id: 'cronograma', etiqueta: 'Cronograma', ruta: '/cronograma' },
  { id: 'drive', etiqueta: 'Drive', ruta: '/drive' },
  { id: 'familias', etiqueta: 'Familias', ruta: '/familias' },
] as const;

export type ParteNinos = (typeof PARTES)[number]['id'];

export function SeccionesNinos({
  ministerioId,
  activa,
}: {
  ministerioId: string;
  activa: ParteNinos;
}) {
  const base = `/panel/ministerios/${ministerioId}/ninos`;

  return (
    <nav
      aria-label="Partes del tablón de familias"
      className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface-alt p-1 sm:inline-grid sm:w-auto sm:self-start"
    >
      {PARTES.map((p) => {
        const esActiva = p.id === activa;
        return (
          <Link
            key={p.id}
            href={`${base}${p.ruta}`}
            aria-current={esActiva ? 'page' : undefined}
            className={
              'flex h-10 items-center justify-center rounded-sm px-2 text-[13.5px] font-semibold no-underline transition-colors hover:no-underline sm:px-4 sm:text-[14px] ' +
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
