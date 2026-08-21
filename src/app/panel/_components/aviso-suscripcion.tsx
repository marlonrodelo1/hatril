import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { esPastor } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import {
  convieneAvisar,
  etiquetaEstado,
  leerEstadoSuscripcion,
} from '@/lib/suscripcion/estado';

/**
 * La franja que avisa de que se acaba, encima de todo el panel.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * Hasta ahora la prueba vencía y no pasaba nada visible: el estado se calculaba
 * y no lo miraba nadie. Una congregación que se entera de que se le acabó el
 * plazo el día que deja de poder guardar es una congregación que se enfada con
 * razón. `convieneAvisar()` enciende esto los tres últimos días y durante toda
 * la gracia de lectura.
 *
 * CUÁNDO NO SALE
 * --------------
 * Con la suscripción al día, y cuando ya está bloqueada — ahí no hay panel que
 * coronar, porque el layout ha mandado la sesión a `/suscripcion`.
 *
 * El icono acompaña al color porque el sistema de diseño no deja distinguir un
 * aviso solo por el color, y `accent` no se toca.
 */
export function AvisoSuscripcion({ ctx }: { ctx: UserContext }) {
  const estado = leerEstadoSuscripcion(ctx.iglesia);
  if (!convieneAvisar(estado)) return null;

  return (
    <div className="flex items-start gap-2.5 border-b border-accent/40 bg-accent/5 px-5 py-2.5 text-[13px] leading-snug sm:px-8">
      <TriangleAlert
        className="mt-px size-4 flex-none text-accent"
        strokeWidth={1.9}
      />
      <span>
        {etiquetaEstado(estado)}{' '}
        {esPastor(ctx) ? (
          <Link
            href="/panel/suscripcion"
            className="font-semibold underline underline-offset-2"
          >
            Elegir plan
          </Link>
        ) : (
          // A quien no es pastor no se le ofrece un enlace que le va a rebotar:
          // `/panel/suscripcion` lleva `requirePastor()`.
          <span className="text-muted-foreground">
            Habla con el pastor de tu iglesia.
          </span>
        )}
      </span>
    </div>
  );
}
