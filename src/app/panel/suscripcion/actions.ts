'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requirePastorAccion } from '@/lib/auth/guard-panel';
import { getOrigin } from '@/lib/auth/get-origin';
import { dbAdmin, iglesias } from '@/lib/db';
import { campoObligatorio } from '@/lib/api/formulario';
import {
  asegurarCliente,
  crearSesionCheckout,
  crearSesionPortal,
} from '@/lib/stripe/suscripcion';
import { captureException } from '@/lib/observability';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Las dos puertas de la suscripción: ir a pagar e ir al portal.
 *
 * LAS DOS VAN CON `sinMuro`, Y ES LA RAZÓN DE QUE EL PARÁMETRO EXISTA
 * ------------------------------------------------------------------
 * Son justo las acciones que sirven para salir del estado en el que está la
 * iglesia. Un muro que también cierre la puerta de pagar no es un muro, es una
 * avería: la congregación ve «suscríbete», pulsa, y el guard la devuelve a la
 * misma pantalla con el mismo mensaje para siempre.
 *
 * Lo mismo vale para darse de baja, que vive dentro del portal de Stripe.
 */

const DESTINO = '/panel/suscripcion';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

const EsquemaPlan = z.object({
  plan: z.enum(['esencial', 'comunidad', 'plus']),
  periodicidad: z.enum(['mensual', 'anual']),
});

/**
 * El `stripe_customer_id`, que NO viaja en el contexto de usuario.
 *
 * Podría: está en el mismo `select` de `iglesias` que hace
 * `getCurrentUserContext()`. Se deja fuera a propósito porque ese contexto lo
 * lee cada pantalla del panel y acaba cerca de componentes de cliente, y el
 * identificador de facturación no pinta nada en noventa pantallas para hacer
 * falta en dos. Aquí es una consulta más en el camino menos transitado del
 * producto.
 *
 * Va por `dbAdmin` como todo lo de facturación: ver la cabecera de
 * `lib/stripe/suscripcion.ts` y el trigger HT112 de la migración `0021`.
 */
async function clienteDe(ctx: UserContext): Promise<string | null> {
  const filas = await dbAdmin
    .select({ stripeCustomerId: iglesias.stripeCustomerId })
    .from(iglesias)
    .where(eq(iglesias.id, ctx.iglesia.id))
    .limit(1);

  return filas[0]?.stripeCustomerId ?? null;
}

/**
 * A la pantalla de pago de Stripe.
 *
 * El precio no se enseña aquí ni viaja en el formulario: lo pone Stripe en su
 * pantalla, a partir del identificador de precio. Un importe tecleado en el
 * cliente sería una cifra que se puede cambiar con el inspector, y un botón
 * «49 €» que cobra otra cosa es una reclamación garantizada.
 */
export async function irAPagar(formData: FormData): Promise<void> {
  const ctx = await requirePastorAccion(DESTINO, { sinMuro: true });

  const datos = EsquemaPlan.safeParse({
    plan: campoObligatorio(formData, 'plan'),
    periodicidad: campoObligatorio(formData, 'periodicidad'),
  });

  if (!datos.success) volver('Ese plan no existe.');

  let destino: string;
  try {
    const clienteId = await asegurarCliente(
      {
        id: ctx.iglesia.id,
        nombre: ctx.iglesia.nombre,
        stripeCustomerId: await clienteDe(ctx),
      },
      ctx.user.email ?? '',
    );

    destino = await crearSesionCheckout({
      iglesia: {
        id: ctx.iglesia.id,
        nombre: ctx.iglesia.nombre,
        stripeCustomerId: clienteId,
      },
      clienteId,
      plan: datos.data.plan,
      periodicidad: datos.data.periodicidad,
      origen: await getOrigin(),
    });
  } catch (err) {
    // Falta una variable de precio, Stripe no responde, la clave es de otra
    // cuenta. Todas acaban igual para quien está delante: no se puede pagar
    // ahora. Se le dice, y el detalle va a Sentry — que es donde sirve.
    await captureException(err, { action: 'irAPagar' });
    volver('No se ha podido abrir la pantalla de pago. Inténtalo en un momento.');
  }

  // FUERA del try: `redirect()` funciona lanzando, y dentro lo atraparía el
  // catch de arriba convirtiendo un pago que iba bien en «no se ha podido».
  redirect(destino);
}

/**
 * Al portal de cliente de Stripe: facturas, tarjeta, cambio de plan y baja.
 *
 * Sin `stripe_customer_id` no hay portal que abrir, y eso no es un fallo: es
 * una iglesia que todavía no ha pasado por Checkout. Se le dice en su idioma en
 * vez de enseñarle un error de Stripe.
 */
export async function irAlPortal(): Promise<void> {
  const ctx = await requirePastorAccion(DESTINO, { sinMuro: true });

  const clienteId = await clienteDe(ctx);
  if (!clienteId) {
    volver('Todavía no tienes ninguna suscripción que gestionar.');
  }

  let destino: string;
  try {
    destino = await crearSesionPortal({
      clienteId,
      origen: await getOrigin(),
    });
  } catch (err) {
    await captureException(err, { action: 'irAlPortal' });
    volver('No se ha podido abrir la gestión de tu suscripción.');
  }

  redirect(destino);
}
