import type { ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * La insignia: el estado de una persona, de un turno o de una emisora.
 *
 * UNA SOLA FORMA
 * --------------
 * Pastilla de 22 px con cinco tonos. Había dos (la pastilla de Miembros y un
 * rectángulo de 6 px en Turnos y Repertorio) y cada pantalla escribía sus
 * colores y medidas: el inventario lo apuntó como A3. Sustituye al `badge.tsx`
 * de shadcn, que no usaba nadie y traía `dark:`.
 *
 * Su `text-[12px]` es la única medida suelta que acepta la guía, y solo aquí.
 *
 * `punto` añade el punto del color del texto, para estados que cambian (un
 * turno: «Confirmado», «Sin contestar»). `vivo` le pone además el latido, y
 * solo para lo que está pasando AHORA: la radio, una emisión. Es lo único de
 * la aplicación que se mueve sin que nadie lo toque, y por eso no se reparte.
 *
 * `clsx` y no `cn`: aquí no hay clases que resolver, solo que juntar, y
 * `tailwind-merge` confunde los tamaños propios de la escala con colores.
 */
const TONOS = {
  exito: 'bg-badge-success-bg text-badge-success-fg',
  aviso: 'bg-badge-warning-bg text-badge-warning-fg',
  marca: 'bg-badge-accent-bg text-badge-accent-fg',
  neutro: 'bg-badge-neutral-bg text-badge-neutral-fg',
  peligro: 'bg-badge-danger-bg text-badge-danger-fg',
} as const;

export type TonoInsignia = keyof typeof TONOS;

export function Insignia({
  tono = 'neutro',
  punto = false,
  vivo = false,
  className,
  children,
}: {
  tono?: TonoInsignia;
  punto?: boolean;
  vivo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-[22px] flex-none items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap',
        TONOS[tono],
        className,
      )}
    >
      {(punto || vivo) && (
        <span
          aria-hidden
          className={clsx(
            'relative size-1.5 flex-none rounded-full bg-current',
            vivo && 'insignia-viva',
          )}
        />
      )}
      {children}
    </span>
  );
}
