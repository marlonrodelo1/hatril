import {
  pgEnum,
  pgTable,
  uuid,
  text,
  date,
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
 * Cómo se habló con la persona.
 *
 * No es un detalle administrativo: un equipo que solo llama por teléfono y otro
 * que visita casas hacen trabajos distintos, y el pastor quiere poder mirar
 * cuál de los dos recupera gente.
 */
export const viaContactoEnum = pgEnum('via_contacto_enum', [
  'llamada',
  'whatsapp',
  'visita',
  'presencial',
]);

/**
 * Qué pasó. LISTA CERRADA, Y ESO ES LA DECISIÓN DE TODO EL MÓDULO.
 *
 * La forma evidente es un campo de texto libre donde el líder escriba lo que
 * quiera. Y ahí es exactamente donde acaba escrito «está con quimioterapia» o
 * «se separó»: datos de salud y de vida privada, del art. 9, en una tabla sin
 * cifrar que lee cualquiera del equipo de consolidación.
 *
 * `src/lib/db/schema/miembros.ts:67` ya lo apartó al escribir que las notas
 * administrativas «NO son el seguimiento pastoral: eso llega con su propia tabla
 * y su propio cifrado». Esta tabla es la que aquel comentario anunciaba, y llega
 * SIN texto libre a propósito: hasta que exista cifrado en reposo con gestión de
 * claves y una base jurídica escrita, el motivo se elige de esta lista.
 *
 * Y la lista cerrada no es solo el mal menor: es mejor producto. Siete valores
 * se pueden sumar y ordenar —«este trimestre perdimos nueve personas porque se
 * mudaron y cuatro porque se molestaron»—, y catorce párrafos escritos por
 * catorce personas distintas no se pueden sumar de ninguna manera.
 */
export const resultadoContactoEnum = pgEnum('resultado_contacto_enum', [
  /** Se habló con la persona y no hay nada más que apuntar. */
  'contactado',
  /** No cogió el teléfono, no abrió la puerta. Sin juicio sobre el motivo. */
  'no_contesta',
  'volvera',
  'se_mudo',
  /** El caso que una iglesia necesita poder mirar de frente para arreglarlo. */
  'molesto_con_la_iglesia',
  /** No hay forma de llegar a esa persona: teléfono muerto, dirección vieja. */
  'sin_contacto',
  /** Excede lo que un voluntario debe llevar. Se lo queda el pastorado. */
  'derivado_al_pastor',
]);

/**
 * Quién acompaña a quién.
 *
 * Es el «que los líderes se dividan los grupos» del que sale todo lo demás: sin
 * un nombre al lado de cada persona, una lista de cien ausentes es una lista que
 * no llama nadie porque todos suponen que llama otro.
 *
 * NO LLEVA COLUMNA `estado`
 * -------------------------
 * La tentación era `pendiente / en_contacto / recuperado`. Sobra y estorba: ese
 * estado ya lo dice el `resultado` del último contacto, y dos sitios que cuentan
 * lo mismo acaban discrepando —alguien apunta la llamada y se olvida de mover el
 * desplegable, y a partir de ahí la pantalla miente—. Aquí solo se guarda quién
 * lo lleva; qué tal va se lee de los contactos.
 */
export const seguimientoAsignaciones = pgTable(
  'seguimiento_asignaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /**
     * Desde qué ministerio se hace el seguimiento.
     *
     * NOT NULL, al revés que en `reuniones`: el seguimiento siempre lo lleva un
     * equipo. Una asignación «de la iglesia» sin dueño es la lista que no llama
     * nadie otra vez, un nivel más arriba.
     */
    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** A quién se acompaña. */
    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** Quién lo lleva. Del equipo de ese ministerio; lo valida HT118. */
    responsableMiembroId: uuid('responsable_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    activo: boolean('activo').notNull().default(true),
    desde: date('desde'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una persona la lleva UNA sola persona dentro de un ministerio. Dos
    // responsables es que la llaman dos o que no la llama ninguna.
    //
    // Parcial por `activo`, como en `ministerio_miembros`: quien la llevó antes
    // conserva su fila, y ese histórico es justo lo que se quiere mirar cuando
    // alguien pregunta «¿esto ya se intentó?».
    uniqueIndex('uq_seguimiento_miembro_activo')
      .on(t.ministerioId, t.miembroId)
      .where(sql`activo = true`),
    index('idx_seguimiento_iglesia').on(t.iglesiaId),
    index('idx_seguimiento_ministerio').on(t.ministerioId),
    // «Qué me toca a mí esta semana», que es la consulta del voluntario.
    index('idx_seguimiento_responsable')
      .on(t.responsableMiembroId)
      .where(sql`activo = true`),
  ],
);

/**
 * Cada llamada, visita o mensaje.
 *
 * ESTO NO LLEVA `auditar()`, IGUAL QUE `asistencias`
 * ---------------------------------------------------
 * Por el mismo motivo: `hatril_app` tiene `grant select` de tabla entera sobre
 * `auditoria` y su policy no filtra por entidad, así que auditar esto dejaría
 * reconstruible por una segunda puerta quién se ha molestado con la iglesia y
 * quién se fue. Y sería peor que en asistencias, porque `auditoria` no tiene
 * policy de DELETE para nadie: el derecho de supresión pasaría a exigir SQL a
 * mano.
 *
 * LA FIRMA NO SE ELIGE, SE COMPRUEBA
 * ----------------------------------
 * `autor_miembro_id` lo valida la policy contra `miembro_actual(iglesia_id)`,
 * como en `publicaciones` desde la `0027`. Sin eso, cualquiera del equipo podría
 * apuntar «Fulano visitó a Mengana y se molestó» firmando con la ficha de
 * Fulano.
 */
export const seguimientoContactos = pgTable(
  'seguimiento_contactos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    /** A quién se contactó. */
    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** Quién lo hizo. La policy exige que sea la ficha de quien escribe. */
    autorMiembroId: uuid('autor_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    fecha: date('fecha').notNull(),

    via: viaContactoEnum('via').notNull(),
    resultado: resultadoContactoEnum('resultado').notNull(),

    /**
     * Qué toca ahora. Corto y en futuro: «llamar el sábado», «pasar por su casa».
     *
     * Es el único campo escrito a mano de todo el módulo, y está acotado a 200
     * caracteres a propósito: en dos líneas cabe un recordatorio y no cabe el
     * historial médico de nadie. El aviso de qué NO escribir aquí va en la
     * propia pantalla, que es el momento en que alguien está a punto de hacerlo.
     */
    proximoPaso: text('proximo_paso'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_contactos_iglesia').on(t.iglesiaId),
    // La consulta de cabecera: «lo último que se habló con esta persona».
    index('idx_contactos_miembro_fecha').on(t.miembroId, t.fecha),
    index('idx_contactos_ministerio').on(t.ministerioId),
  ],
);
