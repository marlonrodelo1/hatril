import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  numeric,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';

/**
 * El libro de caja de la iglesia.
 *
 * TRES TABLAS Y NI UNA MÁS
 * ------------------------
 * El tesorero de una congregación de 120 personas es un profesor o una
 * enfermera que apunta la ofrenda el domingo por la noche desde el móvil. Todo
 * lo que no sea «cuánto, de qué fondo y a qué caja» le sobra, y el producto que
 * le pide un plan de cuentas lo devuelve al cuaderno.
 *
 * Por eso aquí no hay categorías de gasto, ni arqueos, ni cierres de periodo, ni
 * asientos. Están diseñados y aplazados a conciencia; el porqué de cada uno está
 * en el plan de finanzas, no aquí.
 *
 * LO QUE NO GUARDA, Y ES LO MÁS IMPORTANTE DE ESTE FICHERO
 * --------------------------------------------------------
 * **Ni un nombre de donante.** `tipo_ingreso` distingue un diezmo de una ofrenda
 * para poder sumarlos por separado, pero NADA vincula un importe con una
 * persona.
 *
 * No es un olvido ni una simplificación: es que hoy no hay base jurídica para
 * hacerlo. El consentimiento que la gente ha marcado —`datos_religiosos`, art.
 * 9.2.a— dice que se guardan sus datos y su vínculo con la iglesia «para que la
 * congregación pueda organizarse». Eso no cubre «y cuánto dinero doy, con mi
 * nombre, durante años». Guardarlo bajo ese texto sería tratar sin base desde la
 * primera fila, y el dato es dinero cruzado con confesión religiosa: lo más
 * delicado que llegaría a guardar Hatril.
 *
 * El diezmo nominativo sigue decidido (`ESTADO.md`) y sigue haciendo falta para
 * el certificado de donación. Lo que cambia es el orden: primero el
 * consentimiento granular, después la tabla satélite. Cuando llegue, el nombre
 * NO viene aquí como una columna: va en su propia tabla, sin un solo GRANT, y se
 * lee por funciones `security definer` que registran cada consulta. Una columna
 * en `movimientos` no se puede ocultar a quien ya lee la fila —los GRANT son por
 * columna pero todas las sesiones entran como el mismo rol, `hatril_app`— y
 * haría mentir a cualquier `sum()` que la RLS filtrase.
 *
 * LA RLS AÍSLA IGLESIAS, NO REPARTE PERMISOS
 * ------------------------------------------
 * Igual que en el resto del repo (ver `0001:330-339` y `0012:69`): las policies
 * comprueban `pertenece_a_iglesia()` y nada más. Que solo el tesorero y el
 * pastor entren aquí lo decide `gestionar_finanzas` en
 * `src/lib/auth/permisos.ts`, en la capa de aplicación.
 */

/**
 * Si el dinero entra o sale. No se guarda el signo del importe: ver la columna
 * generada `importe_con_signo` más abajo.
 */
export const tipoMovimientoEnum = pgEnum('tipo_movimiento_enum', [
  'ingreso',
  'gasto',
]);

/**
 * Dónde está el dinero quieto.
 *
 * `billetera` es Nequi y Daviplata, que en Colombia GUARDAN saldo y por tanto
 * son un sitio donde el dinero se queda. Bizum no guarda nada —es una
 * transferencia inmediata entre cuentas— y por eso es método de pago y no caja.
 * Meterlos en el mismo cajón daría un saldo de Bizum que nunca existió.
 */
export const tipoCajaEnum = pgEnum('tipo_caja_enum', [
  'efectivo',
  'banco',
  'billetera',
  'pasarela',
]);

/** Cómo se movió el dinero. Distinto de la caja: el «cómo», no el «dónde». */
export const metodoPagoEnum = pgEnum('metodo_pago_enum', [
  'efectivo',
  'transferencia',
  'tarjeta',
  'otro',
]);

/**
 * Qué clase de ingreso es. Solo aplica a los ingresos; en un gasto es `null`, y
 * eso lo impone un CHECK, no la pantalla.
 *
 * Sirve para sumarlos por separado —«este mes: diezmos X, ofrendas Y»— y para
 * nada más. NO identifica a nadie: un diezmo aquí es un importe con fecha, igual
 * que una ofrenda.
 */
export const tipoIngresoEnum = pgEnum('tipo_ingreso_enum', [
  'diezmo',
  'ofrenda',
  'donacion',
  'otro',
]);

/**
 * De quién es el dinero.
 *
 * Es la tabla que separa a Hatril de una hoja de cálculo. Un saldo de 40
 * millones con 28 designados a la construcción del templo significa que hay 12
 * disponibles; enseñar 40 es mentir, y es exactamente la mentira que rompe la
 * confianza de una congregación cuando se descubre en la asamblea.
 *
 * Tabla y no enum porque la lista es de cada iglesia: una tiene «Misiones» y
 * «Construcción», otra tiene «Beca de estudio» y «Ayuda social». Un enum
 * obligaría a una migración por congregación.
 */
export const fondos = pgTable(
  'fondos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),

    /**
     * El fondo al que va lo que no se designa a nada. Exactamente uno por
     * iglesia, garantizado por el índice parcial de abajo y no por la
     * aplicación: sin fondo general, un ingreso sin designar no tendría dónde
     * caer y el formulario de alta se quedaría sin defecto.
     */
    esGeneral: boolean('es_general').notNull().default(false),

    /** Para distinguirlos de un vistazo en el resumen. Mismo criterio que los ministerios. */
    colorHex: text('color_hex'),

    /**
     * Archivar en vez de borrar. Un fondo con movimientos no se puede borrar sin
     * descuadrar el libro, y una campaña de construcción que terminó tiene que
     * seguir sumando en el histórico aunque ya no salga en el desplegable.
     */
    activo: boolean('activo').notNull().default(true),

    orden: integer('orden').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_fondos_general')
      .on(t.iglesiaId)
      .where(sql`${t.esGeneral}`),
    // Dos fondos «Misiones» en la misma iglesia son un error de dedo que luego
    // parte los totales en dos sin que nadie lo note. Sin distinguir mayúsculas,
    // que es como los escribe una persona con prisa.
    uniqueIndex('uq_fondos_nombre').on(t.iglesiaId, sql`lower(${t.nombre})`),
    index('idx_fondos_iglesia').on(t.iglesiaId, t.orden),
  ],
);

/**
 * Dónde está el dinero quieto: la caja fuerte del templo, la cuenta del banco,
 * el Nequi de la iglesia.
 *
 * Separada de `fondos` porque son preguntas distintas y la gente las confunde:
 * el fondo dice DE QUIÉN es el dinero, la caja dice DÓNDE está. Los 28 millones
 * de construcción pueden estar en el banco y los 12 del general en efectivo, o
 * al revés. Con una sola tabla no se puede contestar «¿cuánto hay en la cuenta?»
 * ni «¿cuánto puedo gastar sin tocar lo de la obra?», que son las dos preguntas.
 */
export const cajas = pgTable(
  'cajas',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),

    tipo: tipoCajaEnum('tipo').notNull(),

    activo: boolean('activo').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_cajas_nombre').on(t.iglesiaId, sql`lower(${t.nombre})`),
    index('idx_cajas_iglesia').on(t.iglesiaId),
  ],
);

/**
 * El libro. Cada peso que entra y cada peso que sale, en una sola tabla.
 *
 * UNA TABLA Y NO DOS
 * ------------------
 * La alternativa era `ingresos` y `gastos` separadas. Se descartó porque el
 * saldo pasaría a ser un UNION más una resta en la aplicación en vez de un
 * `sum()`, el libro cronológico —que es la pantalla principal— tendría que
 * mezclar dos consultas y paginarlas a mano, y sobre todo porque **cada trampa
 * documentada de este repo se duplicaría**: dos RLS, dos juegos de GRANT por
 * columna escritos a mano, dos triggers de coherencia. Las pocas columnas que
 * solo valen para una mitad las resuelve un CHECK.
 *
 * EL SALDO DE APERTURA NO ES UNA COLUMNA
 * --------------------------------------
 * Una iglesia que empieza con Hatril ya tiene dinero en la caja. Eso se apunta
 * como un ingreso más, con concepto «Saldo de apertura», y no como un
 * `saldo_inicial` en `cajas`. Con la columna habría que excluir de todas las
 * sumas los movimientos anteriores a su fecha, y el saldo dejaría de ser
 * `sum(importe_con_signo)` en cuanto alguien apuntara algo con fecha vieja. Como
 * movimiento, el tesorero además VE de dónde sale el número.
 */
export const movimientos = pgTable(
  'movimientos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    tipo: tipoMovimientoEnum('tipo').notNull(),

    /**
     * `date` y no `timestamptz` a propósito.
     *
     * La ofrenda del culto del domingo es del domingo, no de las 11:47:03 UTC.
     * Con marca de tiempo, un movimiento apuntado a las 20:30 en Bogotá cae en
     * el día siguiente en UTC y el mes cierra descuadrado. `created_at` sigue
     * siendo `timestamptz` porque «cuándo ocurrió» y «cuándo se apuntó» son
     * cosas distintas y las dos hacen falta.
     */
    fecha: date('fecha', { mode: 'string' }).notNull(),

    /**
     * Siempre positivo. La dirección la da `tipo`.
     *
     * `numeric` y no céntimos en entero por el peso colombiano: ISO 4217 le
     * asigna dos decimales, pero en la calle no hay céntimos, así que con
     * enteros `25000000` y `250000` son ambos defendibles para 250.000 pesos y
     * alguien se equivoca por cien tarde o temprano. Aquí se guarda `250000.00`,
     * que es lo que el tesorero tecleó.
     *
     * Sale de la base como CADENA (defecto de postgres-js, y se deja así) para
     * que nadie lo sume con `Number()` y pierda precisión: los totales se hacen
     * con `sum()` en SQL, e `Intl.NumberFormat` acepta cadena.
     *
     * Sin columna `moneda`: la moneda es de la iglesia (`iglesias.moneda`). Una
     * por fila invita a sumar pesos con euros.
     */
    importe: numeric('importe', { precision: 14, scale: 2 }).notNull(),

    /**
     * El importe con su signo, calculado por Postgres.
     *
     * Columna generada y no un campo que escriba la aplicación: así el saldo es
     * `sum(importe_con_signo)` y no puede desincronizarse del `tipo`, porque no
     * la escribe nadie. Un `update ... set tipo = 'gasto'` la recalcula sola.
     */
    importeConSigno: numeric('importe_con_signo', {
      precision: 14,
      scale: 2,
    }).generatedAlwaysAs(
      sql`case when tipo = 'ingreso' then importe else -importe end`,
    ),

    /**
     * Qué fue. «Ofrenda del culto del domingo», «Recibo de la luz».
     *
     * OJO: es texto libre y lo ve cualquiera con `gestionar_finanzas`, además de
     * salir tal cual en el CSV que se le pasa al contador. Es el agujero por el
     * que se cuela lo que esta tabla evita estructuralmente: el primer tesorero
     * que escriba «Diezmo de Lucía Peñaloza» derriba la separación entera.
     *
     * No hay defensa técnica completa. La que hay es un aviso junto al campo en
     * el formulario y una cabecera en el CSV. Por eso mismo NO existe una
     * columna `beneficiario`: un campo con ese nombre invita a escribir el
     * nombre de quien recibió una ayuda —y con él el motivo, que suele ser de
     * salud (art. 9.1 RGPD, art. 5 Ley 1581)—. Cuando haga falta, irá en su
     * propia tabla satélite con el mismo trato que el donante.
     */
    concepto: text('concepto').notNull(),

    /**
     * `restrict` en los dos: borrar un fondo o una caja que tiene movimientos
     * descuadraría el libro en silencio. Se archivan con `activo`, no se borran.
     */
    fondoId: uuid('fondo_id')
      .notNull()
      .references(() => fondos.id, { onDelete: 'restrict' }),

    cajaId: uuid('caja_id')
      .notNull()
      .references(() => cajas.id, { onDelete: 'restrict' }),

    metodoPago: metodoPagoEnum('metodo_pago').notNull().default('efectivo'),

    /** Número de consignación o de transferencia. Para cuadrar con el extracto. */
    referencia: text('referencia'),

    /** Solo en ingresos. Lo impone `ck_movimientos_tipo_ingreso`. */
    tipoIngreso: tipoIngresoEnum('tipo_ingreso'),

    /**
     * Quién lo apuntó. Uuid pelado sin FK, igual que `devocionales.autor_miembro_id`,
     * con la coherencia por trigger.
     *
     * Sin FK a propósito, y las tres alternativas son peores: con `restrict` no
     * se podría dar de baja nunca a quien apuntó algo; con `cascade` ejercer el
     * derecho de supresión BORRARÍA sus movimientos y descuadraría el libro de
     * la iglesia; con `set null` el borrado se convierte en un UPDATE que
     * reevalúa los checks y falla con un error que nadie relacionaría con la
     * causa.
     */
    registradoPorMiembroId: uuid('registrado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('ck_movimientos_importe_positivo', sql`${t.importe} > 0`),

    // Una equivalencia, no dos checks sueltos: prohíbe el gasto con
    // `tipo_ingreso` relleno Y el ingreso sin él. Escrito como dos condiciones
    // separadas, el caso inverso se cuela.
    check(
      'ck_movimientos_tipo_ingreso',
      sql`(${t.tipo} = 'ingreso') = (${t.tipoIngreso} is not null)`,
    ),

    // El libro y todos los rangos de fecha. Es la consulta de cada pantalla.
    index('idx_movimientos_libro').on(t.iglesiaId, t.fecha.desc()),

    // Los saldos. SIN fecha a propósito: el saldo de una caja es la suma de
    // TODO su histórico, no la de un periodo.
    index('idx_movimientos_caja').on(t.iglesiaId, t.cajaId),
    index('idx_movimientos_fondo').on(t.iglesiaId, t.fondoId),
  ],
);
