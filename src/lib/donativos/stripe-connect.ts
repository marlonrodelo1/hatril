import 'server-only';

import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { cuentasStripe } from '@/lib/db/schema';
import { getStripe } from '@/lib/stripe/client';

/**
 * La cuenta de Stripe de cada iglesia (Connect).
 *
 * QUÉ CLASE DE CUENTA, Y POR QUÉ
 * ------------------------------
 * La de toda la vida que Stripe llamaba «standard», escrita con sus cuatro
 * propiedades en vez del `type`, que es como lo pide la API de hoy:
 *
 *   - panel completo de Stripe para la iglesia (`stripe_dashboard: full`): ve
 *     sus cobros, sus pagos al banco y sus devoluciones sin pasar por Hatril;
 *   - las comisiones las paga ella (`fees.payer: account`): Hatril no cobra
 *     nada por cada ofrenda (decisión 1) y no adelanta nada;
 *   - las pérdidas por disputas las cubre Stripe con ella (`losses: stripe`), no
 *     Rogotech;
 *   - Stripe le pide los datos (`requirement_collection: stripe`): el CIF y la
 *     cuenta del banco de la iglesia los escribe ella en Stripe, y ni Hatril
 *     ni Rogotech los ven nunca.
 *
 * TODO VA POR `dbAdmin`
 * --------------------
 * `cuentas_stripe` no tiene grant de escritura para `hatril_app` (0056). Quien
 * llama a estas funciones ya ha pasado `requireFinanzasAccion({ soloPastor })`.
 */

/**
 * El enlace al alta de Stripe. Crea la cuenta la primera vez y, si ya existe
 * (la iglesia dejó el alta a medias), genera un enlace nuevo para seguir: los
 * enlaces de Stripe caducan en minutos y no se pueden guardar.
 */
export async function enlaceDeAlta(
  iglesia: { id: string; nombre: string; email: string | null },
  origen: string,
): Promise<string> {
  const stripe = getStripe();

  const [existente] = await dbAdmin
    .select({ stripeAccountId: cuentasStripe.stripeAccountId })
    .from(cuentasStripe)
    .where(eq(cuentasStripe.iglesiaId, iglesia.id))
    .limit(1);

  let accountId = existente?.stripeAccountId;
  if (!accountId) {
    const cuenta = await stripe.accounts.create(
      {
        country: 'ES',
        email: iglesia.email ?? undefined,
        business_profile: { name: iglesia.nombre },
        controller: {
          stripe_dashboard: { type: 'full' },
          fees: { payer: 'account' },
          losses: { payments: 'stripe' },
          requirement_collection: 'stripe',
        },
        metadata: { iglesia_id: iglesia.id },
      },
      // Dos clics seguidos en «Conectar» no crean dos cuentas en Stripe. El
      // nombre y el correo van dentro de la clave: Stripe guarda cada clave 24 h
      // y rechaza la misma con otros datos, así que si la iglesia corrige su
      // correo entre un intento y otro, la clave nueva deja crearla.
      { idempotencyKey: `cuenta-iglesia-${iglesia.id}-${createHash('sha256').update(`${iglesia.nombre}|${iglesia.email ?? ''}`).digest('hex').slice(0, 16)}` },
    );
    accountId = cuenta.id;

    // Si otra pestaña ganó la carrera, se queda la suya: la misma clave de
    // idempotencia ha devuelto la misma cuenta, así que coinciden.
    await dbAdmin
      .insert(cuentasStripe)
      .values({ iglesiaId: iglesia.id, stripeAccountId: accountId })
      .onConflictDoNothing({ target: cuentasStripe.iglesiaId });
  }

  const enlace = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${origen}/panel/finanzas/en-linea/conectar`,
    return_url: `${origen}/panel/finanzas/en-linea?vuelta=1`,
  });
  return enlace.url;
}

/** El `acct_…` de una iglesia, o `null` si no ha conectado nada. */
export async function cuentaDe(iglesiaId: string): Promise<string | null> {
  const [fila] = await dbAdmin
    .select({ stripeAccountId: cuentasStripe.stripeAccountId })
    .from(cuentasStripe)
    .where(eq(cuentasStripe.iglesiaId, iglesiaId))
    .limit(1);
  return fila?.stripeAccountId ?? null;
}

/** Copia a la base lo que Stripe dice de la cuenta. La usan la vuelta del alta y el webhook. */
export async function aplicarCuenta(cuenta: Stripe.Account): Promise<void> {
  await dbAdmin
    .update(cuentasStripe)
    .set({
      cobrosActivos: Boolean(cuenta.charges_enabled),
      datosCompletos: Boolean(cuenta.details_submitted),
    })
    .where(eq(cuentasStripe.stripeAccountId, cuenta.id));
}

/**
 * Al volver del alta: pregunta a Stripe en el momento en vez de esperar al
 * webhook, para que la pantalla diga ya «Conectada» si lo está.
 */
export async function refrescarCuenta(iglesiaId: string): Promise<void> {
  const [fila] = await dbAdmin
    .select({ stripeAccountId: cuentasStripe.stripeAccountId })
    .from(cuentasStripe)
    .where(eq(cuentasStripe.iglesiaId, iglesiaId))
    .limit(1);
  if (!fila) return;
  const cuenta = await getStripe().accounts.retrieve(fila.stripeAccountId);
  await aplicarCuenta(cuenta);
}
