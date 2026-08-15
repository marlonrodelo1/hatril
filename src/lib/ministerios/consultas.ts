import 'server-only';

import { and, asc, count, eq, ilike, isNull, ne, notInArray, or, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros, ministerioMiembros, ministerios } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import type { EstadoMiembro } from '@/lib/miembros/estados';

/**
 * Consultas de ministerios.
 *
 * El aislamiento entre iglesias lo pone la RLS a través de `withUser`; el
 * `eq(iglesiaId)` de cada consulta es un segundo cinturón por si alguna acabara
 * ejecutándose con `dbAdmin` por error.
 *
 * A diferencia del fichero de miembros, aquí NO hay ámbito por ministerio: los
 * ministerios de una iglesia son públicos dentro de ella. Quién forma cada
 * equipo tampoco es secreto —se anuncia desde el púlpito—; lo que sí está
 * protegido son los datos personales de cada persona, y eso se resuelve en la
 * ficha, no aquí.
 */

export type MinisterioResumen = {
  id: string;
  nombre: string;
  descripcion: string | null;
  colorHex: string;
  orden: number;
  voluntarios: number;
  lider: { id: string; nombre: string } | null;
};

export async function listarMinisteriosConEquipo(
  ctx: UserContext,
): Promise<MinisterioResumen[]> {
  return withUser(ctx.user.id, async (tx) => {
    // Un LEFT JOIN con la ficha del líder y una subconsulta para el recuento.
    // Contar en la misma pasada evita una consulta por tarjeta: con seis
    // ministerios serían seis viajes de ida y vuelta a Irlanda por cada carga.
    const filas = await tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        descripcion: ministerios.descripcion,
        colorHex: ministerios.colorHex,
        orden: ministerios.orden,
        liderId: miembros.id,
        liderNombre: miembros.nombre,
        liderApellidos: miembros.apellidos,
        voluntarios: sql<number>`(
          select count(*) from ${ministerioMiembros}
          where ${ministerioMiembros.ministerioId} = ${ministerios.id}
            and ${ministerioMiembros.activo} = true
        )`,
      })
      .from(ministerios)
      .leftJoin(miembros, eq(miembros.id, ministerios.liderMiembroId))
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre));

    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      colorHex: f.colorHex,
      orden: f.orden,
      voluntarios: Number(f.voluntarios),
      lider: f.liderId
        ? {
            id: f.liderId,
            nombre: [f.liderNombre, f.liderApellidos].filter(Boolean).join(' '),
          }
        : null,
    }));
  });
}

export type IntegranteEquipo = {
  vinculoId: string;
  miembroId: string;
  nombre: string;
  rolEnMinisterio: string | null;
  desde: string | null;
  esLider: boolean;
  estado: EstadoMiembro;
};

export type MinisterioDetalle = MinisterioResumen & {
  equipo: IntegranteEquipo[];
};

export async function obtenerMinisterio(
  ctx: UserContext,
  ministerioId: string,
): Promise<MinisterioDetalle | null> {
  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        descripcion: ministerios.descripcion,
        colorHex: ministerios.colorHex,
        orden: ministerios.orden,
        liderMiembroId: ministerios.liderMiembroId,
        liderNombre: miembros.nombre,
        liderApellidos: miembros.apellidos,
      })
      .from(ministerios)
      .leftJoin(miembros, eq(miembros.id, ministerios.liderMiembroId))
      .where(
        and(
          eq(ministerios.id, ministerioId),
          eq(ministerios.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1);

    const m = filas[0];
    if (!m) return null;

    const equipo = await tx
      .select({
        vinculoId: ministerioMiembros.id,
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        estado: miembros.estado,
        rolEnMinisterio: ministerioMiembros.rolEnMinisterio,
        desde: ministerioMiembros.desde,
      })
      .from(ministerioMiembros)
      .innerJoin(miembros, eq(miembros.id, ministerioMiembros.miembroId))
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      )
      .orderBy(asc(miembros.nombre));

    return {
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      colorHex: m.colorHex,
      orden: m.orden,
      voluntarios: equipo.length,
      lider: m.liderMiembroId
        ? {
            id: m.liderMiembroId,
            nombre: [m.liderNombre, m.liderApellidos].filter(Boolean).join(' '),
          }
        : null,
      equipo: equipo
        .map((p) => ({
          vinculoId: p.vinculoId,
          miembroId: p.miembroId,
          nombre: [p.nombre, p.apellidos].filter(Boolean).join(' '),
          rolEnMinisterio: p.rolEnMinisterio,
          desde: p.desde,
          estado: p.estado,
          esLider: p.miembroId === m.liderMiembroId,
        }))
        // El responsable primero. Es a quien se busca cuando se abre esta
        // pantalla, y ordenar por nombre lo dejaría enterrado en la mitad.
        .sort((a, b) => Number(b.esLider) - Number(a.esLider)),
    };
  });
}

/**
 * Personas de la iglesia que TODAVÍA NO están en este equipo.
 *
 * Se filtra en la consulta y no en memoria porque una congregación de 800
 * personas no cabe en un desplegable, y traerlas todas para descartar seis es
 * gastar la conexión en balde.
 */
export async function candidatosParaMinisterio(
  ctx: UserContext,
  ministerioId: string,
  busqueda?: string,
): Promise<{ id: string; nombre: string; estado: EstadoMiembro }[]> {
  return withUser(ctx.user.id, async (tx) => {
    const yaEstan = await tx
      .select({ miembroId: ministerioMiembros.miembroId })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      );

    const excluidos = yaEstan.map((v) => v.miembroId);

    const filas = await tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        estado: miembros.estado,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          // Alguien dado de baja no se suma a un equipo.
          ne(miembros.estado, 'baja'),
          excluidos.length > 0 ? notInArray(miembros.id, excluidos) : undefined,
          busqueda
            ? or(
                ilike(miembros.nombre, `%${busqueda}%`),
                ilike(miembros.apellidos, `%${busqueda}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(miembros.nombre))
      /*
       * Tope alto a propósito.
       *
       * El diálogo de asignar filtra en el navegador sobre lo que recibe, y eso
       * exige que quepa la congregación entera. 300 nombres son unos 10 KB: nada
       * al lado de que buscar sea instantáneo y de que las casillas marcadas no
       * se pierdan al teclear, que es lo que pasaría si cada letra fuera al
       * servidor.
       *
       * Por encima de 300 personas sin ministerio hay que cambiar a búsqueda en
       * servidor —el parámetro `busqueda` ya está aquí para eso— y guardar la
       * selección aparte. Con las iglesias que vamos a tener al principio (40 a
       * 400 miembros) no llega a pasar.
       */
      .limit(300);

    return filas.map((f) => ({
      id: f.id,
      nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
      estado: f.estado,
    }));
  });
}

/** Miembros del equipo, para elegir responsable en el formulario. */
export async function integrantesParaLider(
  ctx: UserContext,
  ministerioId: string,
) {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
      })
      .from(ministerioMiembros)
      .innerJoin(miembros, eq(miembros.id, ministerioMiembros.miembroId))
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
        ),
      )
      .orderBy(asc(miembros.nombre)),
  );
}

/** Cifras del encabezado del listado. */
export async function resumenMinisterios(ctx: UserContext) {
  return withUser(ctx.user.id, async (tx) => {
    const [equipos] = await tx
      .select({ total: count() })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
        ),
      );

    // Personas DISTINTAS que sirven, no vínculos: quien está en tres equipos
    // es una persona, no tres. Contar vínculos infla la cifra y el pastor lo
    // nota enseguida al compararla con el total de la congregación.
    const [personas] = await tx
      .select({
        total: sql<number>`count(distinct ${ministerioMiembros.miembroId})`,
      })
      .from(ministerioMiembros)
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerioMiembros.activo, true),
        ),
      );

    return {
      equipos: Number(equipos?.total ?? 0),
      personasSirviendo: Number(personas?.total ?? 0),
    };
  });
}
