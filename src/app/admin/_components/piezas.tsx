import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { Tono } from '@/lib/admin/consultas';

/**
 * Las piezas pequeñas que repiten las pantallas de `/admin`.
 *
 * La insignia es la pastilla de la guía visual (`docs/diseno/guia-visual.md`,
 * «Insignias»), con el tono por nombre en vez de por clases: aquí lo decide
 * `situacionDe()`, que no sabe de Tailwind.
 */

const TONOS: Record<Tono, string> = {
  exito: 'bg-badge-success-bg text-badge-success-fg',
  aviso: 'bg-badge-warning-bg text-badge-warning-fg',
  marca: 'bg-badge-accent-bg text-badge-accent-fg',
  neutro: 'bg-badge-neutral-bg text-badge-neutral-fg',
  peligro: 'bg-badge-danger-bg text-badge-danger-fg',
};

export function Insignia({
  tono,
  children,
}: {
  tono: Tono;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-[22px] flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/** Una cifra con su rótulo, como las de Inicio del panel. */
export function Cifra({
  rotulo,
  valor,
  detalle,
  href,
}: {
  rotulo: string;
  valor: number;
  detalle?: string;
  /** Si la tarjeta lleva a algún sitio. */
  href?: string;
}) {
  const contenido = (
    <>
      <span className="t-micro">{rotulo}</span>
      <span className="t-cifra tabular-nums">{valor}</span>
      {detalle && (
        <span className="text-label text-muted-foreground">{detalle}</span>
      )}
    </>
  );

  const clases = 'flex flex-col gap-2 rounded-xl border border-border bg-surface p-5';

  // `text-foreground` en la tarjeta-enlace: `globals.css` pinta de naranja todo
  // `<a>` y la cifra lo heredaría (regla 11 de la guía).
  return href ? (
    <Link
      href={href}
      className={`${clases} text-foreground no-underline transition-colors hover:border-support-hover hover:bg-surface-alt hover:no-underline`}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/** Fila de lista que es enlace entero, con flecha al final. */
export function FilaEnlace({
  href,
  titulo,
  datos,
  children,
}: {
  href: string;
  titulo: string;
  datos?: string;
  /** Lo que va a la derecha, antes de la flecha: la insignia. */
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-semibold">{titulo}</span>
        {datos && (
          <span className="truncate text-label text-muted-foreground">{datos}</span>
        )}
      </span>
      {children}
      <ChevronRight
        className="size-4 flex-none text-disabled-text"
        strokeWidth={1.8}
        aria-hidden
      />
    </Link>
  );
}

/** Un dato con su etiqueta, para las fichas. */
export function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-label text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words text-body">{children}</dd>
    </div>
  );
}

/**
 * Las fechas de `/admin` se pintan en la hora de Canarias: es desde donde se
 * opera la plataforma. El contenedor corre en UTC, y sin zona una cuenta creada
 * a las 00:30 en Tenerife saldría con la fecha del día anterior.
 *
 * Lo que es de UNA iglesia —hasta cuándo tiene acceso— va en la zona de esa
 * iglesia: es su día el que se acaba, no el nuestro.
 */
export const ZONA_ADMIN = 'Atlantic/Canary';

export function fecha(d: Date, timeZone: string = ZONA_ADMIN): string {
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
}

/** Cifras en una frase: «1 persona», «3 personas». */
export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
