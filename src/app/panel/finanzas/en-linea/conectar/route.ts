import { redirect } from 'next/navigation';

import { requirePermisoApi } from '@/lib/auth/guard-api';
import { esPastor } from '@/lib/auth/permisos';
import { cuentaDe } from '@/lib/donativos/stripe-connect';
import { finanzasEncendida } from '@/lib/iglesias/herramientas';
import { exigirPoderEscribir } from '@/lib/suscripcion/muro';
import {
  abrirAlta,
  DESTINO_EN_LINEA,
  MENSAJE_SOLO_ESPANA,
  paisAdmitido,
} from '../_lib/alta';

/**
 * El `refresh_url` del alta de Stripe.
 *
 * Los enlaces de alta caducan en minutos y solo valen una vez. Cuando el pastor
 * vuelve a una pestaña vieja, o recarga a mitad, Stripe lo manda aquí, y aquí
 * se pide un enlace nuevo y se le devuelve a Stripe sin que tenga que hacer
 * nada.
 *
 * SU PROPIA GUARDA
 * ----------------
 * Un `route.ts` no pasa por ningún layout (`guard-api.ts`). `requirePermisoApi`
 * pone las puertas del panel y el permiso de la caja; lo demás, que la acción
 * del botón sí tiene, va a mano: Finanzas encendida, ser pastor, el muro de
 * suscripción y España.
 *
 * REDIRIGE, NO RESPONDE TEXTO
 * ---------------------------
 * `guard-api.ts` pide `Response` y no `redirect()` porque allí se sirven
 * ficheros. Esto es una navegación: lo que llega del navegador es una persona
 * que vuelve de Stripe, y lo que le sirve es la pantalla con el aviso. Sin
 * sesión o sin permiso sí sale el 401/403 de la guarda: no hay pantalla suya a
 * la que devolverle.
 *
 * NO CREA CUENTAS
 * ---------------
 * Un GET lo dispara cualquier enlace, y la cookie de sesión viaja en una
 * navegación de primer nivel aunque venga de otra web. Si la iglesia aún no
 * tiene cuenta no hay alta que retomar: crearla es el botón de la página, que
 * es un POST. Aquí solo se pide un enlace nuevo para una cuenta que ya existe.
 */
export async function GET(): Promise<Response> {
  const guard = await requirePermisoApi('gestionar_finanzas');
  if (!guard.ok) return guard.respuesta;

  const { ctx } = guard;

  // Después del permiso, como la exportación: a quien no lleva la caja, saber
  // si la iglesia la tiene encendida no le corresponde.
  if (!finanzasEncendida(ctx.iglesia)) {
    return new Response('No existe.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (!esPastor(ctx)) {
    volver('Solo el pastor puede seguir con el alta en Stripe.');
  }
  exigirPoderEscribir(ctx, DESTINO_EN_LINEA);
  if (!paisAdmitido(ctx.iglesia)) volver(MENSAJE_SOLO_ESPANA);

  if (!(await cuentaDe(ctx.iglesia.id))) redirect(DESTINO_EN_LINEA);

  const alta = await abrirAlta(ctx);
  if ('error' in alta) volver(alta.error);

  redirect(alta.url);
}

function volver(mensaje: string): never {
  redirect(`${DESTINO_EN_LINEA}?error=` + encodeURIComponent(mensaje));
}
