import Link from 'next/link';

/**
 * Las dos preguntas del seguimiento: ¿quién llegó? y ¿quién se fue?
 *
 * Un nivel por debajo de `PestanasMinisterio` y con otra forma a propósito: son
 * dos maneras de mirar la misma lista de personas, no dos herramientas. Por eso
 * no son dos módulos con su interruptor (lo cuenta `nuevos/page.tsx`).
 *
 * Con la cifra al lado: «Ausentes · 0» ya contesta la pregunta sin abrir nada.
 */
export function VistasSeguimiento({
  base,
  activa,
  nuevos,
  ausentes,
}: {
  base: string;
  activa: 'nuevos' | 'ausentes';
  nuevos: number;
  ausentes: number;
}) {
  const vistas = [
    { id: 'ausentes', etiqueta: 'Ausentes', n: ausentes, href: base },
    { id: 'nuevos', etiqueta: 'Nuevos', n: nuevos, href: `${base}/nuevos` },
  ] as const;

  return (
    <nav
      aria-label="Qué mirar"
      className="inline-flex w-fit gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {vistas.map((v) => {
        const esActiva = v.id === activa;
        return (
          <Link
            key={v.id}
            href={v.href}
            aria-current={esActiva ? 'page' : undefined}
            className={
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[14px] font-semibold no-underline transition-colors hover:no-underline ' +
              (esActiva
                ? 'bg-surface-active text-foreground'
                : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground')
            }
          >
            {v.etiqueta}
            <span className="tabular-nums text-[13px] font-medium text-muted-foreground">
              {v.n}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
