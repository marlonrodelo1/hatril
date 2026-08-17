import 'server-only';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  miembros,
  publicaciones,
  publicacionesComentarios,
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
  esMio: boolean;
};

export type PublicacionMuro = {
  id: string;
  texto: string | null;
  imagenes: string[];
  createdAt: Date;
  autorId: string;
  autorNombre: string;
  esMia: boolean;
  meGusta: number;
  leHeDado: boolean;
  comentarios: ComentarioMuro[];
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
          autorNombre: miembros.nombre,
          autorApellidos: miembros.apellidos,
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

  // Una sola llamada a Storage para todas las fotos de la pantalla.
  const firmas = await firmarImagenes(filas.flatMap((f) => f.imagenes ?? []));

  const nombreCompleto = (n: string, a: string | null) =>
    [n, a].filter(Boolean).join(' ');

  return filas.map((f) => ({
    id: f.id,
    texto: f.texto,
    imagenes: (f.imagenes ?? [])
      .map((ruta) => firmas.get(ruta))
      .filter((u): u is string => Boolean(u)),
    createdAt: f.createdAt,
    autorId: f.autorId,
    autorNombre: nombreCompleto(f.autorNombre, f.autorApellidos),
    esMia: yo !== null && f.autorId === yo,
    meGusta: gustos.filter((g) => g.publicacionId === f.id).length,
    leHeDado:
      yo !== null &&
      gustos.some((g) => g.publicacionId === f.id && g.miembroId === yo),
    comentarios: comentarios
      .filter((c) => c.publicacionId === f.id)
      .map((c) => ({
        id: c.id,
        texto: c.texto,
        createdAt: c.createdAt,
        autorId: c.autorId,
        autorNombre: nombreCompleto(c.autorNombre, c.autorApellidos),
        esMio: yo !== null && c.autorId === yo,
      })),
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
