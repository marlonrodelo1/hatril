import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { ministerios } from './ministerios';

/**
 * El reparto de alimentos: quién recibe, cada domingo que se reparte, y qué
 * pasó en la puerta.
 *
 * LO QUE HACE DISTINTO A ESTE MÓDULO
 * ----------------------------------
 * Guarda a gente que NO es de la congregación —o que lo es, y eso aquí no
 * cuenta— y que está pasando necesidad. Son dos de los criterios de la lista de
 * la AEPD para la evaluación de impacto (personas vulnerables y entidad
 * religiosa), y de ahí salen las cuatro rarezas de este fichero:
 *
 *   1. Un padrón APARTE de `miembros`, sin `miembro_id`. Cruzarlo con la ficha
 *      construiría, dentro del fichero de la iglesia, el mapa «esta persona de
 *      la congregación necesita comida». Por lo mismo `evento_inscripciones` no
 *      lleva `miembro_id`. Inscribirse no hace miembro a nadie.
 *   2. Por HOGAR, no por persona: un nombre y cuántos viven en la casa. Ni
 *      nombres ni edades de los niños, que serían datos de menores.
 *   3. SIN NINGÚN CAMPO DE TEXTO LIBRE. Una casilla de notas en un padrón de
 *      ayuda acaba guardando «madre soltera», «sin papeles» o «enfermo»: salud,
 *      origen o situación administrativa. Es la misma decisión que el
 *      seguimiento, y aquí pesa más.
 *   4. RLS por EQUIPO y no por iglesia (`0042`): lo ven el pastor y quien sirve
 *      en ese ministerio, no la congregación entera.
 *
 * Y sin `auditar()` en ninguna de las tres: `auditoria` copia la fila entera,
 * no se puede borrar y el pastor la lee de punta a punta, así que «borrar a una
 * persona» dejaría su nombre y su teléfono allí para siempre.
 */
export const repartoBeneficiarios = pgTable(
  'reparto_beneficiarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /**
     * Su número en ESTE reparto, correlativo. Se llama por él en la puerta, no
     * por el nombre: quien espera en la fila no tiene por qué oír cómo se llama
     * el de al lado. Lo pone un trigger (`0042`), igual que `numero_miembro`.
     *
     * El `default 0` es solo para que la aplicación no tenga que mandarlo: el
     * trigger lo sobrescribe SIEMPRE en el INSERT —nadie elige su número— y si
     * faltara el trigger, el CHECK de `> 0` rechazaría la fila.
     */
    numero: integer('numero').notNull().default(0),

    /** Como quiera que le llamen. No tiene por qué ser el del documento. */
    nombre: text('nombre').notNull(),

    /** Cuántas personas viven en la casa, contándole. Tope de 20 en un CHECK. */
    personasHogar: smallint('personas_hogar').notNull().default(1),

    /** Opcional, y normalizado a E.164 cuando se reconoce. */
    telefono: text('telefono'),

    /**
     * La versión del aviso que se le leyó en la puerta. NOT NULL: sin permiso
     * no se apunta a nadie, aunque se le entregue igual (ver `sin_inscribir`).
     *
     * No va a `consentimientos`, que exige `miembro_id`. La prueba del art. 7.1
     * es esta versión, la fecha y quién lo apuntó; NO hay IP ni navegador,
     * porque serían los del voluntario y no los de esta persona.
     */
    consentimientoVersion: text('consentimiento_version').notNull(),
    consentimientoAt: timestamp('consentimiento_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Se mudó, o ya no lo necesita. Sigue en el padrón y se puede reactivar. */
    bajaAt: timestamp('baja_at', { withTimezone: true }),

    /** Quién lo apuntó. Uuid pelado, como en eventos; la coherencia, HT126. */
    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_reparto_beneficiarios_numero').on(t.ministerioId, t.numero),
    index('idx_reparto_beneficiarios_iglesia').on(t.iglesiaId),
    check('ck_reparto_beneficiarios_numero', sql`${t.numero} > 0`),
    check(
      'ck_reparto_beneficiarios_nombre',
      sql`length(btrim(${t.nombre})) between 1 and 80`,
    ),
    check(
      'ck_reparto_beneficiarios_personas',
      sql`${t.personasHogar} between 1 and 20`,
    ),
    check(
      'ck_reparto_beneficiarios_telefono',
      sql`${t.telefono} is null or length(${t.telefono}) between 1 and 32`,
    ),
    check(
      'ck_reparto_beneficiarios_consentimiento',
      sql`${t.consentimientoVersion} ~ '^reparto-[0-9]{4}-[0-9]{2}$'`,
    ),
  ],
);

/**
 * Cada día que se reparte.
 *
 * Hace falta por lo mismo que `reuniones` en la asistencia: sin ella, un
 * domingo sin reparto sería idéntico a uno al que no vino nadie, y el total del
 * mes no sabría cuántos repartos hubo.
 */
export const repartoJornadas = pgTable(
  'reparto_jornadas',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** El día en la iglesia (`hoyEnLaIglesia`), no en UTC. */
    fecha: date('fecha').notNull(),

    /**
     * A cuántos se les entregó SIN apuntarles. Un número, sin nadie detrás.
     *
     * Es lo que hace cumplible la regla que más pesa del módulo: la comida no se
     * condiciona a dar datos. Quien no quiere que se le apunte se lleva su bolsa
     * igual, y el total del mes la cuenta.
     */
    sinInscribir: integer('sin_inscribir').notNull().default(0),

    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Un reparto por equipo y día: «Empezar el de hoy» pulsado dos veces no
    // abre dos jornadas.
    uniqueIndex('uq_reparto_jornadas_fecha').on(t.ministerioId, t.fecha),
    index('idx_reparto_jornadas_iglesia').on(t.iglesiaId),
    check(
      'ck_reparto_jornadas_sin_inscribir',
      sql`${t.sinInscribir} between 0 and 2000`,
    ),
  ],
);

/**
 * Quién vino a cada jornada y si se le entregó. Sin fila, no vino.
 *
 * BORRAR A UNA PERSONA NO BORRA LO QUE SE REPARTIÓ
 * ------------------------------------------------
 * `beneficiario_id` es ON DELETE SET NULL, y no CASCADE, a propósito. Borrar a
 * alguien del padrón —porque lo pide, o porque lleva un año sin venir— tiene que
 * llevarse su nombre, su teléfono y su número, y lo hace. Lo que no puede hacer
 * es cambiar las entregas de un mes que ya se le dio al banco de alimentos: la
 * fila se queda, sin nadie detrás, y sigue contando. Lo que sí baja es «hogares
 * distintos» de ese mes: sin persona no se sabe si dos filas eran el mismo hogar,
 * y se prefiere contar de menos a inventar a alguien.
 *
 * Por eso `personas_hogar` se COPIA aquí al entregar, en vez de leerse del
 * padrón: sin persona no habría de dónde sacarlo, y si el hogar crece el mes
 * que viene, el de hoy no tiene por qué cambiar. La copia la pone la base
 * (HT126), no la aplicación.
 */
export const repartoEntregas = pgTable(
  'reparto_entregas',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Redundante, como en el resto del repo: cada policy, una comparación. */
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** Redundante también, por la policy por equipo. Lo vigila HT126. */
    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    jornadaId: uuid('jornada_id')
      .notNull()
      .references(() => repartoJornadas.id, { onDelete: 'cascade' }),

    /** NULL solo después de borrar a la persona. Ver la cabecera. */
    beneficiarioId: uuid('beneficiario_id').references(
      () => repartoBeneficiarios.id,
      { onDelete: 'set null' },
    ),

    /** Copia del padrón al llegar; la escribe HT126 y no cambia (HT127). */
    personasHogar: smallint('personas_hogar').notNull().default(1),

    entregado: boolean('entregado').notNull().default(false),
    entregadoAt: timestamp('entregado_at', { withTimezone: true }),

    registradoPorMiembroId: uuid('registrado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La misma persona no recibe dos veces el mismo día. Las filas sin persona
    // no chocan entre sí: dos NULL no son iguales, y aquí eso es lo que se
    // quiere.
    uniqueIndex('uq_reparto_entregas_jornada_beneficiario').on(
      t.jornadaId,
      t.beneficiarioId,
    ),
    index('idx_reparto_entregas_iglesia').on(t.iglesiaId),
    // «Cuándo vino por última vez», que es lo que pinta el padrón y lo que
    // decide quién lleva un año sin venir.
    index('idx_reparto_entregas_beneficiario').on(t.beneficiarioId),
    check(
      'ck_reparto_entregas_personas',
      sql`${t.personasHogar} between 1 and 20`,
    ),
    // Una equivalencia y no dos condiciones sueltas, como `ck_inscripciones_pagado`.
    check(
      'ck_reparto_entregas_entregado',
      sql`${t.entregado} = (${t.entregadoAt} is not null)`,
    ),
  ],
);
