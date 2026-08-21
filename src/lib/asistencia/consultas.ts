import 'server-only';

import { and, asc, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  asistencias,
  miembros,
  ministerioMiembros,
  ministerios,
  reuniones,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import type { EstadoMiembro } from '@/lib/miembros/estados';
import { miembrosSinPermisoDeAsistencia } from '@/lib/rgpd/consultas';

/**
 * Consultas de reuniones y asistencia.
 *
 * NADA DE `dbAdmin` AQUÍ DENTRO, como en `finanzas/` y `eventos/`. El
 * aislamiento lo pone la RLS a través de `withUser`; el `eq(iglesiaId)` de cada
 * consulta es un segundo cinturón por si alguna acabara ejecutándose con el rol
 * equivocado. Con estos datos —quién estuvo en un culto y qué día— la diferencia
 * entre las dos puertas es una brecha del art. 9 que hay que notificar.
 *
 * Y no hay módulo `publica.ts` gemelo, ni lo va a haber: de aquí no sale nada a
 * la web de la iglesia.
 */

export type ReunionResumen = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  /** Nombre del ministerio, o `null` si es de la congregación entera. */
  ministerio: { id: string; nombre: string; colorHex: string } | null;
  /** Cuánta gente vino. */
  presentes: number;
  /**
   * Cuántas fichas se repasaron. Cero significa «no se pasó lista», que NO es
   * lo mismo que «no vino nadie» — ver el schema de `asistencias`.
   */
  marcados: number;
};

/**
 * Las reuniones de la iglesia, de la más reciente hacia atrás.
 *
 * Con `ministerioId` devuelve solo las de ese equipo; sin él, solo las de la
 * congregación (`ministerio_id is null`). Nunca las mezcla: son dos pantallas
 * distintas y un culto perdido entre catorce ensayos no lo encuentra nadie.
 *
 * Los recuentos van por LEFT JOIN y GROUP BY y no por subconsulta correlacionada
 * a propósito. Una columna interpolada dentro de una subconsulta de Drizzle sale
 * SIN cualificar, y así fue como el contador de plazas de eventos acabó siendo
 * `where ei.evento_id = ei.id`: cero siempre, sin error y sin aviso.
 */
export async function listarReuniones(
  ctx: UserContext,
  opciones: { ministerioId?: string; limite?: number } = {},
): Promise<ReunionResumen[]> {
  const { ministerioId, limite = 60 } = opciones;

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: reuniones.id,
        titulo: reuniones.titulo,
        fecha: reuniones.fecha,
        hora: reuniones.hora,
        lugar: reuniones.lugar,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
        presentes: sql<number>`count(*) filter (where ${asistencias.presente})`,
        marcados: sql<number>`count(${asistencias.id})`,
      })
      .from(reuniones)
      .leftJoin(asistencias, eq(asistencias.reunionId, reuniones.id))
      .leftJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
      .where(
        and(
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          ministerioId
            ? eq(reuniones.ministerioId, ministerioId)
            : isNull(reuniones.ministerioId),
        ),
      )
      .groupBy(reuniones.id, ministerios.id)
      .orderBy(desc(reuniones.fecha), desc(reuniones.hora))
      .limit(limite);

    return filas.map((f) => ({
      id: f.id,
      titulo: f.titulo,
      fecha: f.fecha,
      hora: f.hora,
      lugar: f.lugar,
      ministerio: f.ministerioId
        ? {
            id: f.ministerioId,
            nombre: f.ministerioNombre!,
            colorHex: f.ministerioColor!,
          }
        : null,
      presentes: Number(f.presentes),
      marcados: Number(f.marcados),
    }));
  });
}

export type ReunionDetalle = ReunionResumen & { notas: string | null };

export async function obtenerReunion(
  ctx: UserContext,
  reunionId: string,
): Promise<ReunionDetalle | null> {
  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: reuniones.id,
        titulo: reuniones.titulo,
        fecha: reuniones.fecha,
        hora: reuniones.hora,
        lugar: reuniones.lugar,
        notas: reuniones.notas,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
      })
      .from(reuniones)
      .leftJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
      .where(
        and(
          eq(reuniones.id, reunionId),
          eq(reuniones.iglesiaId, ctx.iglesia.id),
        ),
      )
      .limit(1);

    const r = filas[0];
    if (!r) return null;

    const [conteo] = await tx
      .select({
        presentes: sql<number>`count(*) filter (where ${asistencias.presente})`,
        marcados: sql<number>`count(${asistencias.id})`,
      })
      .from(asistencias)
      .where(eq(asistencias.reunionId, reunionId));

    return {
      id: r.id,
      titulo: r.titulo,
      fecha: r.fecha,
      hora: r.hora,
      lugar: r.lugar,
      notas: r.notas,
      ministerio: r.ministerioId
        ? {
            id: r.ministerioId,
            nombre: r.ministerioNombre!,
            colorHex: r.ministerioColor!,
          }
        : null,
      presentes: Number(conteo?.presentes ?? 0),
      marcados: Number(conteo?.marcados ?? 0),
    };
  });
}

export type FilaDeLista = {
  miembroId: string;
  nombre: string;
  estado: EstadoMiembro;
  /** `null` = todavía no se ha repasado a esta persona en esta reunión. */
  presente: boolean | null;
};

/**
 * La congregación entera, con la marca que tenga en esta reunión.
 *
 * SIN PAGINAR, Y ES DELIBERADO
 * ----------------------------
 * El resto de listados del panel pagina de 25 en 25. Aquí no: pasar lista es un
 * solo formulario, y una casilla marcada en la página 1 se perdería al saltar a
 * la 2 — el navegador solo envía lo que está en el DOM. Antes que partir esto en
 * páginas y perder marcas, entra la congregación entera. El día que una iglesia
 * de 800 personas lo haga incómodo, la salida es filtrar por ministerio o buscar
 * por nombre, no paginar.
 *
 * QUIÉN ENTRA EN LA LISTA
 * -----------------------
 * Todos menos las bajas y las fichas archivadas. `inactivo` SÍ entra, y es el
 * caso que importa: quien lleva meses sin aparecer es justo a quien hay que
 * poder marcar el domingo que vuelve.
 *
 * Y menos quien no ha dado permiso a que se apunte su asistencia, que lo aplica
 * `miembrosSinPermisoDeAsistencia()`. Es lo que hace que esa casilla no sea un
 * adorno: un permiso que se puede negar sin que cambie nada no es un permiso.
 *
 * Ojo con el matiz, que está razonado entero en `rgpd/consultas.ts`: se excluye a
 * quien vio la casilla y no la marcó, NO a quien nunca llegó a verla. Silencio no
 * es negativa, y tratarlo como tal vaciaría la lista el primer día.
 */
export async function listaParaPasar(
  ctx: UserContext,
  reunionId: string,
): Promise<FilaDeLista[]> {
  const sinPermiso = await miembrosSinPermisoDeAsistencia(ctx);

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        estado: miembros.estado,
        presente: asistencias.presente,
      })
      .from(miembros)
      .leftJoin(
        asistencias,
        and(
          eq(asistencias.miembroId, miembros.id),
          eq(asistencias.reunionId, reunionId),
        ),
      )
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          ne(miembros.estado, 'baja'),
        ),
      )
      .orderBy(asc(miembros.nombre), asc(miembros.apellidos));

    return filas
      .filter((f) => !sinPermiso.has(f.miembroId))
      .map((f) => ({
        miembroId: f.miembroId,
        nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
        estado: f.estado,
        presente: f.presente,
      }));
  });
}

/**
 * El EQUIPO de un ministerio, con su marca en esta reunión.
 *
 * Gemela de `listaParaPasar`, y separada a propósito en vez de resuelta con un
 * parámetro opcional. Lo que cambia no es el filtro, es a quién alcanza cada
 * una: aquella devuelve la congregación entera —dato del art. 9 de gente que no
 * tiene por qué salir en la pantalla de un líder de alabanza— y esta solo a
 * quien sirve en ese equipo, que el responsable ya ve en su propio ministerio.
 *
 * Con una sola función y un `ministerioId?` opcional, olvidarse de pasarlo en
 * una pantalla nueva abriría la congregación entera sin que nada fallara.
 */
export async function listaDelEquipo(
  ctx: UserContext,
  reunionId: string,
  ministerioId: string,
): Promise<FilaDeLista[]> {
  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        miembroId: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        estado: miembros.estado,
        presente: asistencias.presente,
      })
      .from(ministerioMiembros)
      .innerJoin(miembros, eq(miembros.id, ministerioMiembros.miembroId))
      .leftJoin(
        asistencias,
        and(
          eq(asistencias.miembroId, miembros.id),
          eq(asistencias.reunionId, reunionId),
        ),
      )
      .where(
        and(
          eq(ministerioMiembros.ministerioId, ministerioId),
          eq(ministerioMiembros.activo, true),
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
        ),
      )
      .orderBy(asc(miembros.nombre), asc(miembros.apellidos));

    return filas.map((f) => ({
      miembroId: f.miembroId,
      nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
      estado: f.estado,
      presente: f.presente,
    }));
  });
}

export type ProximaReunion = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  ministerio: { id: string; nombre: string; colorHex: string };
};

/**
 * Lo que le viene encima a un miembro: la agenda de SUS equipos, de hoy en
 * adelante.
 *
 * SOLO LAS DE SUS MINISTERIOS, Y NUNCA LAS DE LA CONGREGACIÓN
 * ------------------------------------------------------------
 * Las reuniones sin ministerio son los cultos, y esas no se listan aquí por dos
 * razones. La primera es que el patrón semanal ya sale en la web de la iglesia
 * —`iglesias.horarios`—, que es donde la gente lo busca. La segunda es que se
 * crean sobre todo hacia atrás, en el momento de pasar lista: una lista de
 * «próximos cultos» estaría casi siempre vacía y haría dudar de si la iglesia
 * ha dejado de reunirse.
 *
 * `ministerioIds` viene de fuera y NO se resuelve aquí: quien llama ya ha
 * cargado los ministerios de esta persona, y volver a pedirlos sería un viaje de
 * más. Si llega vacío se devuelve vacío sin tocar la base — `inArray` con una
 * lista vacía genera SQL que Postgres rechaza.
 */
export async function proximasDeMisMinisterios(
  ctx: UserContext,
  ministerioIds: string[],
  desde: string,
): Promise<ProximaReunion[]> {
  if (ministerioIds.length === 0) return [];

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: reuniones.id,
        titulo: reuniones.titulo,
        fecha: reuniones.fecha,
        hora: reuniones.hora,
        lugar: reuniones.lugar,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
        ministerioColor: ministerios.colorHex,
      })
      .from(reuniones)
      .innerJoin(ministerios, eq(ministerios.id, reuniones.ministerioId))
      .where(
        and(
          eq(reuniones.iglesiaId, ctx.iglesia.id),
          inArray(reuniones.ministerioId, ministerioIds),
          gte(reuniones.fecha, desde),
        ),
      )
      .orderBy(asc(reuniones.fecha), asc(reuniones.hora))
      .limit(12);

    return filas.map((f) => ({
      id: f.id,
      titulo: f.titulo,
      fecha: f.fecha,
      hora: f.hora,
      lugar: f.lugar,
      ministerio: {
        id: f.ministerioId,
        nombre: f.ministerioNombre,
        colorHex: f.ministerioColor,
      },
    }));
  });
}
