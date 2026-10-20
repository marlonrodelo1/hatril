import 'server-only';

import { and, asc, count, desc, eq, ilike, inArray, lte, max, or } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { canciones, turnoCanciones, turnos } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Consultas del repertorio.
 *
 * Por `withUser` como todo lo demás, aunque una canción no sea un dato de
 * nadie: el aislamiento entre iglesias no depende de lo delicado que sea lo que
 * se lee, y una consulta por `dbAdmin` aquí sería la excepción que alguien
 * copiaría luego en una tabla que sí lo es.
 *
 * Quién puede pedir qué lo decide quien llama, como en `turnos/consultas.ts`:
 * las del panel cuelgan del guard del ministerio, y la lista de un culto la pide
 * también la ficha del turno del miembro, que ya comprobó que es de su equipo.
 */

export type Cancion = {
  id: string;
  titulo: string;
  autor: string | null;
  tono: string | null;
  enlaceAudio: string | null;
  enlacePartitura: string | null;
  notas: string | null;
  archivada: boolean;
};

export type CancionResumen = Cancion & {
  /** Cultos ya celebrados en los que salió. Los planificados no cuentan. */
  veces: number;
  /** La última fecha en que se cantó, o null si todavía no. */
  ultimaVez: string | null;
};

const COLUMNAS = {
  id: canciones.id,
  titulo: canciones.titulo,
  autor: canciones.autor,
  tono: canciones.tono,
  enlaceAudio: canciones.enlaceAudio,
  enlacePartitura: canciones.enlacePartitura,
  notas: canciones.notas,
  archivada: canciones.archivada,
};

/**
 * El repertorio de un equipo, por título, con cuándo se cantó cada canción.
 *
 * «Cuándo se cantó» cuenta solo hasta HOY: un domingo planificado para dentro
 * de tres semanas no es un domingo en que se cantara, y contarlo haría creer al
 * responsable que una canción está muy vista cuando todavía no ha sonado.
 *
 * Los recuentos van en una segunda consulta agrupada y no en una subconsulta
 * por fila: una columna interpolada dentro de un `sql` de Drizzle sale sin
 * cualificar (ver `listarReuniones`).
 */
export async function listarCanciones(
  ctx: UserContext,
  ministerioId: string,
  opciones: { hoy: string; busqueda?: string; archivadas?: boolean },
): Promise<CancionResumen[]> {
  const { hoy, busqueda, archivadas = false } = opciones;

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select(COLUMNAS)
      .from(canciones)
      .where(
        and(
          eq(canciones.iglesiaId, ctx.iglesia.id),
          eq(canciones.ministerioId, ministerioId),
          eq(canciones.archivada, archivadas),
          busqueda
            ? or(
                ilike(canciones.titulo, `%${busqueda}%`),
                ilike(canciones.autor, `%${busqueda}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(canciones.titulo));

    if (filas.length === 0) return [];

    const uso = await tx
      .select({
        cancionId: turnoCanciones.cancionId,
        veces: count(),
        ultimaVez: max(turnos.fecha),
      })
      .from(turnoCanciones)
      .innerJoin(turnos, eq(turnos.id, turnoCanciones.turnoId))
      .where(
        and(
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          inArray(
            turnoCanciones.cancionId,
            filas.map((f) => f.id),
          ),
          lte(turnos.fecha, hoy),
        ),
      )
      .groupBy(turnoCanciones.cancionId);

    const porCancion = new Map(uso.map((u) => [u.cancionId, u]));

    return filas.map((f) => ({
      ...f,
      veces: Number(porCancion.get(f.id)?.veces ?? 0),
      ultimaVez: porCancion.get(f.id)?.ultimaVez ?? null,
    }));
  });
}

export type CancionDetalle = Cancion & {
  ministerioId: string;
  /** Cada culto en que salió, el último primero. Los futuros también. */
  historial: { turnoId: string; fecha: string; titulo: string; tono: string | null }[];
};

/** Una canción con su historial. `null` si no existe o es de otra iglesia. */
export async function obtenerCancion(
  ctx: UserContext,
  cancionId: string,
): Promise<CancionDetalle | null> {
  return withUser(ctx.user.id, async (tx) => {
    const [c] = await tx
      .select({ ...COLUMNAS, ministerioId: canciones.ministerioId })
      .from(canciones)
      .where(and(eq(canciones.id, cancionId), eq(canciones.iglesiaId, ctx.iglesia.id)))
      .limit(1);

    if (!c) return null;

    const historial = await tx
      .select({
        turnoId: turnos.id,
        fecha: turnos.fecha,
        titulo: turnos.titulo,
        tono: turnoCanciones.tono,
      })
      .from(turnoCanciones)
      .innerJoin(turnos, eq(turnos.id, turnoCanciones.turnoId))
      .where(
        and(
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          eq(turnoCanciones.cancionId, cancionId),
        ),
      )
      .orderBy(desc(turnos.fecha))
      .limit(30);

    return { ...c, historial };
  });
}

export type CancionEnTurno = Cancion & {
  /** El id de la fila de la lista, que es lo que se mueve y se quita. */
  filaId: string;
  orden: number;
  /** El de ESE culto si se cambió; si no, null y vale el de la canción. */
  tonoDelDia: string | null;
};

/** La lista de un culto, en su orden. */
export async function cancionesDelTurno(
  ctx: UserContext,
  turnoId: string,
): Promise<CancionEnTurno[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        ...COLUMNAS,
        filaId: turnoCanciones.id,
        orden: turnoCanciones.orden,
        tonoDelDia: turnoCanciones.tono,
      })
      .from(turnoCanciones)
      .innerJoin(canciones, eq(canciones.id, turnoCanciones.cancionId))
      .where(
        and(
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          eq(turnoCanciones.turnoId, turnoId),
        ),
      )
      .orderBy(asc(turnoCanciones.orden), asc(turnoCanciones.createdAt)),
  );
}

/**
 * Las canciones que se pueden poner en una lista: las del equipo, sin las
 * archivadas. El desplegable de elegir no ofrece lo que el equipo ya no toca.
 */
export async function cancionesParaElegir(
  ctx: UserContext,
  ministerioId: string,
): Promise<{ id: string; titulo: string; autor: string | null; tono: string | null }[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: canciones.id,
        titulo: canciones.titulo,
        autor: canciones.autor,
        tono: canciones.tono,
      })
      .from(canciones)
      .where(
        and(
          eq(canciones.iglesiaId, ctx.iglesia.id),
          eq(canciones.ministerioId, ministerioId),
          eq(canciones.archivada, false),
        ),
      )
      .orderBy(asc(canciones.titulo)),
  );
}

/**
 * Cuántas canciones tiene la lista de cada turno, para el cuadrante.
 *
 * Es lo que el responsable repasa a mitad de semana: qué domingos tienen ya la
 * lista hecha y cuáles no. Un turno sin canciones no sale en el mapa, y quien
 * pinta lo lee como «sin lista».
 *
 * Un solo `count` agrupado para todos los turnos de la pantalla, y no
 * `cancionesDelTurno` por cada uno: serían treinta viajes a Irlanda para pintar
 * treinta números.
 */
export async function cancionesPorTurno(
  ctx: UserContext,
  turnoIds: string[],
): Promise<Map<string, number>> {
  if (turnoIds.length === 0) return new Map();

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ turnoId: turnoCanciones.turnoId, canciones: count() })
      .from(turnoCanciones)
      .where(
        and(
          eq(turnoCanciones.iglesiaId, ctx.iglesia.id),
          inArray(turnoCanciones.turnoId, turnoIds),
        ),
      )
      .groupBy(turnoCanciones.turnoId),
  );

  return new Map(filas.map((f) => [f.turnoId, Number(f.canciones)]));
}
