import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

import { Lista } from '@/components/ui/fila';

/**
 * Las piezas de Mi cuenta: grupos con su rótulo y filas iguales, como los
 * ajustes del móvil.
 *
 * Antes cada bloque tenía su forma —tarjetas, textos sueltos, la cuenta para
 * ofrendar en una caja gris en mitad— y la pantalla costaba recorrerla. Ahora
 * todo es una fila de la misma altura con su icono en un cuadradito, y lo que
 * cambia es solo lo de la derecha: un valor, una flecha o un interruptor.
 *
 * Las filas que llevan a otra pantalla son la `Fila` de la base común; aquí
 * están las que ella no cubre (un dato que se copia, un botón de formulario).
 */

/** Un grupo: el rótulo en `t-micro` fuera de la lista, como en la agenda. */
export function Grupo({
  id,
  rotulo,
  nota,
  children,
}: {
  /**
   * Para llegar con un ancla: el «Dar» de la cabecera lleva a `#ofrendar`
   * cuando la iglesia solo tiene transferencia. El `scroll-mt` deja el rótulo
   * a la vista debajo de la cabecera, que es pegajosa y lo taparía.
   */
  id?: string;
  rotulo?: string;
  /** Lo que conviene saber del grupo entero, debajo de la lista. */
  nota?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-2.5">
      {rotulo && <h2 className="t-micro px-1">{rotulo}</h2>}
      <Lista>{children}</Lista>
      {nota && (
        <p className="px-1 text-pretty text-label text-muted-foreground">{nota}</p>
      )}
    </section>
  );
}

/**
 * El icono de la fila, en su cuadradito. En carbón y no en naranja: es un
 * adorno, y el naranja es para acciones (regla 6). `peligro` solo para borrar
 * la cuenta, y con borde y fondo además del color (regla 2).
 */
export function CuadroIcono({
  peligro = false,
  children,
}: {
  peligro?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex size-8 flex-none items-center justify-center rounded-lg border [&>svg]:size-4',
        peligro
          ? 'border-danger-border bg-danger-soft text-danger'
          : 'border-border bg-surface-alt text-support',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Un dato: lo que es arriba, en pequeño, y el valor debajo.
 *
 * El valor debajo y no a la derecha porque aquí van un correo largo o un IBAN,
 * que a 375 px no caben al lado de su nombre y la `Fila` los cortaría con
 * puntos suspensivos: un número de cuenta cortado no sirve para nada.
 */
export function FilaDato({
  icono,
  etiqueta,
  href,
  fin,
  copiable = false,
  children,
}: {
  icono: ReactNode;
  etiqueta: string;
  /** Si lleva a algún sitio, la fila entera es el enlace, con su flecha. */
  href?: string;
  /** Lo que va pegado a la flecha. */
  fin?: ReactNode;
  /**
   * Un toque lo selecciona entero (`select-all`): en un móvil, copiar un IBAN
   * a mano es donde la gente se rinde.
   */
  copiable?: boolean;
  children: ReactNode;
}) {
  const cuerpo = (
    <>
      <CuadroIcono>{icono}</CuadroIcono>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-label text-muted-foreground">{etiqueta}</span>
        <span
          className={clsx(
            'text-body font-semibold',
            copiable ? 'select-all break-all' : 'truncate',
          )}
        >
          {children}
        </span>
      </span>
      {fin}
      {href && (
        <ChevronRight
          aria-hidden
          className="size-4 flex-none text-muted-foreground transition-transform duration-240 ease-hatril group-hover:translate-x-[3px] motion-reduce:transition-none"
          strokeWidth={1.8}
        />
      )}
    </>
  );
  const clases = 'flex items-center gap-3 px-4 py-3';

  return (
    <li className="border-b border-border last:border-b-0">
      {href ? (
        // `text-foreground`: `globals.css` pinta de naranja todo `<a>`, y lo
        // de dentro lo heredaría (regla 11).
        <Link
          href={href}
          className={clsx(
            clases,
            'group text-foreground no-underline transition-colors duration-150 hover:bg-surface-alt hover:text-foreground hover:no-underline',
          )}
        >
          {cuerpo}
        </Link>
      ) : (
        <div className={clases}>{cuerpo}</div>
      )}
    </li>
  );
}

/**
 * Una fila que envía su formulario: «Cerrar sesión». Va dentro de un `<form>`
 * de server action, que hace el trabajo sin JavaScript. Sin flecha: no lleva a
 * otra pantalla, hace algo.
 */
export function FilaBoton({
  icono,
  titulo,
  detalle,
}: {
  icono: ReactNode;
  titulo: string;
  detalle?: string;
}) {
  return (
    <button
      type="submit"
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-foreground transition-colors duration-150 outline-none hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-inset"
    >
      <CuadroIcono>{icono}</CuadroIcono>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-body font-semibold">{titulo}</span>
        {detalle && (
          <span className="truncate text-label text-muted-foreground">{detalle}</span>
        )}
      </span>
    </button>
  );
}
