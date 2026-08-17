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

import { rolEquipoEnum } from './enums';
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

    // Aquí vivía `lider_miembro_id`. Se fue en la migración `0005` y el
    // liderazgo pasó a `ministerio_miembros.rol_equipo`, por dos razones:
    //
    // 1. Un ministerio puede tener varios líderes. La columna solo guardaba uno.
    // 2. Nada validaba que ese uuid fuera de esta iglesia. `editarMinisterio` lo
    //    comprobaba con `z.string().uuid()` y punto, así que un POST con el id de
    //    un miembro de otra congregación se escribía tal cual. Al ser el
    //    liderazgo una fila de la pivote, hereda HT102 —el trigger de coherencia
    //    que esa tabla ya tenía— sin escribir un trigger nuevo.

    /**
     * Foto del grupo para la web pública.
     *
     * Va en el bucket `iglesias-publico`, el mismo que el logo y la portada: es
     * contenido que la congregación publica a propósito. Ojo con lo que se sube
     * aquí — si sale gente reconocible, hace falta su consentimiento de imagen,
     * que es uno de los tres que ya registra `consentimientos`.
     */
    fotoUrl: text('foto_url'),

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

    /**
     * Qué manda esta persona aquí dentro. El otro eje de `rolEnMinisterio`, que
     * dice qué HACE.
     *
     * Esta columna lleva privilegio: de ella depende `gestionar_su_ministerio`
     * en `src/lib/auth/permisos.ts`. Por eso el trigger HT104 impide que alguien
     * se ascienda a sí mismo, igual que HT101 en `iglesia_usuarios`.
     */
    rolEquipo: rolEquipoEnum('rol_equipo').notNull().default('voluntario'),

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
    // UN solo responsable por ministerio, y lo dice la base de datos.
    //
    // Parcial por `activo` igual que su vecino de arriba: quien fue responsable
    // y salió conserva su fila con 'responsable' —el histórico que un pastor
    // quiere poder mirar— sin bloquear a quien le sucede.
    uniqueIndex('uq_ministerio_responsable_activo')
      .on(t.ministerioId)
      .where(sql`rol_equipo = 'responsable' AND activo = true`),
    index('idx_ministerio_miembros_iglesia').on(t.iglesiaId),
    index('idx_ministerio_miembros_ministerio').on(t.ministerioId),
    index('idx_ministerio_miembros_miembro').on(t.miembroId),
    // Lo consulta `getCurrentUserContext()` en CADA carga del panel para saber
    // qué ministerios lidera esta persona.
    index('idx_ministerio_miembros_lider')
      .on(t.miembroId)
      .where(sql`rol_equipo <> 'voluntario' AND activo = true`),
  ],
);
