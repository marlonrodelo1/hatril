import 'server-only';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  miembros,
  publicaciones,
  publicacionesComentarios,
  publicacionesComentariosMeGusta,
  publicacionesMeGusta,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { firmarImagenes } from './imagenes';

/**
 * El muro de la congregación, tal y como se pinta.
 *
 * TODO POR `withUser`
 * -------------------
 * Ni una consulta por `dbAdmin`. Es contenido de miembros de una iglesia: si la
 * RLS no manda aquí, no manda en ningún sitio. La única pieza que usa el service
 * role es la firma de las imágenes, y esa no consulta la base de datos.
 *
 * CUATRO CONSULTAS Y NO UNA
 * -------------------------
 * Publicaciones, cuántos «me gusta» tiene cada una, cuáles he dado yo, y los
 * comentarios. Se podría hacer con subconsultas correlacionadas en un solo
 * SELECT, pero cada una de ellas se ejecutaría por fila y con la RLS encima:
 * las policies llaman a `pertenece_a_iglesia()` en cada evaluación. Cuatro
 * consultas planas con `in (...)` cuestan cuatro viajes y se leen.
 */

export type ComentarioMuro = {
  id: string;
  texto: string;
  createdAt: Date;
  autorId: string;
  autorNombre: string;
  autorFoto: string | null;
  esMio: boolean;
  meGusta: number;
  leHeDado: boolean;
  /**
   * Las respuestas a este comentario. Siempre vacío dentro de una respuesta: el
   * árbol tiene un solo nivel y lo garantiza HT120 en la base, no esta función.
   */
  respuestas: ComentarioMuro[];
};

export type PublicacionMuro = {
  id: string;
  texto: string | null;
  imagenes: string[];
  createdAt: Date;
  autorId: string;
  autorNombre: string;
  autorFoto: string | null;
  esMia: boolean;
  meGusta: number;
  leHeDado: boolean;
  /** Solo los de primer nivel. Cada uno lleva las suyas dentro. */
  comentarios: ComentarioMuro[];
  /**
   * Cuántos hay contando respuestas.
   *
   * Es lo que va en el icono de la hoja de comentarios, y no
   * `comentarios.length`: con dos comentarios y ocho respuestas, ese número
   * diría «2» y quien lo abre encuentra diez. Contar lo que se va a ver es lo
   * único que no defrauda.
   */
  totalComentarios: number;
};

/** Una pantalla de muro. Sin paginación todavía: se verá cuando haga falta. */
const LIMITE = 30;

export async function listarMuro(ctx: UserContext): Promise<PublicacionMuro[]> {
  const yo = ctx.miembroId;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: publicaciones.id,
        texto: publicaciones.texto,
        imagenes: publicaciones.imagenes,
        createdAt: publicaciones.createdAt,
        autorId: publicaciones.autorMiembroId,
        autorNombre: miembros.nombre,
        autorApellidos: miembros.apellidos,
        autorFoto: miembros.fotoUrl,
      })
      .from(publicaciones)
      .innerJoin(miembros, eq(miembros.id, publicaciones.autorMiembroId))
      .where(eq(publicaciones.iglesiaId, ctx.iglesia.id))
      .orderBy(desc(publicaciones.createdAt))
      .limit(LIMITE),
  );

  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.id);

  const [gustos, comentarios] = await Promise.all([
    withUser(ctx.user.id, (tx) =>
      tx
        .select({
          publicacionId: publicacionesMeGusta.publicacionId,
          miembroId: publicacionesMeGusta.miembroId,
        })
        .from(publicacionesMeGusta)
        .where(inArray(publicacionesMeGusta.publicacionId, ids)),
    ),
    withUser(ctx.user.id, (tx) =>
      tx
        .select({
          id: publicacionesComentarios.id,
          publicacionId: publicacionesComentarios.publicacionId,
          texto: publicacionesComentarios.texto,
          createdAt: publicacionesComentarios.createdAt,
          autorId: publicacionesComentarios.autorMiembroId,
          respuestaAId: publicacionesComentarios.respuestaAId,
          autorNombre: miembros.nombre,
          autorApellidos: miembros.apellidos,
          autorFoto: miembros.fotoUrl,
        })
        .from(publicacionesComentarios)
        .innerJoin(
          miembros,
          eq(miembros.id, publicacionesComentarios.autorMiembroId),
        )
        .where(inArray(publicacionesComentarios.publicacionId, ids))
        .orderBy(asc(publicacionesComentarios.createdAt)),
    ),
  ]);

  /*
   * Los «me gusta» de los comentarios. Va después y no dentro del `Promise.all`
   * de arriba porque necesita los ids que acaba de devolver la consulta de
   * comentarios, y pedirlos por `publicacion_id` con un `join` sería empujar a
   * la RLS a evaluar `pertenece_a_iglesia()` sobre el producto de las dos
   * tablas. Con la lista de ids en la mano es un `in (...)` plano.
   *
   * El `if` no es una micro-optimización: `inArray` con un array vacío genera
   * `in ()`, que es un error de sintaxis en Postgres.
   */
  const idsComentarios = comentarios.map((c) => c.id);

  const gustosComentarios =
    idsComentarios.length === 0
      ? []
      : await withUser(ctx.user.id, (tx) =>
          tx
            .select({
              comentarioId: publicacionesComentariosMeGusta.comentarioId,
              miembroId: publicacionesComentariosMeGusta.miembroId,
            })
            .from(publicacionesComentariosMeGusta)
            .where(
              inArray(
                publicacionesComentariosMeGusta.comentarioId,
                idsComentarios,
              ),
            ),
        );

  // Una sola llamada a Storage para todas las fotos de la pantalla.
  const firmas = await firmarImagenes(filas.flatMap((f) => f.imagenes ?? []));

  const nombreCompleto = (n: string, a: string | null) =>
    [n, a].filter(Boolean).join(' ');

  /** Una fila de comentario, ya con sus cuentas hechas y sin respuestas. */
  const aComentario = (c: (typeof comentarios)[number]): ComentarioMuro => ({
    id: c.id,
    texto: c.texto,
    createdAt: c.createdAt,
    autorId: c.autorId,
    autorNombre: nombreCompleto(c.autorNombre, c.autorApellidos),
    autorFoto: c.autorFoto,
    esMio: yo !== null && c.autorId === yo,
    meGusta: gustosComentarios.filter((g) => g.comentarioId === c.id).length,
    leHeDado:
      yo !== null &&
      gustosComentarios.some(
        (g) => g.comentarioId === c.id && g.miembroId === yo,
      ),
    respuestas: [],
  });

  return filas.map((f) => ({
    id: f.id,
    texto: f.texto,
    imagenes: (f.imagenes ?? [])
      .map((ruta) => firmas.get(ruta))
      .filter((u): u is string => Boolean(u)),
    createdAt: f.createdAt,
    autorId: f.autorId,
    autorNombre: nombreCompleto(f.autorNombre, f.autorApellidos),
    autorFoto: f.autorFoto,
    esMia: yo !== null && f.autorId === yo,
    meGusta: gustos.filter((g) => g.publicacionId === f.id).length,
    leHeDado:
      yo !== null &&
      gustos.some((g) => g.publicacionId === f.id && g.miembroId === yo),
    comentarios: (() => {
      const suyos = comentarios.filter((c) => c.publicacionId === f.id);

      /*
       * El árbol se arma aquí y no con una consulta recursiva porque tiene un
       * solo nivel: HT120 impide responder a una respuesta, así que un
       * `with recursive` sería maquinaria para una profundidad que la base ya
       * garantiza que es uno.
       *
       * Las respuestas van en orden ascendente porque una conversación se lee
       * de arriba abajo — al revés que el muro, donde lo último va primero.
       */
      const primerNivel = suyos.filter((c) => c.respuestaAId === null);

      return primerNivel.map((c) => ({
        ...aComentario(c),
        respuestas: suyos
          .filter((r) => r.respuestaAId === c.id)
          .map(aComentario),
      }));
    })(),
    totalComentarios: comentarios.filter((c) => c.publicacionId === f.id)
      .length,
  }));
}

/**
 * Cuánta vida tiene el muro, para la invitación de la web pública.
 *
 * Devuelve números, nunca contenido: la web de la iglesia la ve cualquiera y
 * ahí no sale ni un nombre ni una frase de nadie. Va por `dbAdmin` a propósito
 * —quien mira no tiene sesión— y por eso lo único que puede devolver es un
 * recuento.
 */
export async function pulsoDelMuro(
  iglesiaId: string,
): Promise<{ publicaciones: number; ultimaSemana: number }> {
  const { dbAdmin } = await import('@/lib/db');

  const [fila] = await dbAdmin
    .select({
      total: sql<number>`count(*)::int`,
      semana: sql<number>`count(*) filter (where ${publicaciones.createdAt} > now() - interval '7 days')::int`,
    })
    .from(publicaciones)
    .where(eq(publicaciones.iglesiaId, iglesiaId));

  return {
    publicaciones: fila?.total ?? 0,
    ultimaSemana: fila?.semana ?? 0,
  };
}

/** ¿De quién es esta publicación? Para decidir si se puede borrar. */
export async function autorDePublicacion(
  ctx: UserContext,
  publicacionId: string,
): Promise<{ autorMiembroId: string; imagenes: string[] } | null> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        autorMiembroId: publicaciones.autorMiembroId,
        imagenes: publicaciones.imagenes,
      })
      .from(publicaciones)
      .where(
        and(
          eq(publicaciones.id, publicacionId),
          eq(publicaciones.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1),
  );

  return fila ? { autorMiembroId: fila.autorMiembroId, imagenes: fila.imagenes ?? [] } : null;
}

/**
 * La foto de perfil de quien está mirando.
 *
 * Consulta suelta y no un campo más del contexto de usuario: `UserContext` lo
 * pide cada pantalla del panel y de `/mi`, y esto solo lo necesita el
 * compositor del muro. Una columna más en aquel `select` son cuarenta consultas
 * al día que traen un dato que casi nadie usa.
 *
 * Devuelve null sin ficha, que es el caso de quien tiene acceso y todavía no ha
 * sido dado de alta en el fichero.
 */
export async function miFotoDePerfil(ctx: UserContext): Promise<string | null> {
  if (!ctx.miembroId) return null;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ fotoUrl: miembros.fotoUrl })
      .from(miembros)
      .where(eq(miembros.id, ctx.miembroId!))
      .limit(1),
  );

  return filas[0]?.fotoUrl ?? null;
}
