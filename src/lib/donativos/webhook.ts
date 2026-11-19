import 'server-only';

import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import {
  cajas,
  donativoLineas,
  donativos,
  donativosMensuales,
  fondos,
  iglesias,
  movimientos,
} from '@/lib/db/schema';
import { getStripe } from '@/lib/stripe/client';
import { enviarCorreo } from '@/lib/email/enviar';
import { timestampAFechaHoraLocal } from '@/lib/fecha/zona';
import { captureException, captureMessage } from '@/lib/observability';
import { NOMBRE_TIPO, type TipoDonativo } from './calculo';
import { reciboDonativo, hashDeToken, tokenDeMensual } from './recibo';
import { aplicarCuenta } from './stripe-connect';

/**
 * Lo que hace el webhook de Connect con cada evento de las cuentas de las
 * iglesias. La ruta (`/api/stripe/connect`) verifica la firma y la
 * idempotencia; esto solo traduce.
 *
 * LOS EVENTOS, Y QUÉ HACE CADA UNO
 * --------------------------------
 *   - `account.updated`: si la iglesia ya puede cobrar.
 *   - `checkout.session.completed`: un pago de una vez queda pagado; uno
 *     mensual crea su `donativos_mensuales` (el dinero llega con la factura).
 *   - `invoice.paid`: cada cobro de un mensual, el primero incluido.
 *   - `invoice.payment_failed`: el mensual pasa a impagado.
 *   - `customer.subscription.deleted`: el mensual se deja.
 *   - `charge.refunded`: la devolución entera marca el donativo como
 *     reembolsado. El libro NO se toca solo: tesorería apunta el ajuste, que es
 *     como se corrige un libro (ver `movimientos.arqueo_id`).
 *
 * TODO PUEDE LLEGAR DOS VECES Y EN CUALQUIER ORDEN
 * ------------------------------------------------
 * La primera factura de un mensual suele llegar ANTES que el
 * `checkout.session.completed`. Por eso las dos rutas pasan por
 * `asegurarMensual`, que crea la fila la primera vez y la devuelve las demás, y
 * `marcarPagado` solo cambia un donativo que todavía no estaba pagado.
 */

export const EVENTOS_CONNECT: readonly string[] = [
  'account.updated',
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'charge.refunded',
];

const id = (x: string | { id: string } | null | undefined) =>
  typeof x === 'string' ? x : x?.id ?? null;

export async function procesarEventoConnect(evento: Stripe.Event): Promise<void> {
  const cuenta = evento.account;
  if (!cuenta) return;

  switch (evento.type) {
    case 'account.updated':
      await aplicarCuenta(evento.data.object);
      return;

    case 'checkout.session.completed': {
      const s = evento.data.object;
      if (s.metadata?.hatril !== 'donativo' || !s.metadata.donativo_id) return;
      if (s.mode === 'payment') {
        if (s.payment_status !== 'paid') return;
        await marcarPagado(s.metadata.donativo_id, {
          cuenta,
          paymentIntentId: id(s.payment_intent),
          invoiceId: null,
          cuando: evento.created,
        });
      } else if (s.mode === 'subscription') {
        const subId = id(s.subscription);
        if (subId) await asegurarMensual(s.metadata.donativo_id, subId);
      }
      return;
    }

    case 'invoice.paid': {
      const factura = evento.data.object;
      const det = factura.parent?.subscription_details;
      if (!det || det.metadata?.hatril !== 'donativo' || !det.metadata.donativo_id) return;
      const subId = id(det.subscription);
      if (!subId || !factura.id) return;
      const mensual = await asegurarMensual(det.metadata.donativo_id, subId);
      if (!mensual) return;

      const paymentIntentId = await paymentIntentDeFactura(factura.id, cuenta);
      const primerCobro = factura.billing_reason === 'subscription_create';
      const donativoId = primerCobro
        ? det.metadata.donativo_id
        : await crearCobroMensual(mensual.id, factura.id);
      await marcarPagado(donativoId, {
        cuenta,
        paymentIntentId,
        invoiceId: factura.id,
        cuando: evento.created,
        mensualId: mensual.id,
        primerCobro,
      });
      if (mensual.estado === 'impagado') {
        await dbAdmin
          .update(donativosMensuales)
          .set({ estado: 'activo' })
          .where(eq(donativosMensuales.id, mensual.id));
      }
      return;
    }

    case 'invoice.payment_failed': {
      const subId = id(evento.data.object.parent?.subscription_details?.subscription);
      if (!subId) return;
      await dbAdmin
        .update(donativosMensuales)
        .set({ estado: 'impagado' })
        .where(and(eq(donativosMensuales.stripeSubscriptionId, subId), eq(donativosMensuales.estado, 'activo')));
      return;
    }

    case 'customer.subscription.deleted': {
      await dbAdmin
        .update(donativosMensuales)
        .set({ estado: 'cancelado', canceladoAt: sql`coalesce(${donativosMensuales.canceladoAt}, now())` })
        .where(eq(donativosMensuales.stripeSubscriptionId, evento.data.object.id));
      return;
    }

    case 'charge.refunded': {
      const cargo = evento.data.object;
      const pi = id(cargo.payment_intent);
      // Solo la devolución entera. Una parcial la decide y la apunta tesorería.
      if (!pi || !cargo.refunded) return;
      await dbAdmin
        .update(donativos)
        .set({ estado: 'reembolsado' })
        .where(and(eq(donativos.stripePaymentIntentId, pi), eq(donativos.estado, 'pagado')));
      return;
    }
  }
}

// ============================================================================
// Mensuales
// ============================================================================

type Mensual = { id: string; estado: 'activo' | 'impagado' | 'cancelado' };

/**
 * La fila del donativo mensual de esta suscripción, creándola la primera vez
 * con las líneas del donativo pendiente que abrió el pago. El id se genera
 * aquí y no en la base: el hash del enlace de gestión depende de él y la
 * columna no admite nulos.
 */
async function asegurarMensual(donativoId: string, subId: string): Promise<Mensual | null> {
  const existente = await dbAdmin
    .select({ id: donativosMensuales.id, estado: donativosMensuales.estado })
    .from(donativosMensuales)
    .where(eq(donativosMensuales.stripeSubscriptionId, subId))
    .limit(1);
  if (existente[0]) return existente[0];

  const [origen] = await dbAdmin
    .select({
      iglesiaId: donativos.iglesiaId,
      total: donativos.total,
      comisionCubierta: donativos.comisionCubierta,
      moneda: donativos.moneda,
      donanteNombre: donativos.donanteNombre,
      donanteEmail: donativos.donanteEmail,
      donanteAuthUserId: donativos.donanteAuthUserId,
    })
    .from(donativos)
    .where(eq(donativos.id, donativoId))
    .limit(1);
  if (!origen) {
    await captureMessage(`Suscripción de donativo ${subId} sin donativo de origen ${donativoId}.`);
    return null;
  }
  const lineas = await dbAdmin
    .select({ tipo: donativoLineas.tipoIngreso, fondoId: donativoLineas.fondoId, importe: donativoLineas.importe })
    .from(donativoLineas)
    .where(eq(donativoLineas.donativoId, donativoId))
    .orderBy(asc(donativoLineas.orden));

  const nuevoId = randomUUID();
  await dbAdmin
    .insert(donativosMensuales)
    .values({
      id: nuevoId,
      iglesiaId: origen.iglesiaId,
      stripeSubscriptionId: subId,
      lineas: lineas.map((l) => ({ tipo: l.tipo as TipoDonativo, fondoId: l.fondoId, importe: l.importe })),
      total: origen.total,
      comisionCubierta: origen.comisionCubierta,
      moneda: origen.moneda,
      donanteNombre: origen.donanteNombre,
      donanteEmail: origen.donanteEmail,
      donanteAuthUserId: origen.donanteAuthUserId,
      tokenGestionHash: hashDeToken(tokenDeMensual(nuevoId)),
    })
    .onConflictDoNothing({ target: donativosMensuales.stripeSubscriptionId });

  await dbAdmin
    .update(donativos)
    .set({ donativoMensualId: sql`(select id from ${donativosMensuales} where ${donativosMensuales.stripeSubscriptionId} = ${subId})` })
    .where(eq(donativos.id, donativoId));

  const [fila] = await dbAdmin
    .select({ id: donativosMensuales.id, estado: donativosMensuales.estado })
    .from(donativosMensuales)
    .where(eq(donativosMensuales.stripeSubscriptionId, subId))
    .limit(1);
  return fila ?? null;
}

/** El donativo de un mes siguiente, copiando las líneas guardadas. Idempotente por factura. */
async function crearCobroMensual(mensualId: string, facturaId: string): Promise<string> {
  const [ya] = await dbAdmin
    .select({ id: donativos.id })
    .from(donativos)
    .where(eq(donativos.stripeInvoiceId, facturaId))
    .limit(1);
  if (ya) return ya.id;

  const [m] = await dbAdmin.select().from(donativosMensuales).where(eq(donativosMensuales.id, mensualId)).limit(1);
  if (!m) throw new Error(`Donativo mensual ${mensualId} desaparecido`);

  return dbAdmin.transaction(async (tx) => {
    const [d] = await tx
      .insert(donativos)
      .values({
        iglesiaId: m.iglesiaId,
        periodicidad: 'mensual',
        estado: 'pendiente',
        total: m.total,
        comisionCubierta: m.comisionCubierta,
        moneda: m.moneda,
        donanteNombre: m.donanteNombre,
        donanteEmail: m.donanteEmail,
        donanteAuthUserId: m.donanteAuthUserId,
        donativoMensualId: m.id,
        stripeInvoiceId: facturaId,
      })
      .returning({ id: donativos.id });
    await tx.insert(donativoLineas).values(
      m.lineas.map((l, i) => ({
        donativoId: d!.id,
        iglesiaId: m.iglesiaId,
        tipoIngreso: l.tipo,
        fondoId: l.fondoId,
        importe: l.importe,
        orden: i,
      })),
    );
    return d!.id;
  });
}

async function paymentIntentDeFactura(facturaId: string, cuenta: string): Promise<string | null> {
  try {
    const f = await getStripe().invoices.retrieve(facturaId, { expand: ['payments'] }, { stripeAccount: cuenta });
    const pago = f.payments?.data.find((p) => p.status === 'paid') ?? f.payments?.data[0];
    return id(pago?.payment.payment_intent);
  } catch (err) {
    await captureException(err, { action: 'donativo_pi_factura' });
    return null;
  }
}

// ============================================================================
// Pagado: el estado, Finanzas y el recibo
// ============================================================================

/** La comisión real de Stripe y los cuatro últimos de la tarjeta, si se saben. */
async function detallesDelCargo(pi: string | null, cuenta: string): Promise<{ comision: string | null; ultimos4: string | null }> {
  if (!pi) return { comision: null, ultimos4: null };
  try {
    const intento = await getStripe().paymentIntents.retrieve(
      pi,
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount: cuenta },
    );
    const cargo = typeof intento.latest_charge === 'object' ? intento.latest_charge : null;
    const bt = cargo && typeof cargo.balance_transaction === 'object' ? cargo.balance_transaction : null;
    return {
      comision: bt ? (bt.fee / 100).toFixed(2) : null,
      ultimos4: cargo?.payment_method_details?.card?.last4 ?? null,
    };
  } catch (err) {
    await captureException(err, { action: 'donativo_detalles_cargo' });
    return { comision: null, ultimos4: null };
  }
}

async function marcarPagado(
  donativoId: string,
  o: {
    cuenta: string;
    paymentIntentId: string | null;
    invoiceId: string | null;
    cuando: number;
    mensualId?: string;
    primerCobro?: boolean;
  },
): Promise<void> {
  const [d] = await dbAdmin
    .select({ id: donativos.id, estado: donativos.estado, iglesiaId: donativos.iglesiaId, timezone: iglesias.timezone })
    .from(donativos)
    .innerJoin(iglesias, eq(iglesias.id, donativos.iglesiaId))
    .where(eq(donativos.id, donativoId))
    .limit(1);
  if (!d) {
    await captureMessage(`Pago de Stripe para un donativo que no existe: ${donativoId}.`);
    return;
  }
  if (d.estado === 'pagado' || d.estado === 'reembolsado') return;

  const { comision, ultimos4 } = await detallesDelCargo(o.paymentIntentId, o.cuenta);
  const cuando = new Date(o.cuando * 1000);
  const fecha = timestampAFechaHoraLocal(cuando, d.timezone).fecha;

  const cambiado = await dbAdmin.transaction(async (tx) => {
    const filas = await tx
      .update(donativos)
      .set({
        estado: 'pagado',
        fecha,
        pagadoAt: cuando,
        comisionStripe: comision,
        ...(o.paymentIntentId ? { stripePaymentIntentId: o.paymentIntentId } : {}),
        ...(o.invoiceId ? { stripeInvoiceId: o.invoiceId } : {}),
        ...(o.mensualId ? { donativoMensualId: o.mensualId } : {}),
      })
      .where(and(eq(donativos.id, donativoId), inArray(donativos.estado, ['pendiente', 'fallido'])))
      .returning({ id: donativos.id });
    if (!filas.length) return false;
    await enlazarConCuenta(tx, donativoId);
    await apuntarEnFinanzas(tx, donativoId, d.iglesiaId, fecha, o.paymentIntentId ?? o.invoiceId);
    return true;
  });

  if (cambiado) await mandarRecibo(donativoId, ultimos4, o.mensualId ?? null, o.primerCobro ?? false);
}

type Tx = Parameters<Parameters<typeof dbAdmin.transaction>[0]>[0];

/**
 * Si quien dio lo hizo sin sesión pero su correo es el de una cuenta que
 * pertenece a esa iglesia, el donativo pasa a ser de esa cuenta.
 *
 * No es un caso raro, es el de todos los iPhone: la app abre la página de dar
 * en Safari (norma 3.2.2 de Apple), y Safari no comparte la sesión del WebView.
 * Sin esto, nada de lo que alguien da desde la app saldría en su «Lo que he
 * dado».
 *
 * Solo con correo confirmado y membresía ACTIVA en esa misma iglesia: escribir
 * el correo de otra persona no le cuelga a nadie un donativo de una iglesia
 * que no es la suya. SQL a mano porque `auth.users` no está en el schema de
 * Drizzle; los parámetros siguen yendo ligados.
 */
async function enlazarConCuenta(tx: Tx, donativoId: string): Promise<void> {
  await tx.execute(sql`
    update public.donativos d
       set donante_auth_user_id = u.id
      from auth.users u
     where d.id = ${donativoId}
       and d.donante_auth_user_id is null
       and u.email_confirmed_at is not null
       and lower(u.email) = lower(d.donante_email)
       and exists (
         select 1 from public.iglesia_usuarios iu
          where iu.auth_user_id = u.id
            and iu.iglesia_id = d.iglesia_id
            and iu.estado = 'activo'
       )`);
  await tx.execute(sql`
    update public.donativos_mensuales m
       set donante_auth_user_id = d.donante_auth_user_id
      from public.donativos d
     where d.id = ${donativoId}
       and m.id = d.donativo_mensual_id
       and m.donante_auth_user_id is null
       and d.donante_auth_user_id is not null`);
}

/**
 * Cada línea, un ingreso en el libro; lo que cubrió la persona, otro; y lo que
 * se quedó Stripe, un gasto. Todo en la caja «Stripe», que es donde está el
 * dinero hasta que Stripe lo pasa al banco. Así el saldo de esa caja es lo que
 * Stripe le debe a la iglesia.
 *
 * Los conceptos NO llevan el nombre de nadie: `movimientos` no dice quién dio
 * qué, y esto no lo cambia (ver el comentario de `concepto` en `finanzas.ts`).
 */
async function apuntarEnFinanzas(tx: Tx, donativoId: string, iglesiaId: string, fecha: string, referencia: string | null): Promise<void> {
  const lineas = await tx
    .select({ id: donativoLineas.id, tipo: donativoLineas.tipoIngreso, fondoId: donativoLineas.fondoId, importe: donativoLineas.importe, movimientoId: donativoLineas.movimientoId })
    .from(donativoLineas)
    .where(eq(donativoLineas.donativoId, donativoId))
    .orderBy(asc(donativoLineas.orden));
  if (lineas.length === 0 || lineas.every((l) => l.movimientoId)) return;

  const cajaId = await cajaStripe(tx, iglesiaId);
  const [general] = await tx
    .select({ id: fondos.id })
    .from(fondos)
    .where(and(eq(fondos.iglesiaId, iglesiaId), eq(fondos.esGeneral, true)))
    .limit(1);
  if (!general) throw new Error(`La iglesia ${iglesiaId} no tiene fondo general`);

  for (const l of lineas) {
    if (l.movimientoId) continue;
    const [m] = await tx
      .insert(movimientos)
      .values({
        iglesiaId,
        tipo: 'ingreso',
        fecha,
        importe: l.importe,
        concepto: `${NOMBRE_TIPO[l.tipo as TipoDonativo]} en línea`,
        fondoId: l.fondoId,
        cajaId,
        metodoPago: 'tarjeta',
        referencia,
        tipoIngreso: l.tipo,
      })
      .returning({ id: movimientos.id });
    await tx.update(donativoLineas).set({ movimientoId: m!.id }).where(eq(donativoLineas.id, l.id));
  }

  const [d] = await tx
    .select({ comisionCubierta: donativos.comisionCubierta, comisionStripe: donativos.comisionStripe })
    .from(donativos)
    .where(eq(donativos.id, donativoId))
    .limit(1);
  if (d && Number(d.comisionCubierta) > 0) {
    await tx.insert(movimientos).values({
      iglesiaId, tipo: 'ingreso', fecha, importe: d.comisionCubierta,
      concepto: 'Comisión cubierta en una ofrenda en línea',
      fondoId: general.id, cajaId, metodoPago: 'tarjeta', referencia, tipoIngreso: 'otro',
    });
  }
  if (d?.comisionStripe && Number(d.comisionStripe) > 0) {
    await tx.insert(movimientos).values({
      iglesiaId, tipo: 'gasto', fecha, importe: d.comisionStripe,
      concepto: 'Comisión de Stripe',
      fondoId: general.id, cajaId, metodoPago: 'otro', referencia,
    });
  }
}

/** La caja «Stripe» de la iglesia, creándola la primera vez. */
async function cajaStripe(tx: Tx, iglesiaId: string): Promise<string> {
  const buscar = () =>
    tx
      .select({ id: cajas.id })
      .from(cajas)
      .where(and(eq(cajas.iglesiaId, iglesiaId), sql`lower(${cajas.nombre}) = 'stripe'`))
      .limit(1);
  const [ya] = await buscar();
  if (ya) return ya.id;
  await tx.insert(cajas).values({ iglesiaId, nombre: 'Stripe', tipo: 'pasarela' }).onConflictDoNothing();
  const [nueva] = await buscar();
  return nueva!.id;
}

async function mandarRecibo(donativoId: string, ultimos4: string | null, mensualId: string | null, primerCobro: boolean): Promise<void> {
  try {
    const [d] = await dbAdmin
      .select({
        email: donativos.donanteEmail, nombre: donativos.donanteNombre, fecha: donativos.fecha,
        total: donativos.total, comisionCubierta: donativos.comisionCubierta,
        iglesiaNombre: iglesias.nombre, slug: iglesias.slug,
      })
      .from(donativos)
      .innerJoin(iglesias, eq(iglesias.id, donativos.iglesiaId))
      .where(eq(donativos.id, donativoId))
      .limit(1);
    if (!d?.fecha) return;
    const lineas = await dbAdmin
      .select({ tipo: donativoLineas.tipoIngreso, fondo: fondos.nombre, esGeneral: fondos.esGeneral, importe: donativoLineas.importe })
      .from(donativoLineas)
      .innerJoin(fondos, eq(fondos.id, donativoLineas.fondoId))
      .where(eq(donativoLineas.donativoId, donativoId))
      .orderBy(asc(donativoLineas.orden));
    const origen = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hatril.com';
    const correo = reciboDonativo({
      iglesia: { nombre: d.iglesiaNombre, slug: d.slug },
      donanteNombre: d.nombre,
      fecha: d.fecha,
      lineas: lineas.map((l) => ({ tipo: l.tipo as TipoDonativo, fondo: l.esGeneral ? 'Donde más falte' : l.fondo, importe: l.importe })),
      comisionCubierta: d.comisionCubierta,
      total: d.total,
      ultimos4,
      enlaceGestion: mensualId ? `${origen}/i/${d.slug}/dar/mensual/${tokenDeMensual(mensualId)}` : null,
      primerCobro,
    });
    await enviarCorreo({ para: d.email, asunto: correo.asunto, html: correo.html, texto: correo.texto, deNombre: d.iglesiaNombre });
  } catch (err) {
    // El recibo no puede tumbar el webhook: el pago ya está apuntado.
    await captureException(err, { action: 'recibo_donativo' });
  }
}
