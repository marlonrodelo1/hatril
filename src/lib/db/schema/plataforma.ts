import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  index,
  unique,
} from 'drizzle-orm/pg-core';

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
