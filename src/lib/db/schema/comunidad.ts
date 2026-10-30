import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  primaryKey,
  check,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';
import { miembros } from './miembros';
import { estadoDenunciaEnum, motivoDenunciaEnum } from './enums';

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

    /**
     * A qué comentario responde. `null` es un comentario de primer nivel.
     *
     * UN SOLO NIVEL, Y LO GARANTIZA UN TRIGGER
     * ----------------------------------------
     * Una respuesta no puede responder a otra respuesta (HT120 en la `0035`).
     * Sin ese tope, una conversación de siete niveles en un móvil de 360px acaba
     * en una columna de texto de cuatro caracteres de ancho, y no hay diseño que
     * lo arregle. Es lo que hacen Instagram y Facebook, y por lo mismo.
     *
     * `onDelete: 'cascade'`: borrar un comentario se lleva sus respuestas. La
     * alternativa —dejarlas huérfanas colgando de un padre que ya no está— pinta
     * respuestas sin pregunta, y en un muro de iglesia eso es especialmente
     * feo: quedaría «pues yo no estoy de acuerdo» sin nada delante.
     */
    respuestaAId: uuid('respuesta_a_id').references(
      (): AnyPgColumn => publicacionesComentarios.id,
      { onDelete: 'cascade' },
    ),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_comentarios_publicacion').on(t.publicacionId, t.createdAt),
    index('idx_comentarios_autor').on(t.autorMiembroId),
    // Para colgar las respuestas de su padre sin recorrer los comentarios de
    // toda la publicación.
    index('idx_comentarios_respuesta').on(t.respuestaAId, t.createdAt),
  ],
);

/**
 * «Me gusta» en un comentario.
 *
 * TABLA PROPIA Y NO UNA COLUMNA `tipo` EN LA DE PUBLICACIONES
 * -----------------------------------------------------------
 * Sería una tabla menos y una clave ajena que no se puede declarar: la fila
 * apuntaría unas veces a `publicaciones` y otras a `publicaciones_comentarios`,
 * así que el `references` desaparece y con él la garantía de que el objeto
 * existe. Ese patrón —una referencia polimórfica— convierte cada consulta en un
 * `case` y cada borrado en un problema.
 *
 * La clave primaria compuesta hace el trabajo del «no se puede dar dos veces»:
 * es la misma decisión que en `publicaciones_me_gusta`, donde ya evitó tener
 * que comprobar antes de insertar.
 */
export const publicacionesComentariosMeGusta = pgTable(
  'publicaciones_comentarios_me_gusta',
  {
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    comentarioId: uuid('comentario_id')
      .notNull()
      .references(() => publicacionesComentarios.id, { onDelete: 'cascade' }),

    miembroId: uuid('miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.comentarioId, t.miembroId] }),
    index('idx_comentarios_me_gusta_miembro').on(t.miembroId),
  ],
);

/**
 * Una denuncia de algo del muro: una publicación o un comentario.
 *
 * LA PIDE APPLE, PERO SE QUEDA PORQUE HACE FALTA
 * ----------------------------------------------
 * La norma 1.2 exige poder denunciar el contenido de otros usuarios y que
 * alguien actúe sobre lo denunciado. Hasta aquí quien modera solo se enteraba
 * de algo feo si pasaba por el muro y lo veía.
 *
 * QUIÉN LA VE
 * -----------
 * Quien la hizo —para que el muro le esconda lo que denunció— y quien modera la
 * comunidad. Nadie más, y menos que nadie el autor de lo denunciado: si supiera
 * quién fue, denunciar en una congregación de ochenta personas sería señalarse.
 * La pantalla de revisión ni siquiera pinta el nombre de quien denuncia.
 *
 * Dos columnas nulables en vez de una referencia polimórfica, por lo mismo que
 * `publicaciones_comentarios_me_gusta` tiene tabla propia: así las dos claves
 * ajenas existen, y borrar lo denunciado se lleva su denuncia con él.
 */
export const denunciasComunidad = pgTable(
  'denuncias_comunidad',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    denuncianteMiembroId: uuid('denunciante_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    publicacionId: uuid('publicacion_id').references(() => publicaciones.id, {
      onDelete: 'cascade',
    }),

    comentarioId: uuid('comentario_id').references(
      () => publicacionesComentarios.id,
      { onDelete: 'cascade' },
    ),

    motivo: motivoDenunciaEnum('motivo').notNull(),

    /** Lo que quiera contarle al pastor. Opcional. */
    detalle: text('detalle'),

    estado: estadoDenunciaEnum('estado').notNull().default('pendiente'),

    revisadaAt: timestamp('revisada_at', { withTimezone: true }),

    /** La cuenta de quien la revisó. Sin FK, como el resto de `auth.users`. */
    revisadaPorAuthUserId: uuid('revisada_por_auth_user_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Exactamente una de las dos: una denuncia es SOBRE algo, y sobre una sola
    // cosa.
    check(
      'ck_denuncias_un_objeto',
      sql`(${t.publicacionId} is null) <> (${t.comentarioId} is null)`,
    ),
    // La misma persona denunciando dos veces lo mismo no es más grave: es un
    // doble toque. Lo para la base, no una consulta previa.
    uniqueIndex('uq_denuncias_publicacion')
      .on(t.denuncianteMiembroId, t.publicacionId)
      .where(sql`${t.publicacionId} is not null`),
    uniqueIndex('uq_denuncias_comentario')
      .on(t.denuncianteMiembroId, t.comentarioId)
      .where(sql`${t.comentarioId} is not null`),
    // La cola de quien modera: esta iglesia, lo pendiente, lo más antiguo arriba.
    index('idx_denuncias_iglesia_estado').on(
      t.iglesiaId,
      t.estado,
      t.createdAt,
    ),
  ],
);

/**
 * Una persona que ha dejado de ver a otra en el muro.
 *
 * Solo en el muro. Si coinciden en un equipo se siguen viendo en los turnos y
 * en el cuadrante: quitar a alguien de ahí sería tocar el trabajo de un tercero
 * —quien lleva el equipo— sin que lo sepa.
 *
 * El bloqueado no se entera: no puede leer esta tabla, ni siquiera sus propias
 * filas como bloqueado. Las policies solo enseñan a cada cual los bloqueos que
 * ha hecho él.
 */
export const bloqueosComunidad = pgTable(
  'bloqueos_comunidad',
  {
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    bloqueadorMiembroId: uuid('bloqueador_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    bloqueadoMiembroId: uuid('bloqueado_miembro_id')
      .notNull()
      .references(() => miembros.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.bloqueadorMiembroId, t.bloqueadoMiembroId] }),
    check(
      'ck_bloqueos_no_a_uno_mismo',
      sql`${t.bloqueadorMiembroId} <> ${t.bloqueadoMiembroId}`,
    ),
    // Para avisar: antes de mandarle a alguien «X ha comentado lo tuyo», mirar
    // si esa persona tiene bloqueado a X.
    index('idx_bloqueos_bloqueado').on(t.bloqueadoMiembroId),
  ],
);
