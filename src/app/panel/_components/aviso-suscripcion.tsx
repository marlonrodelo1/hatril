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
 * aviso solo por el color, y el naranja de marca no se toca.
 *
 * Ese naranja es `primary`, no `accent`: en shadcn `accent` es el fondo suave de
 * los hover. Con él la franja y el icono salieron invisibles desde el primer
 * día (1.1:1 sobre el crema), en las tres paletas. El enlace va en
 * `accent-foreground` porque el naranja de marca sobre este velo se queda en
 * 4.46:1, y el texto es de 13px.
 */
export function AvisoSuscripcion({ ctx }: { ctx: UserContext }) {
  const estado = leerEstadoSuscripcion(ctx.iglesia);
  if (!convieneAvisar(estado)) return null;

  return (
    // Fuera del papel: el aviso de la prueba o del pago no pinta nada encima
    // del informe del mes que se lleva al banco de alimentos o a la asamblea.
    <div className="flex items-start gap-2.5 border-b border-primary/40 bg-primary/5 px-5 py-2.5 text-[13px] leading-snug sm:px-8 print:hidden">
      <TriangleAlert
        className="mt-px size-4 flex-none text-primary"
        strokeWidth={1.9}
      />
      <span>
        {etiquetaEstado(estado)}{' '}
        {esPastor(ctx) ? (
          <Link
            href="/panel/suscripcion"
            className="font-semibold text-accent-foreground underline underline-offset-2"
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
