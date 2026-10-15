import {
  pgEnum,
  pgTable,
  uuid,
  text,
  date,
  time,
  timestamp,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { ministerios } from './ministerios';
import { miembros } from './miembros';

/**
 * Qué ha contestado la persona a su turno.
 *
 * `pendiente` NO ES «NO VIENE»
 * ----------------------------
 * Es «todavía no lo sabemos», y la pantalla del responsable lo pinta distinto a
 * propósito. Mucha gente del equipo está en el fichero y no usa la aplicación
 * —no tiene cuenta, o no la abre—, y para esas personas el turno se queda en
 * pendiente para siempre aunque vengan todos los domingos. Si `pendiente`
 * contara como hueco, el responsable vería la mitad del equipo «sin cubrir» y
 * dejaría de mirar la pantalla a la segunda semana.
 *
 * Por eso el responsable también puede marcar la respuesta: «me lo dijo por
 * WhatsApp» es la forma en que de verdad se confirma esto hoy.
 */
export const respuestaTurnoEnum = pgEnum('respuesta_turno_enum', [
  'pendiente',
  'confirmado',
  'no_puede',
]);

export type RespuestaTurno = (typeof respuestaTurnoEnum.enumValues)[number];

/**
 * Un culto en el que sirve un equipo: «Alabanza, domingo 19 a las 11:00».
 *
 * POR QUÉ NO ES UNA FILA DE `reuniones`
 * -------------------------------------
 * Se parecen —fecha, hora, título, un ministerio— y se probó a reutilizarla. No
 * encaja: una reunión de equipo es algo a lo que va TODO el equipo y a la que se
 * le pasa lista (el ensayo del jueves). Un turno es lo contrario: un culto al
 * que solo van los que les toca, cada uno a un puesto. Metido en `reuniones`, el
 * domingo saldría en la agenda del equipo con una lista donde faltan todos los
 * que no estaban de turno, y «vinieron 4 de 12» estaría contando como ausentes a
 * ocho personas a las que nadie llamó.
 *
 * NI ES UNA FILA POR CULTO DE LA IGLESIA
 * --------------------------------------
 * La tentación era una tabla `cultos` compartida —el domingo 19 una sola vez— y
 * los turnos de cada equipo colgando de ella. Los cultos de una iglesia no son
 * filas: son reglas del jsonb `iglesias.horarios`, y la agenda los genera al
 * vuelo (`lib/agenda/calendario.ts`). Materializarlos solo para poder colgar
 * turnos obligaría a decidir quién los crea, y sería el responsable de alabanza
 * creando cultos de la iglesia. Así que cada equipo apunta el suyo, con la fecha
 * y la hora copiadas del horario, y el par (fecha, hora) es lo que permite ver
 * que alguien sirve en dos equipos a la vez.
 */
export const turnos = pgTable(
  'turnos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** Siempre de un equipo: un turno sin equipo no es de nadie. */
    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** «Culto», «Reunión de oración». Copiado del horario o escrito a mano. */
    titulo: text('titulo').notNull(),

    /**
     * `date` + `time` y no `timestamptz`, por lo mismo que `reuniones`: «el
     * domingo a las 11» es una hora local de esa congregación y se guarda tal
     * cual. Ver la cabecera de `asistencia.ts`.
     */
    fecha: date('fecha').notNull(),
    hora: time('hora'),

    /**
     * Instrucciones para el equipo: «llegar a las 9:30 para la prueba de
     * sonido». Del turno, NO de las personas — igual que `reuniones.notas`.
     */
    notas: text('notas'),

    /** Uuid pelado, sin FK, como `reuniones.creado_por_miembro_id`. Lo valida HT122. */
    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Un equipo sirve una vez en cada culto. Sin esto, planificar el mes dos
    // veces —un doble clic, dos colíderes a la vez— duplica los domingos, y la
    // mitad del equipo acaba confirmando el turno que nadie mira.
    //
    // `nulls not distinct`: un turno sin hora es «todo el día», y dos de esos
    // el mismo día son el mismo turno. Con el NULL corriente de SQL, dos NULL
    // nunca chocan y el índice no protegería justo ese caso.
    unique('uq_turnos_ministerio_servicio')
      .on(t.ministerioId, t.fecha, t.hora)
      .nullsNotDistinct(),
    // «Los próximos turnos de este equipo», que es la pantalla de cabecera.
    index('idx_turnos_ministerio_fecha').on(t.ministerioId, t.fecha),
    index('idx_turnos_iglesia_fecha').on(t.iglesiaId, t.fecha),
  ],
);

/**
 * Quién sirve en ese turno y en qué puesto.
 *
 * UNA FILA POR PUESTO, Y LA RESPUESTA EN CADA UNA
 * -----------------------------------------------
 * En una iglesia pequeña la misma persona canta y toca la guitarra el mismo
 * domingo. Con una fila por persona, los dos puestos tendrían que ir en un
 * array, y quitarle uno sería reescribir la fila. Con una fila por puesto, la
 * persona responde una vez y la action actualiza todas las suyas de ese turno.
 *
 * `puesto` ES TEXTO COPIADO, NO UNA CLAVE
 * ---------------------------------------
 * Los puestos de cada equipo viven en su configuración (`ministerios.modulos`),
 * y el responsable los renombra y los borra cuando quiere. Si la fila apuntara
 * a ellos, renombrar «Voces» a «Coros» reescribiría los turnos de hace un año, y
 * borrar un puesto se llevaría el histórico de quién lo ocupó. Copiado, el
 * pasado dice lo que fue.
 *
 * NO LLEVA `auditar()`
 * --------------------
 * Que una persona sirvió en un culto un domingo concreto es práctica religiosa
 * nominal y fechada, igual que la asistencia. Lo que se dijo en la 0030 vale
 * aquí: `auditoria` se lee entera desde `hatril_app` y no tiene DELETE, así que
 * auditar esto abriría una segunda puerta al mismo dato y haría imposible
 * borrarlo cuando la persona lo pida.
 */
export const turnoAsignaciones = pgTable(
  'turno_asignaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    turnoId: uuid('turno_id')
      .notNull()
      .references(() => turnos.id, { onDelete: 'cascade' }),

    /** Del equipo de ese ministerio; lo valida HT122 al asignar. */
    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** «Guitarra», «Puerta principal». Ver la cabecera. */
    puesto: text('puesto').notNull(),

    respuesta: respuestaTurnoEnum('respuesta').notNull().default('pendiente'),

    /**
     * Cuándo contestó. Sirve para lo que el pastor acaba preguntando —«¿cuánto
     * tarda la gente en confirmar?»— y para no pisar una respuesta reciente con
     * otra vieja.
     */
    respondidoAt: timestamp('respondido_at', { withTimezone: true }),

    /** Quién le puso. Uuid pelado, validado por HT122. */
    asignadoPorMiembroId: uuid('asignado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La misma persona dos veces en el mismo puesto es un doble clic.
    // `lower()` porque «guitarra» y «Guitarra» son el mismo puesto.
    uniqueIndex('uq_turno_puesto_miembro').on(
      t.turnoId,
      sql`lower(${t.puesto})`,
      t.miembroId,
    ),
    index('idx_turno_asignaciones_iglesia').on(t.iglesiaId),
    index('idx_turno_asignaciones_turno').on(t.turnoId),
    // «Qué me toca a mí», que es la consulta del área del miembro.
    index('idx_turno_asignaciones_miembro').on(t.miembroId),
  ],
);
