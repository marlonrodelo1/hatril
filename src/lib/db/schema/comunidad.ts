import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { miembros } from './miembros';

/**
 * El muro de la congregación.
 *
 * PUERTAS ADENTRO, Y ESO NO ES UNA PREFERENCIA
 * --------------------------------------------
 * Esto no sale en `/i/[slug]`. Publicar en abierto quién escribe en el muro de
 * una iglesia es publicar quién pertenece a esa iglesia, y eso es dato del
 * artículo 9 del RGPD: el mismo motivo por el que en este repo el rol de la
 * aplicación es `hatril_app` y no `authenticated`.
 *
 * Y las fotos que suba una congregación van a tener gente dentro, incluidos
 * menores. Una foto con personas reconocibles necesita el consentimiento de cada
 * una, no solo de quien la sube. En la web pública solo hay una invitación a
 * entrar; el contenido vive detrás de sesión y de la RLS.
 *
 * Por eso las imágenes NO van al bucket `iglesias-publico` —el de los logos y
 * las portadas, que es de lectura abierta— sino a uno privado que se sirve con
 * URLs firmadas de vida corta.
 *
 * QUIÉN ES EL AUTOR
 * -----------------
 * La FICHA (`miembros`), no la cuenta. Igual que el liderazgo de un ministerio y
 * que la firma de un devocional: una publicación la firma una persona de la
 * congregación, y esa persona tiene ficha aunque un día pierda el acceso.
 */
export const publicaciones = pgTable(
  'publicaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    autorMiembroId: uuid('autor_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    texto: text('texto'),

    /**
     * Las rutas dentro del bucket privado, no URLs.
     *
     * Se guarda `iglesia/publicacion/fichero.jpg` y la URL firmada se pide al
     * pintar. Guardar la URL sería guardar algo que caduca: dentro de una hora
     * es una cadena que ya no abre nada, y habría que reescribir la fila para
     * volver a enseñar la misma foto.
     */
    imagenes: jsonb('imagenes')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // El muro se lee siempre igual: esta iglesia, lo último arriba.
    index('idx_publicaciones_iglesia_fecha').on(t.iglesiaId, t.createdAt.desc()),
    index('idx_publicaciones_autor').on(t.autorMiembroId),
    // Ni texto ni foto no es una publicación vacía: es una fila que alguien
    // creó de más y que en el muro sale como un hueco.
    check(
      'ck_publicaciones_no_vacia',
      sql`${t.texto} is not null or jsonb_array_length(${t.imagenes}) > 0`,
    ),
  ],
);

/**
 * Un «me gusta».
 *
 * La clave primaria es (publicación, miembro): dos veces la misma persona sobre
 * la misma publicación no es un contador que sube, es un error. Y el segundo
 * intento se resuelve con `on conflict do nothing` en vez de con una consulta
 * previa que otra petición puede adelantar.
 *
 * `iglesia_id` está aquí aunque se pueda deducir de la publicación. Es la regla
 * del repo: con la columna, la policy es una comparación directa; sin ella, una
 * subconsulta encadenada con un índice por salto.
 */
export const publicacionesMeGusta = pgTable(
  'publicaciones_me_gusta',
  {
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    publicacionId: uuid('publicacion_id')
      .notNull()
      .references(() => publicaciones.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.publicacionId, t.miembroId] }),
    // Para «¿le he dado yo?» sin recorrer los de toda la iglesia.
    index('idx_me_gusta_miembro').on(t.miembroId),
  ],
);

/** Un comentario. Solo texto: una conversación con fotos dentro es otro muro. */
export const publicacionesComentarios = pgTable(
  'publicaciones_comentarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    publicacionId: uuid('publicacion_id')
      .notNull()
      .references(() => publicaciones.id, { onDelete: 'cascade' }),

    autorMiembroId: uuid('autor_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    texto: text('texto').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_comentarios_publicacion').on(t.publicacionId, t.createdAt),
    index('idx_comentarios_autor').on(t.autorMiembroId),
  ],
);
