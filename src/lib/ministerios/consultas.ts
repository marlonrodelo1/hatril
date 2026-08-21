import 'server-only';

import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { withUser } from '@/lib/db';
import { miembros, ministerioMiembros, ministerios } from '@/lib/db/schema';
import type { RolEquipo } from '@/lib/db/schema/enums';
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
    //
    // El responsable se alcanza por la pivote con un alias, y no por la tabla a
    // secas, porque la subconsulta del recuento también la nombra: sin alias, el
    // `where` de dentro se resolvería contra la fila ya unida de fuera y contaría
    // uno por ministerio.
    const responsable = alias(ministerioMiembros, 'responsable');

    const filas = await tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        descripcion: ministerios.descripcion,
        colorHex: ministerios.colorHex,
        orden: ministerios.orden,
        fotoUrl: ministerios.fotoUrl,
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
      .leftJoin(
        responsable,
        and(
          eq(responsable.ministerioId, ministerios.id),
          eq(responsable.rolEquipo, 'responsable'),
          eq(responsable.activo, true),
        ),
      )
      .leftJoin(miembros, eq(miembros.id, responsable.miembroId))
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
  /** Qué HACE: "Vocalista", "Guitarra". Texto libre. */
  rolEnMinisterio: string | null;
  /** Qué MANDA. El otro eje, y el que lleva permisos detrás. */
  rolEquipo: RolEquipo;
  desde: string | null;
  estado: EstadoMiembro;
};

/** Responsable primero, luego colíderes, luego el resto. */
const ORDEN_ROL_EQUIPO: Record<RolEquipo, number> = {
  responsable: 0,
  colider: 1,
  voluntario: 2,
};

export type MinisterioDetalle = MinisterioResumen & {
  /** La foto que sale en la web pública. Solo hace falta en el detalle. */
  fotoUrl: string | null;
  /** Identificador crudo. Se resuelve con `tipoDeMinisterio()`, que nunca falla. */
  tipo: string;
  mision: string | null;
  vision: string | null;
  objetivo: string | null;
  /**
   * El jsonb tal cual. Sale como `unknown` a propósito: quien lo consuma tiene
   * que pasar por `modulosActivos()`, que descarta lo que no reconoce. Tiparlo
   * aquí como `ModulosGuardados` prometería una forma que la columna no
   * garantiza — puede haberla escrito una versión anterior del producto.
   */
  modulos: unknown;
  equipo: IntegranteEquipo[];
};

export async function obtenerMinisterio(
  ctx: UserContext,
  ministerioId: string,
): Promise<MinisterioDetalle | null> {
  return withUser(ctx.user.id, async (tx) => {
    // Sin unión con la ficha del líder: el responsable es una fila más del
    // equipo, que ya se pide justo debajo. Antes hacía falta porque el liderazgo
    // vivía en una columna de esta tabla.
    const filas = await tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        descripcion: ministerios.descripcion,
        colorHex: ministerios.colorHex,
        orden: ministerios.orden,
        fotoUrl: ministerios.fotoUrl,
        tipo: ministerios.tipo,
        mision: ministerios.mision,
        vision: ministerios.vision,
        objetivo: ministerios.objetivo,
        modulos: ministerios.modulos,
      })
      .from(ministerios)
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
        rolEquipo: ministerioMiembros.rolEquipo,
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

    const integrantes: IntegranteEquipo[] = equipo
      .map((p) => ({
        vinculoId: p.vinculoId,
        miembroId: p.miembroId,
        nombre: [p.nombre, p.apellidos].filter(Boolean).join(' '),
        rolEnMinisterio: p.rolEnMinisterio,
        rolEquipo: p.rolEquipo,
        desde: p.desde,
        estado: p.estado,
      }))
      // El responsable primero y los colíderes detrás. Son a quienes se busca al
      // abrir esta pantalla, y ordenar solo por nombre los dejaría enterrados en
      // la mitad de la lista.
      .sort(
        (a, b) => ORDEN_ROL_EQUIPO[a.rolEquipo] - ORDEN_ROL_EQUIPO[b.rolEquipo],
      );

    const responsable = integrantes.find((p) => p.rolEquipo === 'responsable');

    return {
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      colorHex: m.colorHex,
      orden: m.orden,
      fotoUrl: m.fotoUrl,
      tipo: m.tipo,
      mision: m.mision,
      vision: m.vision,
      objetivo: m.objetivo,
      modulos: m.modulos,
      voluntarios: integrantes.length,
      lider: responsable
        ? { id: responsable.miembroId, nombre: responsable.nombre }
        : null,
      equipo: integrantes,
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

/*
 * Aquí vivía `integrantesParaLider`, que llenaba un desplegable de «responsable»
 * en el formulario de editar. Con el liderazgo en la pivote ya no hace falta: el
 * responsable se nombra desde la propia lista del equipo, donde la gente ya está
 * y con su cara delante.
 */

/**
 * Qué ministerios lidera cada una de estas personas.
 *
 * Para la pantalla de Equipo. Una sola consulta para toda la iglesia en vez de
 * una por fila: con quince cuentas serían quince viajes para pintar una columna.
 */
export async function lideresDeMinisterios(
  ctx: UserContext,
  miembroIds: string[],
): Promise<Map<string, { id: string; nombre: string }[]>> {
  const mapa = new Map<string, { id: string; nombre: string }[]>();
  if (miembroIds.length === 0) return mapa;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        miembroId: ministerioMiembros.miembroId,
        ministerioId: ministerios.id,
        nombre: ministerios.nombre,
      })
      .from(ministerioMiembros)
      .innerJoin(ministerios, eq(ministerios.id, ministerioMiembros.ministerioId))
      .where(
        and(
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          inArray(ministerioMiembros.miembroId, miembroIds),
          eq(ministerioMiembros.activo, true),
          ne(ministerioMiembros.rolEquipo, 'voluntario'),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(ministerios.nombre)),
  );

  for (const f of filas) {
    const lista = mapa.get(f.miembroId) ?? [];
    lista.push({ id: f.ministerioId, nombre: f.nombre });
    mapa.set(f.miembroId, lista);
  }

  return mapa;
}

/**
 * Equipos activos que se han quedado sin responsable.
 *
 * Para el panel de inicio. Un ministerio sin nadie al frente no da error ni
 * aparece distinto en la rejilla: simplemente pone «Sin responsable asignado» y
 * ahí se queda meses. Sacarlo a la primera pantalla es la diferencia entre un
 * hueco que alguien tapa y un hueco que nadie ve.
 */
export async function ministeriosSinResponsable(
  ctx: UserContext,
): Promise<{ id: string; nombre: string; colorHex: string }[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        colorHex: ministerios.colorHex,
      })
      .from(ministerios)
      .where(
        and(
          eq(ministerios.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
          sql`not exists (
            select 1 from ${ministerioMiembros}
             where ${ministerioMiembros.ministerioId} = ${ministerios.id}
               and ${ministerioMiembros.rolEquipo} = 'responsable'
               and ${ministerioMiembros.activo} = true
          )`,
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
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

export type MiMinisterio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  colorHex: string;
  objetivo: string | null;
  /** El jsonb crudo. Se resuelve con `modulosActivos()`, que descarta lo raro. */
  modulos: unknown;
  /** Qué HACE aquí: «Voz y teclado». Texto libre. */
  rolEnMinisterio: string | null;
  /** Qué MANDA: responsable, colíder o voluntario. */
  rolEquipo: RolEquipo;
};

/**
 * Los ministerios en los que sirve ESTA persona.
 *
 * Es la consulta del área del miembro, y por eso no se parece a
 * `listarMinisteriosConEquipo()`: aquélla es el listado del pastor y trae el
 * equipo de cada uno. Aquí no sale ni un nombre ajeno — un voluntario de
 * alabanza no tiene por qué ver, desde su propia pantalla de inicio, quién más
 * está apuntado en niños.
 *
 * Devuelve vacío si la cuenta no tiene ficha, que es un caso real: una cuenta
 * puede existir sin `miembros` asociado.
 */
export async function misMinisterios(
  ctx: UserContext,
): Promise<MiMinisterio[]> {
  if (!ctx.miembroId) return [];

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: ministerios.id,
        nombre: ministerios.nombre,
        descripcion: ministerios.descripcion,
        colorHex: ministerios.colorHex,
        objetivo: ministerios.objetivo,
        modulos: ministerios.modulos,
        rolEnMinisterio: ministerioMiembros.rolEnMinisterio,
        rolEquipo: ministerioMiembros.rolEquipo,
      })
      .from(ministerioMiembros)
      .innerJoin(
        ministerios,
        eq(ministerios.id, ministerioMiembros.ministerioId),
      )
      .where(
        and(
          eq(ministerioMiembros.miembroId, ctx.miembroId!),
          eq(ministerioMiembros.activo, true),
          eq(ministerioMiembros.iglesiaId, ctx.iglesia.id),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre));

    return filas;
  });
}
