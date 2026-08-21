import 'server-only';

import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { dbAdmin, iglesias } from '@/lib/db';
import {
  PLANES,
  getStripe,
  planDesdePriceId,
  type Periodicidad,
  type PlanId,
} from './client';

/**
 * El viaje de ida y vuelta con Stripe: crear el cliente, abrir Checkout, abrir
 * el portal, y traducir lo que Stripe cuenta a lo que guarda esta base.
 *
 * TODO LO QUE ESCRIBE AQUÍ VA POR `dbAdmin`, Y NO ES PEREZA
 * ---------------------------------------------------------
 * El trigger `guard_facturacion_iglesia()` de la migración `0021` levanta
 * HT112 si `plan`, `trial_until`, `stripe_customer_id` o
 * `stripe_subscription_id` cambian desde una sesión con `request.jwt.claims`
 * puestos — es decir, desde `withUser()`. Escribir la suscripción con la puerta
 * normal no es que esté desaconsejado: falla.
 *
 * Es deliberado. Sin ese trigger, una server action de más con un `set` armado
 * por spread y el pastor se pone `plan = 'plus'` sin pagar.
 */

/** Lo mínimo que hace falta de la iglesia para hablar con Stripe. */
export type IglesiaEnStripe = {
  id: string;
  nombre: string;
  stripeCustomerId: string | null;
};

/**
 * El cliente de Stripe de esta iglesia, creándolo la primera vez.
 *
 * El `metadata.iglesia_id` NO es decoración: es lo que permite mirar un cliente
 * en el panel de Stripe y saber de quién es sin cruzar dos pestañas. Y el
 * `stripe_customer_id` se guarda ANTES de abrir Checkout, no al volver: si se
 * guardara al volver, quien cierra la pestaña en la pantalla de pago dejaría un
 * cliente huérfano y se crearía otro en cada reintento.
 *
 * Queda una carrera pequeña y conocida: dos pestañas pulsando a la vez crean dos
 * clientes y el segundo `update` pisa al primero, que se queda suelto en Stripe
 * sin suscripción ninguna. No se defiende con un candado porque el daño es un
 * cliente vacío en un panel, y el índice único de `stripe_customer_id` —que es
 * el que evita cobrarle a la iglesia de al lado— sigue intacto.
 */
export async function asegurarCliente(
  iglesia: IglesiaEnStripe,
  email: string,
): Promise<string> {
  if (iglesia.stripeCustomerId) return iglesia.stripeCustomerId;

  const cliente = await getStripe().customers.create({
    email,
    name: iglesia.nombre,
    metadata: { iglesia_id: iglesia.id },
  });

  await dbAdmin
    .update(iglesias)
    .set({ stripeCustomerId: cliente.id })
    .where(eq(iglesias.id, iglesia.id));

  return cliente.id;
}

/**
 * La sesión de Checkout. Devuelve la dirección a la que hay que mandar a la
 * persona.
 *
 * EL `iglesia_id` VIAJA DOS VECES, Y HACE FALTA
 * --------------------------------------------
 * En `client_reference_id` de la sesión y en `subscription_data.metadata` de la
 * suscripción. No es redundancia: los eventos `customer.subscription.*` que
 * llegan cuando alguien cambia de plan o cancela DESDE EL PORTAL de Stripe no
 * pasan por ningún Checkout, así que no traen nada de la sesión. Sin la
 * metadata en la suscripción, el webhook tendría que resolver la iglesia
 * siempre por `stripe_customer_id`: una consulta más y un punto de fallo más en
 * el camino que decide quién ha pagado.
 *
 * SIN PRUEBA DE STRIPE
 * --------------------
 * La prueba de Hatril ya la lleva `trial_until` en la base, contada desde que la
 * iglesia se registró. Un `trial_period_days` aquí regalaría una segunda prueba
 * justo a quien acaba de agotar la primera.
 */
export async function crearSesionCheckout(opciones: {
  iglesia: IglesiaEnStripe;
  clienteId: string;
  plan: PlanId;
  periodicidad: Periodicidad;
  origen: string;
}): Promise<string> {
  const { iglesia, clienteId, plan, periodicidad, origen } = opciones;

  const priceId = PLANES[plan].precios[periodicidad].priceId;
  if (!priceId) {
    throw new Error(`Falta el precio de Stripe para ${plan}/${periodicidad}.`);
  }

  const sesion = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: clienteId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: iglesia.id,
    subscription_data: { metadata: { iglesia_id: iglesia.id } },
    // La tarjeta y los datos de facturación los recoge Stripe en su pantalla:
    // ni un número de tarjeta toca este servidor, que es lo que mantiene a
    // Hatril fuera del alcance de PCI-DSS.
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    locale: 'es',
    success_url: `${origen}/panel/suscripcion?estado=listo`,
    cancel_url: `${origen}/panel/suscripcion?estado=cancelado`,
  });

  if (!sesion.url) {
    throw new Error('Stripe no devolvió una dirección de pago.');
  }
  return sesion.url;
}

/**
 * El portal de cliente: cambiar de plan, cambiar la tarjeta, ver las facturas y
 * darse de baja.
 *
 * Se usa el portal y no pantallas propias por una razón que no es de esfuerzo:
 * las facturas las emite Stripe y una pantalla propia tendría que ir detrás de
 * cada cambio suyo. Y la baja tiene que funcionar SIEMPRE, también con la cuenta
 * bloqueada — por eso este botón nunca pasa por el muro.
 */
export async function crearSesionPortal(opciones: {
  clienteId: string;
  origen: string;
}): Promise<string> {
  const sesion = await getStripe().billingPortal.sessions.create({
    customer: opciones.clienteId,
    return_url: `${opciones.origen}/panel/suscripcion`,
    locale: 'es',
  });
  return sesion.url;
}

/**
 * Hasta cuándo está pagado el periodo en curso.
 *
 * OJO CON DÓNDE VIVE ESTE CAMPO
 * -----------------------------
 * `current_period_end` ya NO está en la suscripción: desde la versión de API
 * `basil` vive en cada línea (`subscription.items.data[].current_period_end`).
 * El SDK instalado (22.5, OpenAPI v2349) no lo declara arriba, así que copiar el
 * `sub.current_period_end` que sale en casi todos los tutoriales no compila — y
 * con un `as any` por medio compilaría y daría `undefined`, que es como una
 * iglesia al día se queda sin fecha de acceso.
 *
 * Se toma el máximo de las líneas porque una suscripción puede tener varias con
 * periodos distintos. Hoy siempre hay una; el día que haya dos, quedarse con la
 * primera cortaría el acceso antes de tiempo.
 */
export function finDePeriodo(sub: Stripe.Subscription): Date | null {
  const finales = sub.items.data
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === 'number');

  if (finales.length === 0) return null;
  return new Date(Math.max(...finales) * 1000);
}

/** El plan al que corresponde una suscripción, mirando el precio de su línea. */
export function planDeSuscripcion(sub: Stripe.Subscription): PlanId | null {
  for (const item of sub.items.data) {
    const plan = item.price?.id ? planDesdePriceId(item.price.id) : null;
    if (plan) return plan;
  }
  return null;
}

/** Lo que hay que escribir en `iglesias` a partir de una suscripción. */
export type CambioDeSuscripcion = {
  plan: PlanId | 'cancelado';
  trialUntil: Date | null;
  stripeSubscriptionId: string | null;
};

/**
 * De lo que dice Stripe a lo que guarda esta base.
 *
 * LAS TRES DECISIONES QUE HAY AQUÍ
 * --------------------------------
 * 1. **`cancel_at_period_end` baja el plan a `cancelado` YA**, aunque la
 *    suscripción siga activa y pagada. Parece agresivo y es lo contrario:
 *    `leerEstadoSuscripcion()` corta en cuanto ve un plan de pago y devuelve
 *    «activa», así que dejarlo puesto haría imposible el estado `termina` —el
 *    que dice «has cancelado, sigue funcionando hasta el 14»— y la iglesia se
 *    enteraría de que se le acabó el día que se le acabó. El acceso no lo decide
 *    el nombre del plan sino `trial_until`, que se queda con el fin del periodo
 *    ya pagado.
 *
 * 2. **`past_due` conserva el plan.** Es el estado de un recibo que Stripe está
 *    reintentando, y sus reintentos duran días. Cerrarle el panel a una iglesia
 *    porque el banco falló el martes, cuando el jueves va a cobrar solo, es
 *    generar una llamada de soporte por cada incidencia de cobro del sector.
 *    Cuando Stripe se rinde manda `customer.subscription.deleted` o deja la
 *    suscripción en `unpaid`, y ahí sí se cierra.
 *
 * 3. **`trial_until` se escribe siempre**, en activa y en cancelada. Es la
 *    columna que sostiene los tres días de gracia de lectura, y una fecha vieja
 *    ahí es una iglesia bloqueada sin motivo.
 */
export function traducirSuscripcion(
  sub: Stripe.Subscription,
): CambioDeSuscripcion {
  const fin = finDePeriodo(sub);
  const plan = planDeSuscripcion(sub);

  const vigente =
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'past_due';

  if (vigente && plan && !sub.cancel_at_period_end) {
    return { plan, trialUntil: fin, stripeSubscriptionId: sub.id };
  }

  return {
    plan: 'cancelado',
    trialUntil: fin,
    // La referencia se conserva aunque esté cancelada: es lo que permite
    // reconocerla si vuelve, y lo que se le enseña al soporte de Stripe cuando
    // una iglesia reclama un cobro.
    stripeSubscriptionId: sub.id,
  };
}

/**
 * Aplica el cambio a la fila de la iglesia.
 *
 * Devuelve `false` cuando no hay a quién aplicárselo, que no es un error: pasa
 * con cualquier suscripción creada a mano desde el panel de Stripe para probar.
 * El webhook lo registra y responde 200 — devolver 500 metería a Stripe en tres
 * días de reintentos de un evento que nunca va a poder procesarse.
 */
export async function aplicarCambio(
  iglesiaId: string,
  cambio: CambioDeSuscripcion,
): Promise<boolean> {
  const filas = await dbAdmin
    .update(iglesias)
    .set({
      plan: cambio.plan,
      trialUntil: cambio.trialUntil,
      stripeSubscriptionId: cambio.stripeSubscriptionId,
    })
    .where(eq(iglesias.id, iglesiaId))
    .returning({ id: iglesias.id });

  return filas.length > 0;
}

/**
 * De quién es esta suscripción.
 *
 * Primero la metadata, que es lo que se puso al crearla, y solo si falta se
 * pregunta por el cliente. El orden importa: la metadata la escribe este código
 * y no depende de ninguna consulta; el `stripe_customer_id` puede haberse
 * quedado a null si alguien creó la suscripción desde el panel de Stripe.
 */
export async function iglesiaDeSuscripcion(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const porMetadata = sub.metadata?.iglesia_id;
  if (porMetadata) return porMetadata;

  const clienteId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!clienteId) return null;

  const filas = await dbAdmin
    .select({ id: iglesias.id })
    .from(iglesias)
    .where(eq(iglesias.stripeCustomerId, clienteId))
    .limit(1);

  return filas[0]?.id ?? null;
}
