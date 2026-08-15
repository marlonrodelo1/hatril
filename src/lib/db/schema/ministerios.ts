import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { miembros } from './miembros';

/**
 * Un área de servicio de la iglesia: alabanza, jóvenes, niños, intercesión,
 * ujieres, medios…
 *
 * Cada iglesia define los suyos; Hatril solo siembra cuatro habituales al crear
 * la congregación para que el panel no arranque vacío.
 */
export const ministerios = pgTable(
  'ministerios',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),

    /**
     * Color de la etiqueta en el panel. Se guarda por ministerio para que el
     * pastor los distinga de un vistazo en el listado de miembros.
     */
    colorHex: text('color_hex').notNull().default('#2F5D50'),

    /**
     * Quién lo lidera. Apunta a la FICHA, no a la cuenta: el líder de alabanza
     * puede no tener acceso a la aplicación y seguir siendo el líder.
     *
     * `set null` y no `cascade`: si se borra la ficha del líder, el ministerio
     * se queda sin líder, no desaparece con él.
     */
    liderMiembroId: uuid('lider_miembro_id').references(() => miembros.id, {
      onDelete: 'set null',
    }),

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
    // Dos ministerios con el mismo nombre en la misma iglesia es siempre un
    // error de dedo. Case-insensitive porque "Jóvenes" y "jóvenes" son el mismo.
    uniqueIndex('uq_ministerios_iglesia_nombre').on(
      t.iglesiaId,
      sql`lower(${t.nombre})`,
    ),
    index('idx_ministerios_iglesia').on(t.iglesiaId),
    index('idx_ministerios_lider').on(t.liderMiembroId),
  ],
);

/**
 * Quién sirve en qué ministerio.
 *
 * Lleva `iglesia_id` propio aunque se pueda deducir por `ministerio_id`. Es
 * redundancia deliberada: la policy de RLS queda en una comparación directa en
 * lugar de una subconsulta anidada. Pidoo resolvió la pertenencia siguiendo la
 * cadena de claves ajenas y acabó con `USING` de tres niveles que además había
 * que indexar a mano en cada salto.
 *
 * Un trigger valida que `iglesia_id` coincida con el del ministerio, para que la
 * redundancia no pueda desincronizarse.
 */
export const ministerioMiembros = pgTable(
  'ministerio_miembros',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    ministerioId: uuid('ministerio_id')
      .notNull()
      .references(() => ministerios.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    /** "Vocalista", "Guitarra", "Maestra de nivel 2"… libre a propósito. */
    rolEnMinisterio: text('rol_en_ministerio'),

    desde: date('desde'),
    hasta: date('hasta'),
    activo: boolean('activo').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Parcial: una persona no puede estar dos veces ACTIVA en el mismo
    // ministerio, pero sí puede haber servido, salido y vuelto — y ese
    // histórico es justo lo que un pastor quiere conservar.
    uniqueIndex('uq_ministerio_miembro_activo')
      .on(t.ministerioId, t.miembroId)
      .where(sql`activo = true`),
    index('idx_ministerio_miembros_iglesia').on(t.iglesiaId),
    index('idx_ministerio_miembros_ministerio').on(t.ministerioId),
    index('idx_ministerio_miembros_miembro').on(t.miembroId),
  ],
);
