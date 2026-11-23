import 'server-only';

import { and, eq } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { donativoLineas, donativos, donativosMensuales } from '@/lib/db/schema';
import { getStripe } from '@/lib/stripe/client';
import { captureException } from '@/lib/observability';
import {
  NOMBRE_TIPO,
  aCentimos,
  comisionACubrir,
} from './calculo';
import { paginaDeDar } from './consultas';
import { cuentaDe } from './stripe-connect';
import type { DatosDonativo } from './validacion';

/**
 * Abrir el pago en Stripe y dejarlo.
 *
 * LO QUE SE COBRA LO CALCULA ESTO, NO EL NAVEGADOR
 * ------------------------------------------------
 * Del formulario solo se fían el tipo, el fondo y el importe de cada línea, ya
 * validados. Los fondos se vuelven a comprobar contra los que la iglesia
 * ofrece HOY, la comisión se recalcula aquí, y el total que viaja a Stripe
 * sale de esas cuentas. Un POST fabricado con «total: 1» y «diezmo: 500» cobra
 * 500 más su comisión, no 1.
 *
 * EL DONATIVO NACE ANTES QUE EL PAGO
 * ----------------------------------
 * Se escribe `pendiente`, con sus líneas, antes de abrir Checkout, y su id
 * viaja en los metadatos. Así el webhook sabe exactamente qué apuntar, y un
 * pago que nunca llega se queda en un pendiente que no suma en ningún sitio.
 */

export type ResultadoPago = { url: string } | { error: string };

export async function abrirPagoDonativo(entrada: {
  slug: string;
  datos: DatosDonativo;
  authUserId: string | null;
  origen: string;
}): Promise<ResultadoPago> {
  const pagina = await paginaDeDar(entrada.slug);
  if (!pagina || !pagina.conTarjeta || !pagina.stripeAccountId) {
    return { error: 'Esta iglesia no recibe ofrendas con tarjeta ahora mismo.' };
  }
  const { iglesia, stripeAccountId } = pagina;
  const { datos } = entrada;

  const fondoPorId = new Map(pagina.fondos.map((f) => [f.id, f]));
  for (const l of datos.lineas) {
    if (!fondoPorId.has(l.fondoId)) {
      return { error: 'Uno de los destinos ya no está disponible. Recarga la página y vuelve a elegir.' };
    }
  }

  const baseCent = datos.lineas.reduce((s, l) => s + aCentimos(l.importe), 0);
  const comisionCent = datos.cubrir ? aCentimos(comisionACubrir(baseCent / 100)) : 0;
  const totalCent = baseCent + comisionCent;
  const euros = (c: number) => (c / 100).toFixed(2);

  const [donativo] = await dbAdmin.transaction(async (tx) => {
    const filas = await tx
      .insert(donativos)
      .values({
        iglesiaId: iglesia.id,
        periodicidad: datos.periodicidad,
        estado: 'pendiente',
        total: euros(totalCent),
        comisionCubierta: euros(comisionCent),
        moneda: 'EUR',
        donanteNombre: datos.nombre,
        donanteEmail: datos.email,
        donanteAuthUserId: entrada.authUserId,
      })
      .returning({ id: donativos.id });
    const d = filas[0]!;
    await tx.insert(donativoLineas).values(
      datos.lineas.map((l, i) => ({
        donativoId: d.id,
        iglesiaId: iglesia.id,
        tipoIngreso: l.tipo,
        fondoId: l.fondoId,
        importe: euros(aCentimos(l.importe)),
        orden: i,
      })),
    );
    return filas;
  });
  const donativoId = donativo!.id;

  const nombreLinea = (l: DatosDonativo['lineas'][number]) => {
    const fondo = fondoPorId.get(l.fondoId)!;
    return `${NOMBRE_TIPO[l.tipo]} · ${fondo.esGeneral ? 'Donde más falte' : fondo.nombre}`;
  };
  const mensual = datos.periodicidad === 'mensual';
  const recurrente = mensual ? { recurring: { interval: 'month' as const } } : {};
  const lineItems = datos.lineas.map((l) => ({
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: aCentimos(l.importe),
      product_data: { name: nombreLinea(l) },
      ...recurrente,
    },
  }));
  if (comisionCent > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: comisionCent,
        product_data: { name: 'Comisión de la tarjeta, cubierta' },
        ...recurrente,
      },
    });
  }

  // Lo que el webhook necesita para saber qué es y de quién. Nada de nombres:
  // estos metadatos los ve la iglesia en su panel de Stripe, y ya tiene los
  // datos del pago allí.
  const metadata = { hatril: 'donativo', donativo_id: donativoId, iglesia_id: iglesia.id };
  const base = `${entrada.origen}/i/${iglesia.slug}/dar`;

  try {
    const sesion = await getStripe().checkout.sessions.create(
      {
        mode: mensual ? 'subscription' : 'payment',
        line_items: lineItems,
        customer_email: datos.email,
        locale: 'es',
        payment_method_types: ['card'],
        metadata,
        ...(mensual
          ? { subscription_data: { metadata, description: `Ofrenda mensual a ${iglesia.nombre}` } }
          : { payment_intent_data: { metadata, description: `Ofrenda a ${iglesia.nombre}` } }),
        success_url: `${base}/gracias?d=${donativoId}`,
        cancel_url: `${base}?cancelado=1`,
      },
      { stripeAccount: stripeAccountId, idempotencyKey: `donativo-${donativoId}` },
    );
    await dbAdmin
      .update(donativos)
      .set({ stripeCheckoutSessionId: sesion.id })
      .where(eq(donativos.id, donativoId));
    if (!sesion.url) throw new Error('Checkout sin url');
    return { url: sesion.url };
  } catch (err) {
    await captureException(err, { action: 'abrir_pago_donativo', iglesia: iglesia.id });
    await dbAdmin
      .update(donativos)
      .set({ estado: 'fallido' })
      .where(and(eq(donativos.id, donativoId), eq(donativos.estado, 'pendiente')));
    return { error: 'No se ha podido abrir el pago. Inténtalo de nuevo en un momento.' };
  }
}

// ============================================================================
// Dejar lo de cada mes
// ============================================================================

/**
 * Deja un donativo mensual: cancela la suscripción en la cuenta de la iglesia.
 * La fila se marca aquí y otra vez cuando llegue `customer.subscription.deleted`,
 * que es idempotente: si el webhook tarda, la pantalla ya dice «dejado».
 *
 * Quien llama ya ha comprobado que esta persona puede: por su sesión (`Lo que
 * he dado`) o por el token del correo.
 */
export async function dejarDonativoMensual(mensualId: string): Promise<boolean> {
  const [fila] = await dbAdmin
    .select({
      sub: donativosMensuales.stripeSubscriptionId,
      estado: donativosMensuales.estado,
      iglesiaId: donativosMensuales.iglesiaId,
    })
    .from(donativosMensuales)
    .where(eq(donativosMensuales.id, mensualId))
    .limit(1);
  if (!fila) return false;
  if (fila.estado === 'cancelado') return true;

  const cuenta = await cuentaDe(fila.iglesiaId);
  if (!cuenta) return false;
  try {
    await getStripe().subscriptions.cancel(fila.sub, {}, { stripeAccount: cuenta });
  } catch (err) {
    await captureException(err, { action: 'dejar_donativo_mensual' });
    return false;
  }
  await dbAdmin
    .update(donativosMensuales)
    .set({ estado: 'cancelado', canceladoAt: new Date() })
    .where(eq(donativosMensuales.id, mensualId));
  return true;
}
