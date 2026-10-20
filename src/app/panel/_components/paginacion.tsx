'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginación de un listado del panel.
 *
 * Con enlaces reales y no botones con `onClick`: cada página es una URL, así
 * que se puede abrir en otra pestaña, compartir y volver con el botón atrás.
 * Un `<button>` que llama a `router.push` se ve igual y no permite nada de eso.
 *
 * Nació en miembros con «personas» escrito dentro; el libro de caja la usa
 * también, y por eso la unidad viaja como parámetro.
 */
export function Paginacion({
  total,
  pagina,
  porPagina,
  unidad = ['persona', 'personas'],
  alPie = false,
}: {
  total: number;
  pagina: number;
  porPagina: number;
  /** Singular y plural de lo que se cuenta. */
  unidad?: readonly [string, string];
  /**
   * La que va debajo de la tabla. Esa SÍ sube al principio al cambiar de
   * página: quien la pulsa está al final de la lista, y con `scroll={false}`
   * aterrizaba al final de la siguiente, con sus primeras filas fuera de la
   * vista. La de arriba no se mueve, que es lo que pedía miembros.
   */
  alPie?: boolean;
}) {
  const params = useSearchParams();
  const paginas = Math.ceil(total / porPagina);

  function href(p: number) {
    const siguientes = new URLSearchParams(params.toString());
    if (p <= 1) siguientes.delete('pagina');
    else siguientes.set('pagina', String(p));
    // La ficha abierta no sobrevive al cambio de página: casi seguro que ya no
    // está en la lista que se está mirando.
    siguientes.delete('ficha');
    const cadena = siguientes.toString();
    return cadena ? `?${cadena}` : '?';
  }

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  const claseFlecha =
    'flex size-9 items-center justify-center rounded-lg border border-border bg-surface-alt text-foreground no-underline hover:bg-surface-active hover:no-underline';
  const claseInerte =
    'flex size-9 items-center justify-center rounded-lg border border-border bg-surface-alt text-disabled-text';

  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <span className="text-[13px] text-muted-foreground">
        {desde}–{hasta} de {total} {total === 1 ? unidad[0] : unidad[1]}
      </span>

      <div className="flex items-center gap-1">
        {pagina > 1 ? (
          <Link
            href={href(pagina - 1)}
            scroll={alPie}
            aria-label="Página anterior"
            className={claseFlecha}
          >
            <ChevronLeft className="size-4" strokeWidth={1.9} />
          </Link>
        ) : (
          <span className={claseInerte} aria-hidden>
            <ChevronLeft className="size-4" strokeWidth={1.9} />
          </span>
        )}

        <span className="px-2 text-[13.5px] text-muted-foreground">
          {pagina} de {paginas}
        </span>

        {pagina < paginas ? (
          <Link
            href={href(pagina + 1)}
            scroll={alPie}
            aria-label="Página siguiente"
            className={claseFlecha}
          >
            <ChevronRight className="size-4" strokeWidth={1.9} />
          </Link>
        ) : (
          <span className={claseInerte} aria-hidden>
            <ChevronRight className="size-4" strokeWidth={1.9} />
          </span>
        )}
      </div>
    </div>
  );
}
