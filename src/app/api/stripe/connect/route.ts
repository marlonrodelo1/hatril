import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { dbAdmin, stripeEventsProcessed } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/error';
import { getStripe } from '@/lib/stripe/client';
import { EVENTOS_CONNECT, procesarEventoConnect } from '@/lib/donativos/webhook';
import { captureException, captureMessage } from '@/lib/observability';

/**
 * El webhook de Connect: los eventos de las cuentas de Stripe de las iglesias
 * (sus ofrendas), no los de la cuenta de Hatril (las suscripciones, que van a
 * `/api/stripe/webhook`).
 *
 * POR QUÉ OTRA RUTA Y OTRO SECRETO
 * --------------------------------
 * En Stripe son dos destinos distintos: uno escucha la cuenta propia y otro
 * «las cuentas conectadas», y cada uno firma con su secreto. Mezclarlos en una
 * ruta obligaría a probar dos secretos por petición y, peor, a decidir por el
 * contenido del evento quién lo manda, que es justo lo que la firma ya dice.
 *
 * Lo demás es lo del webhook de siempre, a propósito: cuerpo crudo para la
 * firma, 400 si no verifica, la misma tabla de idempotencia (los ids de evento
 * son únicos en todo Stripe) y la fila se borra si el procesado falla, para que
 * el reintento de Stripe vuelva a entrar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const secreto = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secreto) {
    await captureMessage('Webhook de Connect sin STRIPE_CONNECT_WEBHOOK_SECRET.');
    return new Response('Sin configurar', { status: 500 });
  }

  const firma = req.headers.get('stripe-signature');
  if (!firma) return new Response('Sin firma', { status: 400 });

  const crudo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = getStripe().webhooks.constructEvent(crudo, firma, secreto);
  } catch (err) {
    await captureException(err, { action: 'stripe_connect_firma' });
    return new Response('Firma inválida', { status: 400 });
  }

  try {
    await dbAdmin
      .insert(stripeEventsProcessed)
      .values({ eventId: evento.id, tipo: evento.type });
  } catch (err) {
    if (isUniqueViolation(err)) return Response.json({ recibido: true, repetido: true });
    await captureException(err, { action: 'stripe_connect_idempotencia' });
    return new Response('Error', { status: 500 });
  }

  try {
    if (EVENTOS_CONNECT.includes(evento.type)) await procesarEventoConnect(evento);
    return Response.json({ recibido: true });
  } catch (err) {
    await dbAdmin
      .delete(stripeEventsProcessed)
      .where(eq(stripeEventsProcessed.eventId, evento.id));
    await captureException(err, { action: 'stripe_connect', evento: evento.type });
    return new Response('Error', { status: 500 });
  }
}
