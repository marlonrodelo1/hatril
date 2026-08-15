import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  inet,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { accionAuditoriaEnum, tipoConsentimientoEnum } from './enums';
import { iglesias } from './iglesias';
import { miembros } from './miembros';

/**
 * Consentimientos otorgados por cada persona.
 *
 * POR QUÉ ES UNA TABLA Y NO UNA COLUMNA
 * -------------------------------------
 * La tentación es un booleano `acepta_condiciones` en `miembros`. No sirve para
 * lo que exige el art. 7.1 del RGPD, que obliga al responsable a *demostrar* que
 * el interesado consintió. Un booleano no dice cuándo, ni a qué texto, ni desde
 * dónde, y sobre todo no distingue qué revocó la persona cuando revoca solo una
 * parte.
 *
 * `version_texto` es el campo que casi siempre se olvida: si mañana cambia la
 * política de privacidad, hay que poder saber a QUÉ redacción dijo que sí cada
 * persona. Sin eso, un cambio de texto invalida silenciosamente todos los
 * consentimientos anteriores y nadie se entera.
 *
 * REVOCAR NO ES BORRAR
 * --------------------
 * Al revocar se rellena `revocado_at` y la fila se queda. La prueba de que hubo
 * consentimiento durante un periodo es justo lo que hay que conservar para
 * defender el tratamiento que ya se hizo. El borrado real solo llega con el
 * derecho de supresión, y entonces se va la persona entera.
 */
export const consentimientos = pgTable(
  'consentimientos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    tipo: tipoConsentimientoEnum('tipo').notNull(),

    /**
     * Identificador de la redacción concreta que se aceptó, p. ej.
     * `privacidad-2026-08`. Corresponde con las versiones publicadas en
     * `/privacidad`.
     */
    versionTexto: text('version_texto').notNull(),

    otorgadoAt: timestamp('otorgado_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revocadoAt: timestamp('revocado_at', { withTimezone: true }),

    // Evidencia del acto de consentir.
    ip: inet('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [
    // Un solo consentimiento VIVO por tipo y persona. Si revoca y vuelve a
    // aceptar, son dos filas y las dos se conservan.
    uniqueIndex('uq_consentimiento_vivo')
      .on(t.miembroId, t.tipo)
      .where(sql`revocado_at is null`),
    index('idx_consentimientos_iglesia').on(t.iglesiaId),
    index('idx_consentimientos_miembro').on(t.miembroId),
  ],
);

/**
 * Traza de qué se ha hecho con los datos de la congregación.
 *
 * La escriben TRIGGERS, no la aplicación. Es una decisión de diseño, no de
 * comodidad: si dependiera de que cada ruta se acuerde de llamar a
 * `registrarAuditoria()`, la primera ruta que se olvide deja un agujero
 * silencioso en el registro — y un registro de accesos con agujeros no sirve
 * para responder a una reclamación.
 *
 * Incluye `lectura_sensible` porque con datos del art. 9 la pregunta que llega
 * no es solo "quién cambió esto", sino "quién ha estado consultando la ficha de
 * esta persona".
 */
export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /**
     * Quién lo hizo. Puede ser null cuando actúa el sistema (crons, webhooks de
     * Stripe), y esa distinción importa: "lo cambió el sistema" y "no sabemos
     * quién lo cambió" no son lo mismo, por eso el actor del sistema se
     * distingue por `accion` y no por un uuid inventado.
     */
    actorAuthUserId: uuid('actor_auth_user_id'),

    accion: accionAuditoriaEnum('accion').notNull(),

    /** Nombre de la tabla afectada. */
    entidad: text('entidad').notNull(),
    entidadId: uuid('entidad_id'),

    /**
     * Estado antes y después. Los triggers filtran las columnas ruidosas
     * (`updated_at`) para que el diff sea legible por un humano en una
     * reclamación, que es el único momento en que alguien lee esto.
     */
    datosAntes: jsonb('datos_antes').$type<Record<string, unknown>>(),
    datosDespues: jsonb('datos_despues').$type<Record<string, unknown>>(),

    ip: inet('ip'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_auditoria_iglesia_fecha').on(t.iglesiaId, t.createdAt),
    index('idx_auditoria_entidad').on(t.entidad, t.entidadId),
    index('idx_auditoria_actor').on(t.actorAuthUserId),
  ],
);
