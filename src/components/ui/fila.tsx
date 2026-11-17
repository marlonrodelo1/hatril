import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Filas y listas: casi todo Hatril es una lista de personas o de cosas.
 *
 * Una fila sirve igual en el ordenador y en el móvil: lo de delante (una cara,
 * un icono), el título, un dato debajo, lo de detrás (una insignia, una hora)
 * y la flecha si lleva a algún sitio. En el móvil se quita lo que sobra en vez
 * de apilarlo: lo que se apilaba sin etiquetas era el M4 del inventario (un
 * guion, otro guion, un teléfono y una fecha sueltos).
 *
 * Un enlace con forma de fila lleva `text-foreground` (regla 11): `globals.css`
 * pinta de naranja todo `<a>` y lo de dentro lo heredaría.
 */
export function Lista({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul
      className={clsx(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-surface',
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function Fila({
  href,
  inicio,
  titulo,
  detalle,
  fin,
  conFlecha,
  scroll,
}: {
  href?: string;
  inicio?: ReactNode;
  titulo: ReactNode;
  detalle?: ReactNode;
  fin?: ReactNode;
  /** Por defecto, la flecha sale cuando la fila es un enlace. */
  conFlecha?: boolean;
  /** Para enlaces que abren algo encima sin mover la página (la ficha). */
  scroll?: boolean;
}) {
  const flecha = conFlecha ?? Boolean(href);
  const cuerpo = (
    <>
      {inicio}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-body font-semibold">{titulo}</span>
        {detalle && (
          <span className="truncate text-label text-muted-foreground">
            {detalle}
          </span>
        )}
      </span>
      {fin}
      {flecha && (
        <ChevronRight
          aria-hidden
          className="size-4 flex-none text-muted-foreground transition-transform duration-240 ease-hatril group-hover:translate-x-[3px] motion-reduce:transition-none"
          strokeWidth={1.8}
        />
      )}
    </>
  );
  const clases =
    'group flex items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors duration-150 hover:no-underline';

  return (
    <li className="border-b border-border last:border-b-0">
      {href ? (
        <Link
          href={href}
          scroll={scroll}
          className={clsx(clases, 'hover:bg-surface-alt hover:text-foreground')}
        >
          {cuerpo}
        </Link>
      ) : (
        <div className={clases}>{cuerpo}</div>
      )}
    </li>
  );
}
