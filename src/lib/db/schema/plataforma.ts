import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  index,
  unique,
  jsonb,
  inet,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { accionAdminEnum } from './enums';

/**
 * Tablas de la plataforma, no de ninguna iglesia.
 *
 * Todas van con RLS activada y SIN policies, más un `REVOKE ALL FROM anon,
 * authenticated`. Solo se llega por service role o por el rol de la aplicación
 * desde código de servidor. Es el patrón que Gonper aplica a `leads` y
 * `admin_users`, y que Pidoo aprendió por las malas: `push_debug_logs` tenía dos
 * policies con `WITH CHECK (true)` y cualquiera podía inyectar filas sin límite.
 */

/** Quién puede entrar a `/admin`. Deliberadamente sin más campos que los justos. */
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    notas: text('notas'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('admin_users_auth_user_unique').on(t.authUserId)],
);

/**
 * Lo que ha hecho cada super admin desde `/admin`: quién, qué, sobre qué y
 * cuándo.
 *
 * NO ES `auditoria`, Y NO PUEDE SERLO
 * ----------------------------------
 * `auditoria` cuelga de una iglesia (`iglesia_id` obligatorio, en cascada), la
 * escriben triggers y la lee el pastor de esa iglesia. Poner una contraseña
 * provisional no es de ninguna iglesia, y un registro que desaparece con la
 * iglesia sobre la que se actuó no sirve para responder qué se le hizo.
 *
 * SOLO SE AÑADE
 * -------------
 * Ni UPDATE ni DELETE ni TRUNCATE: un trigger los corta con HT135 (`0052`). Un
 * registro que el mismo super admin puede retocar no prueba nada. Por eso
 * tampoco hay claves ajenas: con `on delete set null` borrar una iglesia sería
 * un UPDATE aquí, y el trigger lo pararía.
 *
 * SIN COPIAS DE DATOS PERSONALES
 * ------------------------------
 * Se guardan ids, no correos ni nombres: la pantalla los resuelve al pintar.
 * Si una persona ejerce su derecho de supresión y se borra su cuenta, aquí
 * queda «una cuenta borrada», no su correo. Lo que nunca se guarda es la
 * contraseña puesta, ni en `detalle` ni en ninguna otra parte.
 */
export const registroAdmin = pgTable(
  'registro_admin',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** El super admin que lo hizo. */
    actorAuthUserId: uuid('actor_auth_user_id').notNull(),
    accion: accionAdminEnum('accion').notNull(),
    /** La iglesia sobre la que se actuó, si la acción es de una iglesia. */
    iglesiaId: uuid('iglesia_id'),
    /** La cuenta sobre la que se actuó, si la acción es de una cuenta. */
    cuentaAuthUserId: uuid('cuenta_auth_user_id'),
    /** Lo que cambió: `{ antes, despues }` de la fecha de la prueba, por ejemplo. */
    detalle: jsonb('detalle')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /**
     * Desde dónde. Si alguna vez entra alguien con la cuenta de un super admin,
     * es lo primero que se va a preguntar.
     */
    ip: inet('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_registro_admin_fecha').on(t.createdAt.desc()),
    index('idx_registro_admin_iglesia')
      .on(t.iglesiaId, t.createdAt.desc())
      .where(sql`${t.iglesiaId} is not null`),
    index('idx_registro_admin_cuenta')
      .on(t.cuentaAuthUserId, t.createdAt.desc())
      .where(sql`${t.cuentaAuthUserId} is not null`),
    // Toda acción es SOBRE algo. Una fila sin iglesia ni cuenta no responde a
    // ninguna pregunta.
    check(
      'ck_registro_admin_objeto',
      sql`${t.iglesiaId} is not null or ${t.cuentaAuthUserId} is not null`,
    ),
  ],
);

/**
 * Eventos de Stripe ya procesados.
 *
 * El `event_id` es la CLAVE PRIMARIA, y ahí está toda la gracia: el webhook
 * inserta primero y procesa después, de modo que un reenvío choca contra la PK
 * y se descarta. Y ante ese choque hay que responder 200, no 500 — un 500 mete
 * a Stripe en un bucle de reintentos sobre un evento que ya estaba hecho.
 */
export const stripeEventsProcessed = pgTable('stripe_events_processed', {
  eventId: text('event_id').primaryKey(),
  tipo: text('tipo'),
  procesadoAt: timestamp('procesado_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Contador diario para limitar por IP, iglesia o usuario.
 *
 * Sin Redis: un `INSERT … ON CONFLICT DO UPDATE … RETURNING` es atómico y
 * suficiente a esta escala, y evita una pieza de infraestructura más que
 * mantener. Se consulta y se incrementa desde `src/lib/api/rate-limit.ts`, que
 * falla ABIERTO si la base no responde: quedarse sin poder registrar iglesias
 * porque el contador está caído sería peor que el abuso que previene.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    clave: text('clave').notNull(),
    dia: date('dia').notNull(),
    contador: integer('contador').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('rate_limits_scope_clave_dia_unique').on(t.scope, t.clave, t.dia),
    index('idx_rate_limits_dia').on(t.dia),
  ],
);
