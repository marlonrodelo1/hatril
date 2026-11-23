import 'server-only';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  bloqueosComunidad,
  denunciasComunidad,
  miembros,
  publicaciones,
  publicacionesComentarios,
} from '@/lib/db/schema';
import type { MotivoDenuncia } from '@/lib/db/schema/enums';
import type { UserContext } from '@/lib/auth/user-context';
import { firmarImagenes } from './imagenes';
import { fotosParaPintar } from '@/lib/miembros/foto';

/**
 * Denuncias y bloqueos: lo que cada cual ha decidido no ver, y la cola de quien
 * modera.
 *
 * TODO POR `withUser`, COMO EL MURO
 * ---------------------------------
 * Las policies de la `0053` ya recortan: cada persona solo lee sus bloqueos y
 * sus denuncias, y quien modera lee además las de toda la iglesia. Aquí no se
 * filtra «por si acaso» con otro `where` de quién es quién: si la policy
 * fallara, un filtro en el código taparía el fallo en vez de dejarlo ver.
 */

const nombreCompleto = (n: string, a: string | null) =>
  [n, a].filter(Boolean).join(' ');

/**
 * Lo que el muro no le enseña a esta persona.
 *
 * Lo que ha denunciado se le esconde para siempre, no hasta que el pastor
 * decida: si el pastor lo deja estar, a quien lo denunció le sigue molestando
 * igual. Y lo de quien ha bloqueado, mientras dure el bloqueo.
 */
export type FiltroDelMuro = {
  bloqueados: string[];
  publicacionesDenunciadas: string[];
  comentariosDenunciados: string[];
};

export async function filtroDelMuro(ctx: UserContext): Promise<FiltroDelMuro> {
  // Sin ficha no se puede bloquear ni denunciar: no hay nada que esconder.
  if (!ctx.miembroId) {
    return { bloqueados: [], publicacionesDenunciadas: [], comentariosDenunciados: [] };
  }

  const miembroId = ctx.miembroId;

  // Seguidas y no en un `Promise.all`: es la misma transacción y la misma
  // conexión, así que en paralelo no se gana nada y se pierde el orden.
  const [bloqueos, denuncias] = await withUser(ctx.user.id, async (tx) => [
    await tx
      .select({ id: bloqueosComunidad.bloqueadoMiembroId })
      .from(bloqueosComunidad)
      .where(eq(bloqueosComunidad.iglesiaId, ctx.iglesia.id)),
    await tx
        .select({
          publicacionId: denunciasComunidad.publicacionId,
          comentarioId: denunciasComunidad.comentarioId,
        })
        .from(denunciasComunidad)
        .where(
          and(
            eq(denunciasComunidad.iglesiaId, ctx.iglesia.id),
            // Quien modera lee TODAS las de la iglesia, y no por eso tiene que
            // dejar de verlas: las necesita en el muro para decidir.
            eq(denunciasComunidad.denuncianteMiembroId, miembroId),
          ),
        ),
  ] as const);

  return {
    bloqueados: bloqueos.map((b) => b.id),
    publicacionesDenunciadas: denuncias
      .map((d) => d.publicacionId)
      .filter((x): x is string => x !== null),
    comentariosDenunciados: denuncias
      .map((d) => d.comentarioId)
      .filter((x): x is string => x !== null),
  };
}

/** Las personas que tengo bloqueadas, para `Mi cuenta`. */
export async function misBloqueos(ctx: UserContext): Promise<
  { miembroId: string; nombre: string; foto: string | null; desde: Date }[]
> {
  if (!ctx.miembroId) return [];

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        miembroId: bloqueosComunidad.bloqueadoMiembroId,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        foto: miembros.fotoUrl,
        desde: bloqueosComunidad.createdAt,
      })
      .from(bloqueosComunidad)
      .innerJoin(miembros, eq(miembros.id, bloqueosComunidad.bloqueadoMiembroId))
      .where(eq(bloqueosComunidad.iglesiaId, ctx.iglesia.id))
      .orderBy(desc(bloqueosComunidad.createdAt)),
  );

  const caras = await fotosParaPintar(filas.map((f) => f.foto));
  return filas.map((f) => ({
    miembroId: f.miembroId,
    nombre: nombreCompleto(f.nombre, f.apellidos),
    foto: f.foto ? (caras.get(f.foto) ?? null) : null,
    desde: f.desde,
  }));
}

/** El nombre de una persona de la iglesia, para la pantalla de «denuncia enviada». */
export async function nombreDeMiembro(
  ctx: UserContext,
  miembroId: string,
): Promise<string | null> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ nombre: miembros.nombre, apellidos: miembros.apellidos })
      .from(miembros)
      .where(and(eq(miembros.id, miembroId), eq(miembros.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );
  return fila ? nombreCompleto(fila.nombre, fila.apellidos) : null;
}

/** Cuántas cosas distintas esperan a quien modera. Para el aviso del muro. */
export async function cuantasDenunciasPendientes(ctx: UserContext): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        n: sql<number>`count(distinct coalesce(${denunciasComunidad.publicacionId}, ${denunciasComunidad.comentarioId}))::int`,
      })
      .from(denunciasComunidad)
      .where(
        and(
          eq(denunciasComunidad.iglesiaId, ctx.iglesia.id),
          eq(denunciasComunidad.estado, 'pendiente'),
        ),
      ),
  );
  return fila?.n ?? 0;
}

/**
 * Una cosa denunciada, con todas sus denuncias juntas.
 *
 * Se agrupa por lo denunciado y no se lista denuncia a denuncia: tres personas
 * diciendo lo mismo de una publicación es UNA decisión del pastor, no tres. Y no
 * lleva quién denunció. La pantalla no lo pinta y esto ni lo devuelve, así que
 * no hay forma de que se cuele en ella por descuido.
 */
export type Denunciado = {
  tipo: 'publicacion' | 'comentario';
  id: string;
  autorId: string;
  autorNombre: string;
  autorFoto: string | null;
  texto: string | null;
  imagenes: string[];
  publicadoAt: Date;
  /** La primera denuncia: lo que lleva más tiempo esperando va arriba. */
  primeraAt: Date;
  motivos: { motivo: MotivoDenuncia; veces: number }[];
  detalles: string[];
  total: number;
};

export async function denunciasPendientes(ctx: UserContext): Promise<Denunciado[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        publicacionId: denunciasComunidad.publicacionId,
        comentarioId: denunciasComunidad.comentarioId,
        motivo: denunciasComunidad.motivo,
        detalle: denunciasComunidad.detalle,
        createdAt: denunciasComunidad.createdAt,
      })
      .from(denunciasComunidad)
      .where(
        and(
          eq(denunciasComunidad.iglesiaId, ctx.iglesia.id),
          eq(denunciasComunidad.estado, 'pendiente'),
        ),
      )
      .orderBy(asc(denunciasComunidad.createdAt)),
  );

  if (filas.length === 0) return [];

  const idsPub = [...new Set(filas.flatMap((f) => (f.publicacionId ? [f.publicacionId] : [])))];
  const idsCom = [...new Set(filas.flatMap((f) => (f.comentarioId ? [f.comentarioId] : [])))];

  // `inArray` con una lista vacía escribe `in ()`, que Postgres no acepta.
  const [pubs, coms] = await withUser(ctx.user.id, async (tx) => [
      idsPub.length === 0
        ? []
        : await tx
            .select({
              id: publicaciones.id,
              texto: publicaciones.texto,
              imagenes: publicaciones.imagenes,
              createdAt: publicaciones.createdAt,
              autorId: publicaciones.autorMiembroId,
              nombre: miembros.nombre,
              apellidos: miembros.apellidos,
              foto: miembros.fotoUrl,
            })
            .from(publicaciones)
            .innerJoin(miembros, eq(miembros.id, publicaciones.autorMiembroId))
            .where(inArray(publicaciones.id, idsPub)),
      idsCom.length === 0
        ? []
        : await tx
            .select({
              id: publicacionesComentarios.id,
              texto: publicacionesComentarios.texto,
              createdAt: publicacionesComentarios.createdAt,
              autorId: publicacionesComentarios.autorMiembroId,
              nombre: miembros.nombre,
              apellidos: miembros.apellidos,
              foto: miembros.fotoUrl,
            })
            .from(publicacionesComentarios)
            .innerJoin(miembros, eq(miembros.id, publicacionesComentarios.autorMiembroId))
            .where(inArray(publicacionesComentarios.id, idsCom)),
  ] as const);

  const [firmas, caras] = await Promise.all([
    firmarImagenes(pubs.flatMap((p) => p.imagenes ?? [])),
    fotosParaPintar([...pubs.map((p) => p.foto), ...coms.map((c) => c.foto)]),
  ]);
  const cara = (v: string | null) => (v ? (caras.get(v) ?? null) : null);

  const agrupar = (de: typeof filas) => {
    const cuenta = new Map<MotivoDenuncia, number>();
    for (const f of de) cuenta.set(f.motivo, (cuenta.get(f.motivo) ?? 0) + 1);
    return {
      motivos: [...cuenta].map(([motivo, veces]) => ({ motivo, veces })).sort((a, b) => b.veces - a.veces),
      detalles: de.map((f) => f.detalle?.trim()).filter((d): d is string => Boolean(d)),
      total: de.length,
      primeraAt: de[0]!.createdAt,
    };
  };

  const resultado: Denunciado[] = [
    ...pubs.map((p) => ({
      tipo: 'publicacion' as const,
      id: p.id,
      autorId: p.autorId,
      autorNombre: nombreCompleto(p.nombre, p.apellidos),
      autorFoto: cara(p.foto),
      texto: p.texto,
      imagenes: (p.imagenes ?? []).map((r) => firmas.get(r)).filter((u): u is string => Boolean(u)),
      publicadoAt: p.createdAt,
      ...agrupar(filas.filter((f) => f.publicacionId === p.id)),
    })),
    ...coms.map((c) => ({
      tipo: 'comentario' as const,
      id: c.id,
      autorId: c.autorId,
      autorNombre: nombreCompleto(c.nombre, c.apellidos),
      autorFoto: cara(c.foto),
      texto: c.texto,
      imagenes: [],
      publicadoAt: c.createdAt,
      ...agrupar(filas.filter((f) => f.comentarioId === c.id)),
    })),
  ];

  return resultado.sort((a, b) => a.primeraAt.getTime() - b.primeraAt.getTime());
}
