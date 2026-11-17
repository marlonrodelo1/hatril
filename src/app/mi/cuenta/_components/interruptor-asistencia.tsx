'use client';

import { useFormStatus } from 'react-dom';
import { CalendarCheck } from 'lucide-react';
import { clsx } from 'clsx';

import { CuadroIcono } from './ajustes';

/**
 * El permiso de asistencia como interruptor, y el interruptor ES el botón que
 * envía el formulario de siempre (`cambiarPermisoAsistencia`).
 *
 * NO GUARDA ESTADO PROPIO
 * -----------------------
 * Pinta lo que dice el servidor (`dado`) y nada más. Lo que se envía lo decide
 * el formulario de la página, igual que antes: con el permiso dado viaja vacío
 * (retirar) y sin él lleva `asistencia=on` (dar). Es dato del art. 9 RGPD: un
 * interruptor que se moviera en el navegador sin haber guardado diría «lo
 * tienes dado» de algo que no consta en ninguna parte.
 *
 * La única concesión es mientras se envía: el botón ya muestra adónde va
 * (`useFormStatus`), porque la action redirige y tarda un momento, y un
 * interruptor que no se mueve al tocarlo se vuelve a tocar. Si la action
 * falla, vuelve con `?error=` y el interruptor sale como estaba.
 *
 * `role="switch"` sobre el `<button>`: el lector dice «Registrar mi
 * asistencia, interruptor, activado», que es lo que es.
 */
export function InterruptorAsistencia({ dado }: { dado: boolean }) {
  const { pending } = useFormStatus();
  const encendido = pending ? !dado : dado;

  return (
    <button
      type="submit"
      role="switch"
      aria-checked={encendido}
      aria-busy={pending || undefined}
      className={clsx(
        'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-foreground transition-colors duration-150 outline-none hover:bg-surface-alt focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-inset',
        pending && 'pointer-events-none',
      )}
    >
      <CuadroIcono>
        <CalendarCheck strokeWidth={1.8} />
      </CuadroIcono>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-body font-semibold">Registrar mi asistencia</span>
        <span className="text-pretty text-label text-muted-foreground">
          {encendido
            ? 'La iglesia puede apuntar cuándo vienes'
            : 'La iglesia no apunta cuándo vienes'}
        </span>
      </span>
      {/* Encendido en carbón y no en naranja: no es la acción de la pantalla,
          es un estado, y el naranja se queda para lo que se pulsa. */}
      <span
        aria-hidden
        className={clsx(
          'relative h-6 w-10 flex-none rounded-full transition-colors duration-240 ease-hatril motion-reduce:transition-none',
          encendido ? 'bg-support' : 'bg-border-strong',
        )}
      >
        <span
          className={clsx(
            'absolute top-[3px] left-[3px] size-[18px] rounded-full bg-surface transition-transform duration-240 ease-hatril motion-reduce:transition-none',
            encendido && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
