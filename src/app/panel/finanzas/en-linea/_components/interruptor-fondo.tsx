'use client';

import { useFormStatus } from 'react-dom';
import { clsx } from 'clsx';

/**
 * Un fondo de la lista «Fondos que se pueden elegir», como interruptor.
 *
 * Es el patrón de `InterruptorAsistencia` (`mi/cuenta`): la fila entera es el
 * botón que envía el formulario de la página, con `role="switch"`, y no guarda
 * estado propio. Pinta lo que dice el servidor; mientras se envía ya enseña
 * adónde va (`useFormStatus`), porque la action redirige y tarda un momento, y
 * un interruptor que no se mueve al tocarlo se vuelve a tocar. Si falla, vuelve
 * con `?error=` y sale como estaba.
 *
 * `fijo` es el general: «Donde más falte» sale siempre al dar, y se enseña
 * encendido y sin poder tocarlo para que se vea que está, no para que se pulse.
 * Sin formulario alrededor, `pending` es siempre falso.
 *
 * Encendido en carbón y no en naranja: es un estado, no la acción de la
 * pantalla.
 */
export function InterruptorFondo({
  nombre,
  encendido,
  fijo = false,
}: {
  nombre: string;
  encendido: boolean;
  fijo?: boolean;
}) {
  const { pending } = useFormStatus();
  const visible = fijo || (pending ? !encendido : encendido);

  return (
    <button
      type={fijo ? 'button' : 'submit'}
      role="switch"
      aria-checked={visible}
      aria-busy={pending || undefined}
      disabled={fijo}
      className={clsx(
        'flex w-full items-center gap-3 px-4 py-3 text-left text-foreground transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-inset',
        fijo ? 'cursor-default' : 'cursor-pointer hover:bg-surface-alt',
        pending && 'pointer-events-none',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-body font-semibold">{nombre}</span>
        <span className="text-pretty text-label text-muted-foreground">
          {fijo
            ? 'El fondo general. Sale siempre.'
            : visible
              ? 'Se puede elegir al dar'
              : 'No sale al dar'}
        </span>
      </span>
      <span
        aria-hidden
        className={clsx(
          'relative h-6 w-10 flex-none rounded-full transition-colors duration-240 ease-hatril motion-reduce:transition-none',
          // El fijo, en carbón entero y no atenuado: atenuado se confundía con
          // uno apagado, y lo que tiene que decir es «está», no «no se puede».
          visible ? 'bg-support' : 'bg-border-strong',
        )}
      >
        <span
          className={clsx(
            'absolute top-[3px] left-[3px] size-[18px] rounded-full bg-surface transition-transform duration-240 ease-hatril motion-reduce:transition-none',
            visible && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
