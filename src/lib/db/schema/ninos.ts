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
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { miembros } from './miembros';
import { ministerios } from './ministerios';
import {
  parentescoNinoEnum,
  permisoNinoEnum,
  tipoArchivoNinoEnum,
} from './enums';

/**
 * El ministerio de Niños: qué familia es de qué niño, el tablón que ven los
 * padres, el cronograma de los maestros y el drive de fotos y vídeos.
 *
 * El plan y el porqué de cada decisión están en `docs/modulos/plan-ninos.md`;
 * los textos que firma cada familia, en `docs/modulos/ninos-textos.md`.
 *
 * LO QUE HACE DISTINTO A ESTE MÓDULO
 * ----------------------------------
 * Son datos de MENORES, su imagen y, por el contexto, las creencias de su
 * familia. De ahí salen las rarezas:
 *
 *   1. El niño NO es una fila de `miembros`. Allí contaría para el precio, lo
 *      leería toda la iglesia por RLS, lo vería secretaría y consolidación lo
 *      llamaría por «faltar». Aquí solo existe con un padre aceptado detrás.
 *   2. Lo mínimo: el nombre con que le llaman y el año de nacimiento. Ni
 *      apellidos, ni fecha completa, ni foto de perfil, ni una sola casilla de
 *      texto libre sobre el niño.
 *   3. RLS por RELACIÓN, no por iglesia (`0060`): el padre ve a SU hijo; quien
 *      lidera el ministerio y el pastor, a todos; nadie más, aunque tenga
 *      `ver_todos_los_miembros`.
 *   4. Sin `auditar()`: su tabla no se puede borrar, y «se borra al año» o
 *      «al desvincularte se va su nombre» serían falsos.
 *   5. Las fotos y su publicación caducan solas: `caduca_el` es una columna
 *      generada, así que nadie puede alargarle la vida a una foto.
 */

/**
 * «Tengo un hijo en Niños», pendiente de que la responsable lo acepte.
 *
 * Tabla aparte, y no una fila de `ninos` con estado, para que un niño no exista
 * hasta que alguien ha comprobado en persona quién lo pide. Al resolverse, la
 * fila se borra: si se acepta, `aceptar_solicitud_nino()` se lleva lo que hace
 * falta a `ninos`, `nino_familias` y `nino_consentimientos`; si se rechaza, no
 * queda nada.
 *
 * Guarda la prueba del art. 7.1 tal como llegó —qué casillas, qué versión del
 * texto, desde dónde— para que el permiso que se apunta al aceptar sea el que
 * dio el padre, no el que recuerda la responsable.
 */
export const ninosSolicitudes = pgTable(
  'ninos_solicitudes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /**
     * La ficha de quien lo pide. Su ficha y no su cuenta: es lo que enlaza la
     * RLS (`miembro_actual()`), y una cuenta sin ficha no tiene a quién
     * vincular.
     */
    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** El nombre con el que le llaman. No tiene por qué ser el del documento. */
    nombre: text('nombre').notNull(),

    /** Solo el año. Hasta 13 años: lo comprueba HT142 al pedirlo. */
    anioNacimiento: smallint('anio_nacimiento').notNull(),

    parentesco: parentescoNinoEnum('parentesco').notNull(),

    /** La casilla opcional de las fotos, tal como llegó. */
    permisoImagen: boolean('permiso_imagen').notNull().default(false),

    versionTexto: text('version_texto').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // El mismo niño pedido dos veces por el mismo padre —doble toque, o volver
    // a pedirlo mientras espera— es una sola petición.
    uniqueIndex('uq_ninos_solicitudes_padre_nombre').on(
      t.ministerioId,
      t.miembroId,
      sql`lower(btrim(${t.nombre}))`,
    ),
    index('idx_ninos_solicitudes_iglesia').on(t.iglesiaId),
    check('ck_ninos_solicitudes_nombre', sql`length(btrim(${t.nombre})) between 1 and 60`),
    check('ck_ninos_solicitudes_version', sql`${t.versionTexto} ~ '^ninos-[0-9]{4}-[0-9]{2}$'`),
    check('ck_ninos_solicitudes_ip', sql`${t.ip} is null or length(${t.ip}) <= 64`),
    check(
      'ck_ninos_solicitudes_user_agent',
      sql`${t.userAgent} is null or length(${t.userAgent}) <= 512`,
    ),
  ],
);

/**
 * El niño. Existe solo mientras tenga al menos un padre vinculado: al irse el
 * último, un trigger lo borra (`0060`), y con él sus permisos.
 *
 * Sin `creado_por`: lo crea siempre `aceptar_solicitud_nino()`, y quién aceptó
 * se apunta en `nino_familias`.
 */
export const ninos = pgTable(
  'ninos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),
    anioNacimiento: smallint('anio_nacimiento').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_ninos_ministerio').on(t.ministerioId),
    index('idx_ninos_iglesia').on(t.iglesiaId),
    check('ck_ninos_nombre', sql`length(btrim(${t.nombre})) between 1 and 60`),
  ],
);

/**
 * Qué adulto es de qué niño, ya aceptado. Es la llave de la RLS del padre.
 *
 * Enlaza la FICHA del adulto, no su cuenta, como `ninos_solicitudes`. Los dos
 * padres de un niño son dos filas sobre el mismo `nino_id`.
 *
 * `aceptado_at` decide desde cuándo ve el tablón (`familia_desde()`, `0060`):
 * una familia nueva no ve el historial de fotos de antes de llegar.
 */
export const ninoFamilias = pgTable(
  'nino_familias',
  {
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    ninoId: uuid('nino_id')
      .notNull()
      .references(() => ninos.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    parentesco: parentescoNinoEnum('parentesco').notNull(),

    aceptadoAt: timestamp('aceptado_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Quién lo comprobó en persona. Uuid pelado, como las firmas del reparto. */
    aceptadoPorMiembroId: uuid('aceptado_por_miembro_id'),
  },
  (t) => [
    primaryKey({ columns: [t.ninoId, t.miembroId] }),
    index('idx_nino_familias_padre').on(t.ministerioId, t.miembroId),
    index('idx_nino_familias_iglesia').on(t.iglesiaId),
  ],
);

/**
 * Los permisos de cada padre sobre su hijo: la prueba del art. 7.1.
 *
 * Una fila por niño, padre y permiso, y retirar no borra: pone `revocado_at`.
 * Volver a darlo es otra fila. El único vivo por trío lo garantiza el índice.
 *
 * No va a `consentimientos`, que exige que cada uno consienta sobre sí mismo.
 *
 * «Puede salir en fotos» no se guarda: se calcula, y es que TODOS sus padres
 * vinculados tengan `imagen` vivo. Si uno lo retira, deja de poder.
 */
export const ninoConsentimientos = pgTable(
  'nino_consentimientos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    ninoId: uuid('nino_id')
      .notNull()
      .references(() => ninos.id, { onDelete: 'cascade' }),

    /** Quién lo dio: la ficha de la madre, el padre o el tutor. */
    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    tipo: permisoNinoEnum('tipo').notNull(),
    versionTexto: text('version_texto').notNull(),

    otorgadoAt: timestamp('otorgado_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revocadoAt: timestamp('revocado_at', { withTimezone: true }),

    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [
    uniqueIndex('uq_nino_consentimientos_vivo')
      .on(t.ninoId, t.miembroId, t.tipo)
      .where(sql`${t.revocadoAt} is null`),
    index('idx_nino_consentimientos_iglesia').on(t.iglesiaId),
    check('ck_nino_consentimientos_version', sql`${t.versionTexto} ~ '^ninos-[0-9]{4}-[0-9]{2}$'`),
    check('ck_nino_consentimientos_ip', sql`${t.ip} is null or length(${t.ip}) <= 64`),
    check(
      'ck_nino_consentimientos_user_agent',
      sql`${t.userAgent} is null or length(${t.userAgent}) <= 512`,
    ),
  ],
);

/**
 * El cronograma de las clases: qué día, de qué va y qué puntos se tratan.
 *
 * Interno: lo ven quien lidera el ministerio y el pastor, nadie más. Ni los
 * padres ni el resto de la iglesia.
 *
 * Sin único por fecha: un domingo puede tener dos clases (la v1 va sin clases
 * por edad, pero eso no obliga a una sola entrada al día).
 */
export const ninosCronograma = pgTable(
  'ninos_cronograma',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    fecha: date('fecha').notNull(),
    tema: text('tema').notNull(),

    /** Los puntos de la clase. Es del tema, nunca de un niño. */
    puntos: text('puntos'),

    /** Quién la da, si ya se sabe. Si deja la iglesia, el día se queda sin nadie. */
    maestroMiembroId: uuid('maestro_miembro_id').references(() => miembros.id, {
      onDelete: 'set null',
    }),

    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_ninos_cronograma_fecha').on(t.ministerioId, t.fecha),
    index('idx_ninos_cronograma_iglesia').on(t.iglesiaId),
    check('ck_ninos_cronograma_tema', sql`length(btrim(${t.tema})) between 1 and 120`),
    check(
      'ck_ninos_cronograma_puntos',
      sql`${t.puntos} is null or length(${t.puntos}) <= 2000`,
    ),
  ],
);

/**
 * El tablón: lo que se hizo un día, con texto y, si acaso, fotos y vídeos del
 * drive (`ninos_archivos.publicacion_id`).
 *
 * Sin `publicada_at` es un borrador y solo lo ven los maestros. Publicada, la
 * ven las familias aceptadas cuya aceptación es de ese día o anterior.
 */
export const ninosPublicaciones = pgTable(
  'ninos_publicaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** El día de la actividad, en la iglesia (`hoyEnLaIglesia`). */
    fecha: date('fecha').notNull(),

    texto: text('texto').notNull(),

    autorMiembroId: uuid('autor_miembro_id'),

    publicadaAt: timestamp('publicada_at', { withTimezone: true }),

    /**
     * El día 1 del mes siguiente al cumplir el año, calculado por la base. Lo
     * de noviembre de 2026 se va el 1-dic-2027: así se exporta un mes entero
     * de una vez, y nada vive más de trece meses.
     */
    caducaEl: date('caduca_el').generatedAlwaysAs(
      sql`(date_trunc('month', fecha::timestamp) + interval '13 months')::date`,
    ),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_ninos_publicaciones_fecha').on(t.ministerioId, t.fecha),
    index('idx_ninos_publicaciones_caduca').on(t.caducaEl),
    index('idx_ninos_publicaciones_iglesia').on(t.iglesiaId),
    check('ck_ninos_publicaciones_texto', sql`length(btrim(${t.texto})) between 1 and 1000`),
  ],
);

/**
 * El drive: cada foto o vídeo que suben los maestros.
 *
 * La fila nace ANTES que el fichero: el servidor la apunta, pide a Storage una
 * URL de subida de un solo uso para su `ruta`, y el teléfono sube con ella.
 * Hasta que el servidor confirma que el fichero está y es lo que dice ser,
 * `confirmado_at` va vacío y no lo ve nadie más que los maestros. Las que no se
 * confirman las borra el cron.
 *
 * El bucket sale del tipo: `ninos-fotos` o `ninos-videos` (`0060`). La ruta
 * empieza siempre por `<iglesia>/<ministerio>/`, y lo comprueba HT142.
 */
export const ninosArchivos = pgTable(
  'ninos_archivos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    tipo: tipoArchivoNinoEnum('tipo').notNull(),

    /** Dentro de su bucket. Única: dos filas no pueden ser el mismo fichero. */
    ruta: text('ruta').notNull(),

    /** La miniatura de 400 px que saca el teléfono, en `ninos-fotos`. */
    miniaturaRuta: text('miniatura_ruta'),

    bytes: integer('bytes').notNull(),

    /** La que dice el teléfono. El límite que de verdad manda es el del bucket. */
    duracionS: smallint('duracion_s'),

    /** El día de la actividad. De él sale cuándo se borra. */
    fecha: date('fecha').notNull(),

    caducaEl: date('caduca_el').generatedAlwaysAs(
      sql`(date_trunc('month', fecha::timestamp) + interval '13 months')::date`,
    ),

    /** En qué publicación del tablón va, si va en alguna. */
    publicacionId: uuid('publicacion_id').references(() => ninosPublicaciones.id, {
      onDelete: 'set null',
    }),

    subidoPorMiembroId: uuid('subido_por_miembro_id'),

    confirmadoAt: timestamp('confirmado_at', { withTimezone: true }),
    exportadoAt: timestamp('exportado_at', { withTimezone: true }),

    /**
     * Cuándo se avisó de que se borra (30 días antes). Lo pone el cron, y es
     * lo que impide que avise cada día de lo mismo (`lib/ninos/caducidad.ts`).
     */
    avisadoAt: timestamp('avisado_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_ninos_archivos_ruta').on(t.tipo, t.ruta),
    index('idx_ninos_archivos_fecha').on(t.ministerioId, t.fecha),
    index('idx_ninos_archivos_publicacion').on(t.publicacionId),
    index('idx_ninos_archivos_caduca').on(t.caducaEl),
    index('idx_ninos_archivos_iglesia').on(t.iglesiaId),
    // Los límites de los buckets, repetidos: 5 MB las fotos, 100 MB los vídeos.
    check(
      'ck_ninos_archivos_bytes',
      sql`${t.bytes} > 0 and ${t.bytes} <= case when ${t.tipo} = 'foto' then 5242880 else 104857600 end`,
    ),
    check(
      'ck_ninos_archivos_duracion',
      sql`${t.duracionS} is null or (${t.tipo} = 'video' and ${t.duracionS} between 1 and 60)`,
    ),
    check('ck_ninos_archivos_ruta', sql`length(${t.ruta}) between 1 and 300`),
    check(
      'ck_ninos_archivos_miniatura',
      sql`${t.miniaturaRuta} is null or length(${t.miniaturaRuta}) between 1 and 300`,
    ),
  ],
);
