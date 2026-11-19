import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  numeric,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { monedaEnum } from './enums';
import { fondos, movimientos, tipoIngresoEnum } from './finanzas';

/**
 * Diezmos y ofrendas con tarjeta.
 *
 * EL DINERO NO PASA POR HATRIL
 * ----------------------------
 * Cada iglesia conecta SU cuenta de Stripe (Connect, cuenta «standard»: panel
 * completo, comisiones y disputas suyas) y el cobro se hace directamente en
 * ella. Aquí solo se guarda lo necesario para enseñarlo, apuntarlo en Finanzas
 * y que cada cual vea lo suyo. Si el dinero pasara por la cuenta de Rogotech,
 * Rogotech sería una entidad de pago.
 *
 * QUIÉN DA ES DATO PROTEGIDO
 * --------------------------
 * Que alguien dé a una iglesia dice que pertenece a ella (art. 9 RGPD). Por eso
 * el nombre y el correo viven aquí y NO en `movimientos`, que sigue sin decir
 * quién dio qué: el webhook apunta cada línea como un ingreso con concepto
 * genérico. La RLS de estas tablas (migración 0056) solo deja leer al pastor,
 * a tesorería y a la propia persona que dio, no a toda la iglesia.
 *
 * Nadie escribe estas tablas con `withUser`: no hay `grant` de escritura a
 * `hatril_app`. Las escribe el servidor con `dbAdmin` al crear el pago y el
 * webhook firmado de Stripe al confirmarlo, que son las dos únicas voces que
 * saben lo que ha pasado de verdad.
 */

export const estadoDonativoEnum = pgEnum('estado_donativo_enum', [
  'pendiente',
  'pagado',
  'fallido',
  'reembolsado',
]);

export const periodicidadDonativoEnum = pgEnum('periodicidad_donativo_enum', [
  'una',
  'mensual',
]);

export const estadoDonativoMensualEnum = pgEnum(
  'estado_donativo_mensual_enum',
  ['activo', 'impagado', 'cancelado'],
);

/**
 * La cuenta de Stripe conectada de cada iglesia. Una como mucho.
 *
 * Tabla aparte y no dos columnas en `iglesias`: `iglesias` la lee `anon` por
 * columnas y la protege un trigger de facturación; esto ni lo uno ni lo otro.
 * Y así su RLS es suya, sin tocar la de `iglesias`.
 */
export const cuentasStripe = pgTable('cuentas_stripe', {
  iglesiaId: uuid('iglesia_id')
    .primaryKey()
    .references(() => iglesias.id, { onDelete: 'cascade' }),

  /** `acct_…`. Única: dos iglesias con la misma cuenta cobrarían la una por la otra. */
  stripeAccountId: text('stripe_account_id').notNull().unique(),

  /** `charges_enabled` de Stripe: si ya puede cobrar. Hasta entonces no hay botón. */
  cobrosActivos: boolean('cobros_activos').notNull().default(false),

  /** `details_submitted`: si la iglesia terminó el alta en Stripe. */
  datosCompletos: boolean('datos_completos').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Lo que alguien da cada mes. Es una suscripción en la cuenta de Stripe de la
 * iglesia; aquí, lo que hace falta para apuntar cada cobro y para dejarlo.
 */
export const donativosMensuales = pgTable(
  'donativos_mensuales',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),

    estado: estadoDonativoMensualEnum('estado').notNull().default('activo'),

    /**
     * Las líneas de cada cobro: `[{ tipo, fondoId, importe }]`, con el importe
     * como cadena («50.00»). Cada factura pagada las copia a `donativo_lineas`.
     * Se guardan aquí y no se leen de Stripe porque el fondo es un uuid nuestro.
     */
    lineas: jsonb('lineas').$type<LineaGuardada[]>().notNull(),

    total: numeric('total', { precision: 14, scale: 2 }).notNull(),
    comisionCubierta: numeric('comision_cubierta', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    moneda: monedaEnum('moneda').notNull(),

    donanteNombre: text('donante_nombre').notNull(),
    donanteEmail: text('donante_email').notNull(),
    /** Si dio con la sesión abierta. Uuid pelado, sin FK a `auth.users`. */
    donanteAuthUserId: uuid('donante_auth_user_id'),

    /**
     * El enlace del recibo para cambiarlo o dejarlo sin cuenta lleva un token
     * aleatorio; aquí solo su sha-256. Quien lea esta tabla no puede fabricar
     * el enlace.
     */
    tokenGestionHash: text('token_gestion_hash').notNull().unique(),

    canceladoAt: timestamp('cancelado_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_donativos_mensuales_iglesia').on(t.iglesiaId),
    index('idx_donativos_mensuales_donante')
      .on(t.donanteAuthUserId)
      .where(sql`${t.donanteAuthUserId} is not null`),
  ],
);

export type LineaGuardada = {
  tipo: 'diezmo' | 'ofrenda';
  fondoId: string;
  importe: string;
};

/**
 * Un pago: el de una vez, o cada cobro de uno mensual.
 *
 * Nace `pendiente` al abrir el pago en Stripe, antes de que la persona escriba
 * la tarjeta, y pasa a `pagado` solo cuando lo dice el webhook. Uno pendiente
 * que nunca llega es alguien que cerró la pestaña: no suma en ningún sitio.
 */
export const donativos = pgTable(
  'donativos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    periodicidad: periodicidadDonativoEnum('periodicidad').notNull(),
    estado: estadoDonativoEnum('estado').notNull().default('pendiente'),

    /** Lo que paga la persona, comisión cubierta incluida. */
    total: numeric('total', { precision: 14, scale: 2 }).notNull(),
    /** Lo que añadió para cubrir la comisión. Va a la iglesia como lo demás. */
    comisionCubierta: numeric('comision_cubierta', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    /** Lo que se quedó Stripe, cuando se sabe. Se apunta como gasto en la caja. */
    comisionStripe: numeric('comision_stripe', { precision: 14, scale: 2 }),
    moneda: monedaEnum('moneda').notNull(),

    donanteNombre: text('donante_nombre').notNull(),
    donanteEmail: text('donante_email').notNull(),
    donanteAuthUserId: uuid('donante_auth_user_id'),

    donativoMensualId: uuid('donativo_mensual_id').references(
      () => donativosMensuales.id,
      { onDelete: 'set null' },
    ),

    stripeCheckoutSessionId: text('stripe_checkout_session_id').unique(),
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
    stripeInvoiceId: text('stripe_invoice_id').unique(),

    /** El día del cobro en la zona de la iglesia. Nulo mientras está pendiente. */
    fecha: date('fecha', { mode: 'string' }),
    pagadoAt: timestamp('pagado_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ck_donativos_total_positivo', sql`${t.total} > 0`),
    // Pagado o reembolsado, siempre con su día: sin él no se puede apuntar.
    check(
      'ck_donativos_fecha',
      sql`${t.estado} in ('pendiente', 'fallido') or ${t.fecha} is not null`,
    ),
    index('idx_donativos_iglesia').on(t.iglesiaId, t.fecha.desc()),
    index('idx_donativos_donante')
      .on(t.donanteAuthUserId, t.fecha.desc())
      .where(sql`${t.donanteAuthUserId} is not null`),
  ],
);

/** Cada línea de un pago: diezmo u ofrenda, a qué fondo y cuánto. */
export const donativoLineas = pgTable(
  'donativo_lineas',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    donativoId: uuid('donativo_id')
      .notNull()
      .references(() => donativos.id, { onDelete: 'cascade' }),

    /** Redundante con el donativo, como en todo el repo: la policy compara directo. */
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    tipoIngreso: tipoIngresoEnum('tipo_ingreso').notNull(),

    fondoId: uuid('fondo_id')
      .notNull()
      .references(() => fondos.id, { onDelete: 'restrict' }),

    importe: numeric('importe', { precision: 14, scale: 2 }).notNull(),

    /** El ingreso que apuntó el webhook en Finanzas. Si tesorería lo borra, queda nulo. */
    movimientoId: uuid('movimiento_id').references(() => movimientos.id, {
      onDelete: 'set null',
    }),

    orden: integer('orden').notNull().default(0),
  },
  (t) => [
    check('ck_donativo_lineas_importe', sql`${t.importe} > 0`),
    check(
      'ck_donativo_lineas_tipo',
      sql`${t.tipoIngreso} in ('diezmo', 'ofrenda')`,
    ),
    index('idx_donativo_lineas_donativo').on(t.donativoId),
  ],
);
