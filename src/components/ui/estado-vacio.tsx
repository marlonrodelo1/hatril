import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Cuando todavía no hay nada.
 *
 * La primera vez que el pastor abre cada sección la encuentra vacía, y es el
 * momento en que decide si sigue. Así que el vacío dice qué es esto, qué hacer
 * y lleva el botón (guía, «Estado vacío»). Había vacíos que solo decían «No
 * hay movimientos en este periodo.», en gris y sin botón (inventario, A6).
 *
 * Entra con un gesto corto la primera vez que se pinta —el aro gira hasta su
 * sitio y el icono crece— y se queda quieto. Con «reducir movimiento», quieto
 * desde el principio (`globals.css`, «La base común»).
 *
 * `accion` es el botón: el principal si es la acción de la pantalla, de
 * contorno si esa misma acción ya está en la cabecera en naranja.
 */
export function EstadoVacio({
  Icono,
  titulo,
  children,
  accion,
  className,
}: {
  Icono: LucideIcon;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'vacio-entra flex flex-col items-center gap-2.5 px-6 py-14 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="relative mb-1.5 flex size-[72px] items-center justify-center"
      >
        <span className="vacio-aro absolute inset-0 rounded-full border-[1.5px] border-dashed border-border-strong" />
        <span className="vacio-centro flex size-[52px] items-center justify-center rounded-full border border-border bg-surface-alt text-support">
          <Icono className="size-6" strokeWidth={1.7} />
        </span>
      </span>
      <h3 className="t-subtitulo text-balance">{titulo}</h3>
      {children && (
        <p className="max-w-[380px] text-body text-pretty text-muted-foreground">
          {children}
        </p>
      )}
      {accion && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{accion}</div>
      )}
    </div>
  );
}
