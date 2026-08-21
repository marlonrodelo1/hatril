import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { dbAdmin, stripeEventsProcessed } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/error';
import { getStripe } from '@/lib/stripe/client';
import {
  aplicarCambio,
  iglesiaDeSuscripcion,
  traducirSuscripcion,
} from '@/lib/stripe/suscripcion';
import { captureException, captureMessage } from '@/lib/observability';

/**
 * El webhook de Stripe. La única voz autorizada para decir quién ha pagado.
 *
 * QUIÉN LE DA PERMISO PARA ESCRIBIR
 * ---------------------------------
 * Nadie más. `guard_facturacion_iglesia()` (migración `0021`) impide tocar
 * `plan`, `trial_until`, `stripe_customer_id` y `stripe_subscription_id` desde
 * cualquier sesión con `request.jwt.claims`. Aquí no hay sesión ninguna: la
 * autorización es la FIRMA HMAC del cuerpo, y por eso el cuerpo se lee como
 * texto crudo antes de mirarlo. Un `await req.json()` por delante y la firma ya
 * no se puede verificar, porque `JSON.stringify` no devuelve byte a byte lo que
 * Stripe firmó.
 *
 * POR QUÉ NO PASA POR EL PROXY
 * ----------------------------
 * `src/proxy.ts` deja salir `/api/` antes de resolver dominios de iglesia. Sin
 * eso, un webhook que llegara con el `Host` de una congregación con dominio
 * propio se reescribiría a `/i/<slug>/api/stripe/webhook`, Stripe recibiría un
 * 404, reintentaría tres días y se rendiría — sin un solo error en los logs,
 * porque la aplicación nunca se habría enterado.
 *
 * LOS CUATRO EVENTOS, Y POR QUÉ ESOS
 * ----------------------------------
 * `checkout.session.completed` es el alta. Los tres `customer.subscription.*`
 * son todo lo demás: cambiar de plan, cancelar, que caduque la tarjeta, que
 * Stripe se rinda tras los reintentos. Cualquier otro evento se registra y se
 * contesta 200 — hay que suscribirse a pocos en el panel de Stripe, pero un
 * evento de más no puede tumbar el endpoint.
 */

// Node y no edge: el SDK de Stripe usa `crypto` de Node para verificar la firma.
export const runtime = 'nodejs';

// Nada de caché: cada petición trae un evento distinto y firmado.
export const dynamic = 'force-dynamic';

const EVENTOS: readonly string[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

export async function POST(req: Request): Promise<Response> {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto) {
    // 500 a propósito: falta configuración del despliegue, no del evento. Stripe
    // reintentará, y cuando la variable esté puesta el evento entrará solo.
    await captureMessage('Webhook de Stripe sin STRIPE_WEBHOOK_SECRET.');
    return new Response('Sin configurar', { status: 500 });
  }

  const firma = req.headers.get('stripe-signature');
  if (!firma) return new Response('Sin firma', { status: 400 });

  const crudo = await req.text();

  let evento: Stripe.Event;
  try {
    evento = getStripe().webhooks.constructEvent(crudo, firma, secreto);
  } catch (err) {
    // 400 y NO 500. Un cuerpo que no verifica no es un fallo nuestro: es alguien
    // llamando a este endpoint a mano. Con 500, Stripe lo reintentaría durante
    // tres días; con 400 se descarta y ya.
    await captureException(err, { action: 'stripe_webhook_firma' });
    return new Response('Firma inválida', { status: 400 });
  }

  /*
   * IDEMPOTENCIA: SE APUNTA ANTES DE HACER NADA
   * -------------------------------------------
   * Stripe reenvía. Si dos copias del mismo evento entran a la vez, la segunda
   * choca contra la clave primaria de `stripe_events_processed` y se descarta —
   * con 200, porque el evento ya está hecho y un 500 mete a Stripe en un bucle
   * de reintentos sobre trabajo terminado.
   *
   * Y si el procesado falla después, la fila se BORRA. Sin eso, un fallo
   * pasajero de la base dejaría el evento marcado como procesado para siempre y
   * la iglesia pagando sin que su plan cambie nunca, que es la peor avería
   * posible de este fichero: silenciosa y con dinero de por medio.
   */
  try {
    await dbAdmin
      .insert(stripeEventsProcessed)
      .values({ eventId: evento.id, tipo: evento.type });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return Response.json({ recibido: true, repetido: true });
    }
    await captureException(err, { action: 'stripe_webhook_idempotencia' });
    return new Response('Error', { status: 500 });
  }

  try {
    if (EVENTOS.includes(evento.type)) {
      await procesar(evento);
    }
    return Response.json({ recibido: true });
  } catch (err) {
    await dbAdmin
      .delete(stripeEventsProcessed)
      .where(eq(stripeEventsProcessed.eventId, evento.id));

    await captureException(err, {
      action: 'stripe_webhook',
      evento: evento.type,
    });
    return new Response('Error', { status: 500 });
  }
}

async function procesar(evento: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  /*
   * El alta. La sesión de Checkout trae la suscripción por referencia, así que
   * hay que ir a buscarla: el objeto de la sesión no lleva ni el precio ni el
   * fin de periodo, que es justo lo que hace falta guardar.
   *
   * Y suele llegar DESPUÉS de `customer.subscription.created`, no antes. No
   * importa: los dos caminos acaban en `traducirSuscripcion`, que calcula lo
   * mismo mirando la suscripción, así que el orden de llegada no cambia el
   * resultado. Eso es intencionado — un webhook cuyo resultado dependa del
   * orden en que Stripe entregue es un webhook que falla una vez al mes y nadie
   * sabe por qué.
   */
  if (evento.type === 'checkout.session.completed') {
    const sesion = evento.data.object;
    const subId =
      typeof sesion.subscription === 'string'
        ? sesion.subscription
        : sesion.subscription?.id;

    // Sin suscripción no hay nada que aplicar: es un Checkout de pago único,
    // que hoy no existe en Hatril pero existirá con los donativos.
    if (!subId) return;

    const sub = await stripe.subscriptions.retrieve(subId);
    await aplicar(sub, sesion.client_reference_id);
    return;
  }

  if (
    evento.type === 'customer.subscription.created' ||
    evento.type === 'customer.subscription.updated' ||
    evento.type === 'customer.subscription.deleted'
  ) {
    await aplicar(evento.data.object, null);
  }
}

/**
 * Resuelve de quién es y escribe el cambio.
 *
 * `respaldoIglesiaId` es el `client_reference_id` del Checkout, y solo se usa
 * si la suscripción no trae metadata. Es el caso de una suscripción creada a
 * mano en el panel de Stripe sobre un cliente que sí existe aquí.
 */
async function aplicar(
  sub: Stripe.Subscription,
  respaldoIglesiaId: string | null,
): Promise<void> {
  const iglesiaId = (await iglesiaDeSuscripcion(sub)) ?? respaldoIglesiaId;

  if (!iglesiaId) {
    // No es un error: pasa con cualquier suscripción de prueba creada a mano.
    // Se deja constancia y se contesta 200 — reintentar no la va a hacer
    // aparecer.
    await captureMessage(
      `Suscripción de Stripe sin iglesia: ${sub.id} (cliente ${String(sub.customer)}).`,
    );
    return;
  }

  const aplicado = await aplicarCambio(iglesiaId, traducirSuscripcion(sub));

  if (!aplicado) {
    await captureMessage(
      `La iglesia ${iglesiaId} de la suscripción ${sub.id} no existe en la base.`,
    );
  }
}
