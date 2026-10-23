import {
  pgEnum,
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  date,
  time,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { miembros } from './miembros';
import { ministerios } from './ministerios';

/**
 * Los grupos pequeños que cuelgan de un ministerio: las células de una red, y
 * mañana las clases de la escuela dominical.
 *
 * UNA PIEZA Y NO UNA TABLA POR MÓDULO
 * -----------------------------------
 * Una célula y una clase son la misma forma: un nombre, quién lo lleva, quién va
 * y cuándo se reúne. Tres juegos de tablas serían doce policies y seis triggers
 * repetidos que acabarían discrepando. Por eso aquí no hay nada que diga
 * «célula»: la palabra la pone el tipo de ministerio (`lib/grupos/etiquetas.ts`).
 *
 * NI MINISTERIOS HIJOS
 * --------------------
 * Cada ministerio activo sale en la web pública de la iglesia, y «Célula familia
 * Pérez, barrio Kennedy» acabaría en internet. Y `ministerio_miembros` quiere
 * decir «quien sirve»: los participantes contarían como equipo y entrarían en el
 * ámbito de `/panel/miembros` de todo el que lleva algo.
 *
 * LA RLS ES POR RELACIÓN, NO SOLO POR IGLESIA (`0047`)
 * ----------------------------------------------------
 * Quién va a qué célula, y en qué casa y qué día se reúne, lo ven el pastor, el
 * equipo de la red y la gente de esa célula; no el resto de la congregación, ni
 * el líder de la célula de al lado. El porqué, en la cabecera de la `0047`.
 */

/**
 * Qué papel tiene cada persona dentro del grupo.
 *
 * Completo desde el primer día: un `add value` no se puede usar en la misma
 * transacción en que se añade, y los enums de este repo se completan cuando la
 * tabla está vacía, no cuando hace falta (ver `ESTADO.md`).
 *
 *   - `lider`: quien lo lleva. Uno activo por grupo, por índice.
 *   - `auxiliar`: le ayuda y puede reportar por él. Los que hagan falta.
 *   - `participante`: quien va. Una ficha de la iglesia, NO alguien del equipo.
 *
 * El líder y el auxiliar tienen que estar en el equipo del ministerio (HT132):
 * es lo que hace que «nombrar líder de célula» no sea una puerta lateral para
 * dar acceso a cualquiera.
 */
export const rolGrupoEnum = pgEnum('rol_grupo_enum', [
  'lider',
  'auxiliar',
  'participante',
]);

export type RolGrupo = (typeof rolGrupoEnum.enumValues)[number];

/**
 * En qué quedó la semana de un grupo.
 *
 * `prevista` es una semana que todavía no se ha reportado: la que tiene el tema
 * planificado de antemano, o la que se quedó sin reportar. `no_hubo` es un
 * reporte, y vale tanto como uno con cifras: lo que pide atención es el
 * silencio, no la semana en que se avisó de que no hubo reunión.
 */
export const estadoSemanaGrupoEnum = pgEnum('estado_semana_grupo_enum', [
  'prevista',
  'celebrada',
  'no_hubo',
]);

export type EstadoSemanaGrupo = (typeof estadoSemanaGrupoEnum.enumValues)[number];

/**
 * El grupo: «Los Pinos, martes a las 19:30, barrio Kennedy».
 *
 * SIN DIRECCIÓN
 * -------------
 * Una célula se reúne casi siempre en casa de alguien de la congregación, y
 * «Fulano acoge reuniones cristianas los martes en su casa» junta domicilio y
 * religión. Basta con el barrio o la zona, el día y la hora; la dirección la
 * manda el líder por WhatsApp a quien vaya a ir. Ni campo de descripción: es el
 * sitio donde acabaría escrita.
 */
export const grupos = pgTable(
  'grupos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** La red de la que cuelga. Lo valida HT132 contra la iglesia. */
    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),

    /** Barrio, sector o zona. Nunca la calle. Ver la cabecera. */
    zona: text('zona'),

    /** 0 domingo … 6 sábado, como `Date.getUTCDay()` y `horarios.ts`. */
    diaSemana: smallint('dia_semana').notNull(),
    /** Hora local de la iglesia, como `reuniones.hora`. Opcional. */
    hora: time('hora'),

    /**
     * Lo que lleva el enlace de invitación a `/solicitar` con el grupo marcado.
     *
     * Ocho letras de un alfabeto sin confusiones (sin 0/O ni 1/I), sacadas de
     * `crypto` y no de `Math.random()`: es lo único que separa a quien tiene el
     * enlace de quien prueba códigos. Se puede cambiar desde la ficha —un enlace
     * que circula por donde no debía se mata regenerándolo—, y lo genera la
     * aplicación (`lib/grupos/codigo.ts`), no un `default` de la base, para que
     * esta tabla no dependa de una función que nace en otra migración.
     */
    codigo: text('codigo').notNull(),

    /**
     * Cerrado: ya no se reúne. Se conserva por su historial de semanas, sale de
     * las listas y su enlace deja de valer. Sus integrantes se dan de baja del
     * grupo al cerrarlo.
     */
    activo: boolean('activo').notNull().default(true),

    /** Uuid pelado, como en turnos. Lo valida HT132 al insertar. */
    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_grupos_codigo').on(t.codigo),
    // Dos células abiertas con el mismo nombre en la misma red son un doble
    // clic, o dos que nadie sabría distinguir en la lista.
    uniqueIndex('uq_grupos_nombre_activo')
      .on(t.ministerioId, sql`lower(${t.nombre})`)
      .where(sql`activo = true`),
    index('idx_grupos_iglesia').on(t.iglesiaId),
    index('idx_grupos_ministerio').on(t.ministerioId),
    check('ck_grupos_nombre', sql`length(btrim(${t.nombre})) between 1 and 80`),
    check(
      'ck_grupos_zona',
      sql`${t.zona} is null or length(btrim(${t.zona})) between 1 and 60`,
    ),
    check('ck_grupos_dia', sql`${t.diaSemana} between 0 and 6`),
    check('ck_grupos_codigo', sql`${t.codigo} ~ '^[A-HJ-NP-Z2-9]{8}$'`),
  ],
);

/**
 * Quién está en cada grupo y con qué papel.
 *
 * `ministerio_id` REDUNDANTE, COMO `iglesia_id`
 * ---------------------------------------------
 * Se deduce del grupo, y está aquí por dos cosas: la policy de la `0047` es una
 * comparación directa (`lidera_ministerio(ministerio_id)`) en vez de una
 * subconsulta por fila, y el índice de «una sola célula como participante por
 * red» lo necesita. HT132 lo vigila.
 *
 * NO LLEVA `auditar()`
 * --------------------
 * Que una persona va a una célula concreta es pertenencia religiosa nominal.
 * `auditoria` se lee entera desde `hatril_app` y no tiene DELETE: auditar esto
 * abriría una segunda puerta a la lista que la RLS cierra, y haría imposible
 * borrarla cuando la persona lo pida. El precio es no saber quién nombró a cada
 * líder, el mismo que se pagó en `turno_asignaciones`.
 *
 * SUPRESIÓN
 * ---------
 * Cuelga de la ficha con ON DELETE CASCADE: borrar a la persona se lleva sus
 * filas. Va en la lista de tablas con personas del borrado manual (ver
 * `docs/modulos/estado-celulas.md`).
 */
export const grupoMiembros = pgTable(
  'grupo_miembros',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    grupoId: uuid('grupo_id')
      .notNull()
      .references(() => grupos.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    rolGrupo: rolGrupoEnum('rol_grupo').notNull().default('participante'),

    desde: date('desde').defaultNow(),
    hasta: date('hasta'),
    activo: boolean('activo').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una vez por grupo, y conservando el histórico de quien salió.
    uniqueIndex('uq_grupo_miembro_activo')
      .on(t.grupoId, t.miembroId)
      .where(sql`activo = true`),
    // Un líder por grupo, como el responsable de un ministerio. Los auxiliares,
    // los que hagan falta.
    uniqueIndex('uq_grupo_lider_activo')
      .on(t.grupoId)
      .where(sql`rol_grupo = 'lider' AND activo = true`),
    // Como participante, en una sola célula de cada red. Sin esto, la misma
    // persona contaría dos veces en los integrantes de la red. Los líderes no
    // entran: en muchas redes el líder va además a la célula de su supervisor.
    uniqueIndex('uq_grupo_participante_por_ministerio')
      .on(t.ministerioId, t.miembroId)
      .where(sql`rol_grupo = 'participante' AND activo = true`),
    index('idx_grupo_miembros_iglesia').on(t.iglesiaId),
    index('idx_grupo_miembros_grupo').on(t.grupoId),
    // «En qué grupos estoy», que piden la app y las funciones de la `0047`.
    index('idx_grupo_miembros_miembro')
      .on(t.miembroId)
      .where(sql`activo = true`),
  ],
);

/**
 * Cada semana de un grupo: el tema, y si se reunió y cuántos fueron.
 *
 * POR SEMANA Y NO POR FECHA
 * -------------------------
 * Lo que se reporta es «la célula de esta semana», y lo que se planifica es «el
 * tema de las próximas semanas»: las dos cosas son por semana, como la guía de
 * la red (`grupo_guias`). Con una fecha exacta, una célula que se reúne el
 * miércoles en vez del martes dejaría el martes «sin reportar» para siempre.
 * `semana` es el lunes de esa semana, y lo exige un CHECK.
 *
 * UN RECUENTO, NO UNA LISTA
 * -------------------------
 * `asistentes` y `visitas` son números, sin nadie detrás. La razón larga está en
 * la `0047`; la corta: una lista nominal tendría que dejar fuera a quien negó el
 * permiso de asistencia, y entonces o el número miente o esa persona acaba
 * contada como visita. Contar a los que estaban en la sala no apunta a nadie, y
 * es lo que pidió Marlon: «cuántos vinieron».
 *
 * Sin notas ni peticiones de oración: «por la operación de doña X» es un dato de
 * salud. El tema va acotado a 120 caracteres por lo mismo.
 */
export const grupoSemanas = pgTable(
  'grupo_semanas',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    grupoId: uuid('grupo_id')
      .notNull()
      .references(() => grupos.id, { onDelete: 'cascade' }),

    /** El lunes de la semana. */
    semana: date('semana').notNull(),

    estado: estadoSemanaGrupoEnum('estado').notNull().default('prevista'),

    /** El de esta célula. Si no hay, se propone el de la guía de la red. */
    tema: text('tema'),

    /** Cuántos de la célula fueron, contando a quien la lleva. */
    asistentes: smallint('asistentes'),
    /** Gente de fuera. Un número anónimo: de las visitas no se apunta a nadie. */
    visitas: smallint('visitas'),

    /** Uuid pelado. Lo valida HT132 al cambiar. */
    reportadoPorMiembroId: uuid('reportado_por_miembro_id'),
    reportadoAt: timestamp('reportado_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_grupo_semanas_semana').on(t.grupoId, t.semana),
    index('idx_grupo_semanas_iglesia').on(t.iglesiaId),
    // «Cómo va la red esta semana», que es la cabecera del listado.
    index('idx_grupo_semanas_ministerio').on(t.ministerioId, t.semana),
    check('ck_grupo_semanas_lunes', sql`extract(isodow from ${t.semana}) = 1`),
    check(
      'ck_grupo_semanas_tema',
      sql`${t.tema} is null or length(btrim(${t.tema})) between 1 and 120`,
    ),
    check(
      'ck_grupo_semanas_cifras',
      sql`(${t.asistentes} is null or ${t.asistentes} between 0 and 500)
          and (${t.visitas} is null or ${t.visitas} between 0 and 200)`,
    ),
    // Lo que cada estado lleva y lo que no. Una semana prevista sin reportar no
    // tiene cifras; «no hubo» tampoco, pero sí quién lo dijo y cuándo; una
    // celebrada, las dos cosas.
    check(
      'ck_grupo_semanas_estado',
      sql`(${t.estado} = 'prevista' and ${t.asistentes} is null and ${t.visitas} is null and ${t.reportadoAt} is null)
          or (${t.estado} = 'no_hubo' and ${t.asistentes} is null and ${t.visitas} is null and ${t.reportadoAt} is not null)
          or (${t.estado} = 'celebrada' and ${t.asistentes} is not null and ${t.visitas} is not null and ${t.reportadoAt} is not null)`,
    ),
  ],
);

/**
 * La guía común de la semana: el tema que la red propone a todas sus células.
 *
 * Lo publica quien lleva el ministerio, y cada célula lo recibe como propuesta
 * por defecto en su reporte y en sus próximas semanas; si su líder escribe otro,
 * manda el suyo. No es dato de nadie, así que la lee toda la iglesia (`0047`).
 */
export const grupoGuias = pgTable(
  'grupo_guias',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** El lunes de la semana, como `grupo_semanas.semana`. */
    semana: date('semana').notNull(),

    tema: text('tema').notNull(),

    publicadoPorMiembroId: uuid('publicado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_grupo_guias_semana').on(t.ministerioId, t.semana),
    index('idx_grupo_guias_iglesia').on(t.iglesiaId),
    check('ck_grupo_guias_lunes', sql`extract(isodow from ${t.semana}) = 1`),
    check('ck_grupo_guias_tema', sql`length(btrim(${t.tema})) between 1 and 120`),
  ],
);
