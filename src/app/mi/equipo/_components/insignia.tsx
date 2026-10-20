import type { LucideIcon } from 'lucide-react';

/**
 * La insignia de la guía visual: una pastilla, cinco tonos.
 *
 * La fase 2 trae `components/ui/insignia.tsx` con esta misma forma; cuando
 * llegue, esta se cambia por aquella. Su `text-[12px]` es la única medida
 * suelta que la guía admite, y solo dentro de la insignia.
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
  clase,
  Icono,
  children,
}: {
  tono?: TonoInsignia;
  /**
   * Fondo y texto ya resueltos en otro catálogo —las respuestas de un turno,
   * los resultados del seguimiento—, que traen su par de tokens. Gana a `tono`.
   */
  clase?: string;
  Icono?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        'inline-flex h-[22px] w-fit flex-none items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ' +
        (clase ?? TONOS[tono])
      }
    >
      {Icono && <Icono className="size-3.5" strokeWidth={2} aria-hidden />}
      {children}
    </span>
  );
}
