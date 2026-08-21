import 'server-only';

import { redirect } from 'next/navigation';

import { inicioDe } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import { leerEstadoSuscripcion, puedeEscribir } from './estado';

/**
 * El muro de suscripción, del lado que de verdad importa: ESCRIBIR.
 *
 * DÓNDE VIVE, Y POR QUÉ NO BASTA EL LAYOUT
 * ----------------------------------------
 * El layout del panel manda a `/suscripcion` a quien ya no tiene ni la gracia
 * de lectura, y eso cubre `bloqueada`. Pero no puede ser el único corte, por
 * dos razones que están en la documentación de Next
 * (`03-file-conventions/layout.md`): un layout **no se vuelve a ejecutar al
 * navegar** entre rutas que comparte, y «no controla si el resto de la ruta se
 * renderiza». Además una server action se puede invocar sin haber pintado
 * ninguna pantalla.
 *
 * Y hay un estado que el layout no toca a propósito: en `solo_lectura` el panel
 * entero sigue navegable durante tres días y lo único que desaparece es poder
 * guardar. Ese corte solo puede estar aquí.
 *
 * LO QUE NUNCA SE BLOQUEA
 * -----------------------
 * Pagar, darse de baja, aceptar la política y cambiar la contraseña propia.
 * Cerrar cualquiera de esas cuatro deja a una iglesia sin forma de salir del
 * estado en el que está, que es la peor manera posible de reclamar un recibo.
 */

const MENSAJE: Record<'solo_lectura' | 'bloqueada', string> = {
  solo_lectura:
    'Se acabó tu periodo de prueba: puedes seguir consultando, pero no guardar cambios hasta que actives la suscripción.',
  bloqueada:
    'Tu iglesia no tiene una suscripción activa. Actívala para volver a guardar cambios.',
};

/**
 * Corta la action si esta iglesia ya no puede escribir.
 *
 * Redirige con `?error=`, que es la convención de errores de action de todo el
 * repo: una action que redirige a otro sitio al fallar es indistinguible del
 * éxito para quien la invocó.
 *
 * `destinoError` es el de la propia action —la pantalla desde la que se pulsó—
 * y no `/panel/suscripcion` a la fuerza: quien no es pastor no puede entrar
 * ahí, y mandarle a una pantalla que le rebota es dejarle sin mensaje.
 */
export function exigirPoderEscribir(
  ctx: UserContext,
  destinoError?: string,
): void {
  const estado = leerEstadoSuscripcion(ctx.iglesia);
  if (puedeEscribir(estado)) return;

  const mensaje =
    estado.situacion === 'solo_lectura' ? MENSAJE.solo_lectura : MENSAJE.bloqueada;

  const destino = destinoError ?? inicioDe(ctx);
  redirect(`${destino}?error=` + encodeURIComponent(mensaje));
}
