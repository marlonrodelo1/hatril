import {
  pgEnum,
  pgTable,
  uuid,
  text,
  date,
  time,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { ministerios } from './ministerios';
import { miembros } from './miembros';

/**
 * Un encuentro que ocurre de verdad, con su fecha.
 *
 * TRES COSAS PARECIDAS Y DISTINTAS
 * --------------------------------
 *   - `iglesias.horarios` (jsonb) es el PATRÓN semanal: «los domingos a las 10».
 *     No tiene fechas y no se le pasa lista.
 *   - `eventos` son actos con inscripción, aforo y precio, abiertos a gente que
 *     no es de la congregación. Guardan datos de desconocidos y por eso llevan
 *     consentimiento, IP y su propia política.
 *   - `reuniones` es esto: el culto del domingo 24, el ensayo del jueves, la
 *     clase de los niños. Ni se publica, ni se inscribe nadie, ni sale de la
 *     iglesia. Lo único que se hace con ella es apuntar quién vino.
 *
 * `ministerio_id` NULO NO ES UN HUECO, ES EL EJE
 * ----------------------------------------------
 * Sin ministerio, es una reunión de la congregación entera: el culto del
 * domingo, el de oración del jueves. Con ministerio, es del equipo: un ensayo,
 * una clase, una salida a repartir comida.
 *
 * Y de esa distinción cuelga lo importante: **solo las reuniones de la
 * congregación cuentan para el histórico de asistencia**. A nadie se le
 * consolida por faltar al ensayo de alabanza, y si los ensayos contaran,
 * `ultima_asistencia` diría que el guitarrista viene cada semana aunque lleve
 * dos meses sin pisar un culto — que es justo la persona a la que hay que
 * llamar.
 *
 * `date` + `time` Y NO UN `timestamptz`
 * -------------------------------------
 * `eventos.inicio_en` es timestamptz porque el corte de aforo se evalúa contra
 * el reloj dentro de plpgsql. Aquí no se compara nada con «ahora»: «el domingo a
 * las 10» es una hora local de esa congregación y se guarda tal cual, como
 * `movimientos.fecha`. Con timestamptz habría que decidir en qué huso se
 * escribe y en cuál se lee, y la primera iglesia que cambiara de zona horaria
 * vería su histórico moverse solo.
 */
export const reuniones = pgTable(
  'reuniones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** Nulo = de la congregación. Con valor = de ese equipo. Ver la cabecera. */
    ministerioId: uuid('ministerio_id').references(() => ministerios.id, {
      onDelete: 'cascade',
    }),

    titulo: text('titulo').notNull(),

    fecha: date('fecha').notNull(),
    hora: time('hora'),

    lugar: text('lugar'),

    /**
     * Cómo fue, qué se hizo. Notas del encuentro, NO de las personas: nada de
     * «Fulano vino llorando». El seguimiento pastoral tiene su propio sitio y su
     * propia lista cerrada, precisamente para que eso no acabe aquí.
     */
    notas: text('notas'),

    /** Uuid pelado, sin FK, como `eventos.creado_por_miembro_id`. Lo valida HT116. */
    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La consulta de cabecera es siempre «las reuniones de esta iglesia, de la
    // más reciente hacia atrás».
    index('idx_reuniones_iglesia_fecha').on(t.iglesiaId, t.fecha),
    // Parcial: las de la congregación son mayoría y no se filtran por aquí.
    index('idx_reuniones_ministerio')
      .on(t.ministerioId)
      .where(sql`ministerio_id is not null`),
    // El que sostiene el histórico de asistencia y el recálculo del trigger.
    index('idx_reuniones_congregacion')
      .on(t.iglesiaId, t.fecha)
      .where(sql`ministerio_id is null`),
  ],
);

/**
 * De dónde salió la marca.
 *
 * Se declara con los cuatro valores aunque hoy solo se escriba `panel`, y no es
 * adornar el esquema. Un `alter type ... add value` en Postgres NO puede usarse
 * en la misma transacción que lo añade, así que la migración que estrene el
 * check-in por QR necesitaría partirse en dos pasadas — con meses de listas
 * dentro. Cuesta menos declararlos ahora, con nueve filas en la tabla.
 *
 * La distinción no es estadística, es de confianza. Que alguien se marcara solo
 * al entrar por la puerta y que un ujier supusiera que estaba no valen lo mismo
 * el día que consolidación llame a esa persona para preguntarle por qué lleva un
 * mes sin venir.
 */
export const origenAsistenciaEnum = pgEnum('origen_asistencia_enum', [
  /** Alguien del equipo pasó lista desde `/panel/reuniones`. Lo único que existe hoy. */
  'panel',
  /** El responsable de un grupo marcó a los suyos. La vía que escala a 1.500. */
  'lider',
  /** La persona se marcó sola al entrar, escaneando el código de la puerta. */
  'qr',
  /** La persona lo confirmó desde un aviso. Complemento, nunca fuente única. */
  'autoconfirmado',
]);

/**
 * Quién vino a una reunión, y quién no.
 *
 * SE GUARDA TAMBIÉN AL AUSENTE, Y ESA ES LA DECISIÓN
 * ---------------------------------------------------
 * Lo evidente es guardar solo a quien vino y deducir la ausencia. No sirve: un
 * domingo en el que nadie pasó lista sería idéntico a un domingo en el que no
 * vino nadie, y «lleva cinco domingos sin venir» empezaría a mentir en cuanto
 * alguien se olvidara de pasar lista una semana. Con la fila explícita, cero
 * filas en una reunión significa exactamente «aquí no se tomó asistencia», y el
 * cálculo puede saltársela en vez de contarla como una falta de toda la iglesia.
 *
 * ESTO ES DATO DEL ART. 9 EN SU FORMA MÁS PURA
 * ---------------------------------------------
 * Que una persona concreta estuvo en un culto un domingo concreto revela su
 * práctica religiosa con fecha. Dos consecuencias que están en la migración y
 * conviene no deshacer:
 *
 *   - **No lleva trigger `auditar()`.** `hatril_app` tiene `grant select` de
 *     tabla entera sobre `auditoria` y `auditoria_select_pastor` no filtra por
 *     entidad, así que auditar esta tabla dejaría el mapa completo de quién va a
 *     la iglesia accesible por una segunda puerta. Es el mismo razonamiento por
 *     el que el diezmo nominativo sigue esperando.
 *   - **`anon` no recibe nada, ni una columna.**
 */
export const asistencias = pgTable(
  'asistencias',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    reunionId: uuid('reunion_id')
      .notNull()
      .references(() => reuniones.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** `false` es un dato, no la ausencia de dato. Ver la cabecera. */
    presente: boolean('presente').notNull(),

    /**
     * De dónde salió la marca. Ver `origenAsistenciaEnum`.
     *
     * Ojo con lo que este campo NO resuelve: quien no contesta un aviso no es
     * quien no vino. Si algún día `autoconfirmado` alimenta el cálculo de «lleva
     * cinco domingos sin venir», el silencio tiene que seguir siendo ausencia de
     * fila —«no lo sabemos»— y no una fila con `presente = false`. Confundir las
     * dos cosas pone a consolidación a llamar a gente que vino todas las
     * semanas, y a la tercera llamada el pastor deja de fiarse del dato.
     */
    origen: origenAsistenciaEnum('origen').notNull().default('panel'),

    /** Quién pasó lista. Uuid pelado, validado por HT116. */
    registradoPorMiembroId: uuid('registrado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una persona aparece una vez por reunión. Pasar lista dos veces corrige,
    // no duplica.
    uniqueIndex('uq_asistencia_reunion_miembro').on(t.reunionId, t.miembroId),
    index('idx_asistencias_iglesia').on(t.iglesiaId),
    index('idx_asistencias_reunion').on(t.reunionId),
    // «Cuándo vino esta persona por última vez»: lo pide el recálculo de
    // `miembros.ultima_asistencia` en cada fila que se escribe, y la lista de
    // seguimiento entera de una vez.
    index('idx_asistencias_miembro_presente')
      .on(t.miembroId)
      .where(sql`presente = true`),
  ],
);
