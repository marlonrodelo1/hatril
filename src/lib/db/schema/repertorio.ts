import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { ministerios } from './ministerios';
import { turnos } from './turnos';

/**
 * Las canciones que sabe tocar un equipo de alabanza.
 *
 * DEL EQUIPO, NO DE LA IGLESIA
 * ----------------------------
 * Cada módulo cuelga de un ministerio, y este también. Una iglesia con dos
 * equipos —el del domingo y el de jóvenes— tiene dos repertorios, y es lo que
 * pasa de verdad: no tocan lo mismo ni en el mismo tono. Compartirlo obligaría a
 * decidir quién puede tocar el cancionero de la iglesia entera, que es una
 * pregunta que hoy nadie se hace.
 *
 * SIN LETRA NI ACORDES DENTRO, Y NO ES PEREZA
 * -------------------------------------------
 * Casi todo lo que se canta en una iglesia tiene derechos: «Way Maker», «Cuán
 * grande es Él» en la versión que se toca. Guardar la letra o la partitura aquí
 * convertiría a Hatril en quien la publica, para cada iglesia y cada miembro que
 * la abra. Lo que se guarda son ENLACES a donde ya está —el vídeo, la página de
 * acordes, el PDF del Drive del equipo—, que es además lo que el equipo usa hoy.
 */
export const canciones = pgTable(
  'canciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    titulo: text('titulo').notNull(),

    /** Quién la canta o la compuso: «Marcos Witt», «Hillsong en español». */
    autor: text('autor'),

    /**
     * El tono en que la toca este equipo: «G», «Am», «Re», «Mi menor».
     *
     * Texto libre y corto, sin validar contra una lista: media iglesia escribe
     * los tonos en notación inglesa y la otra media en la de do-re-mi, y las dos
     * se entienden entre ellas. Una lista cerrada rechazaría a la mitad.
     */
    tono: text('tono'),

    /** Para escucharla: YouTube, Spotify. Solo `http(s)://`, lo dice un CHECK. */
    enlaceAudio: text('enlace_audio'),

    /** Acordes, letra o partitura: la página de acordes, el PDF del Drive. */
    enlacePartitura: text('enlace_partitura'),

    /** «Empezar por el coro», «bajar medio tono si la dirige Marta». */
    notas: text('notas'),

    /**
     * Ya no se toca, pero se cantó. Una canción que salió en una lista de un
     * domingo no se borra —se perdería ese domingo—: se archiva, y deja de salir
     * en el desplegable de elegir.
     */
    archivada: boolean('archivada').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La misma canción dos veces es un doble clic o alguien que no la encontró.
    // Con el autor dentro, porque «Santo» hay varias y de autores distintos.
    uniqueIndex('uq_canciones_ministerio_titulo').on(
      t.ministerioId,
      sql`lower(${t.titulo})`,
      sql`lower(coalesce(${t.autor}, ''))`,
    ),
    index('idx_canciones_iglesia').on(t.iglesiaId),
    index('idx_canciones_ministerio').on(t.ministerioId),
  ],
);

/**
 * Las canciones de un culto, en orden: la lista del domingo.
 *
 * CUELGA DEL TURNO
 * ----------------
 * El domingo en el que toca el equipo ya existe: es su turno. Colgar la lista de
 * ahí hace que quien sirve ese día la vea junto a su puesto, que es la pregunta
 * entera del músico el sábado por la noche —«¿qué tocamos y en qué tono?»—.
 *
 * Y el borrado de una canción usada se PROHÍBE en vez de llevarse la fila: la
 * clave ajena hacia `canciones` es NO ACTION a propósito. Así borrar «Way Maker»
 * no deja agujeros en las listas de hace un año; se archiva.
 */
export const turnoCanciones = pgTable(
  'turno_canciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    turnoId: uuid('turno_id')
      .notNull()
      .references(() => turnos.id, { onDelete: 'cascade' }),

    /** Del repertorio del MISMO ministerio que el turno; lo valida HT124. */
    cancionId: uuid('cancion_id')
      .notNull()
      .references(() => canciones.id),

    /** El orden en el culto. Con huecos: se ordena por él, no se cuenta. */
    orden: integer('orden').notNull(),

    /**
     * El tono de ESE domingo, si no es el de siempre: la dirige otra persona,
     * o se baja para que la congregación llegue.
     */
    tono: text('tono'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La misma canción dos veces en un culto es un error de dedo. El caso raro
    // de repetir el coro al final se apunta en las notas del turno.
    uniqueIndex('uq_turno_cancion').on(t.turnoId, t.cancionId),
    index('idx_turno_canciones_iglesia').on(t.iglesiaId),
    index('idx_turno_canciones_turno').on(t.turnoId, t.orden),
    // «Cuándo se cantó por última vez», que es lo que el repertorio enseña.
    index('idx_turno_canciones_cancion').on(t.cancionId),
  ],
);
