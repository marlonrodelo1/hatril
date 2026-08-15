import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  miembros,
  ministerioMiembros,
  ministerios,
} from '@/lib/db/schema';
import {
  ambitoMiembros,
  puedeVerDatosSensibles,
  type ContextoPermisos,
} from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import type { EstadoMiembro } from './estados';

/**
 * Consultas del fichero de miembros.
 *
 * DOS FILTROS QUE NO SON LO MISMO
 * -------------------------------
 * Sobre estas consultas actúan dos recortes distintos, y conviene no
 * confundirlos:
 *
 *   1. LA RLS, que impide ver miembros de OTRA iglesia. No aparece en este
 *      fichero porque no hace falta escribirla: `withUser` entra con el rol
 *      `hatril_app` y Postgres la aplica sola. Aunque alguien borrara todos los
 *      `where` de aquí abajo, no saldría ni una fila de otra congregación.
 *
 *   2. EL ÁMBITO, que decide a quién ve cada persona DENTRO de su iglesia: el
 *      pastor a todos, un líder a los de sus ministerios, un miembro solo a sí
 *      mismo. Eso sí se escribe aquí, porque es una regla de producto y no una
 *      frontera de seguridad.
 *
 * Y un tercer recorte, por COLUMNAS: los campos sensibles (nacimiento,
 * dirección, notas) solo se seleccionan si la persona tiene el permiso. No se
 * traen y se ocultan en la plantilla —eso los mandaría igualmente al navegador,
 * donde cualquiera los ve en el HTML—; directamente no se piden.
 */

export const POR_PAGINA = 25;

export type FiltrosMiembros = {
  busqueda?: string;
  estado?: EstadoMiembro;
  ministerioId?: string;
  pagina?: number;
};

export type FilaMiembro = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  estado: EstadoMiembro;
  fechaIngreso: string | null;
  ministerios: { id: string; nombre: string }[];
};

/**
 * Condición de ámbito, como fragmento SQL.
 *
 * Devuelve `undefined` cuando no hay que recortar nada (el pastor), y una
 * condición imposible cuando no se puede ver a nadie. Ese caso `ninguno` es
 * raro pero real —una cuenta activa a la que borraron la ficha— y se devuelve
 * explícitamente en vez de dejarlo pasar: fallar abierto aquí sería enseñar la
 * congregación entera a quien ya no debería verla.
 */
function condicionAmbito(ctx: ContextoPermisos) {
  const ambito = ambitoMiembros(ctx);

  switch (ambito.tipo) {
    case 'iglesia':
      return undefined;

    case 'ministerios':
      return sirveEnAlgunMinisterio(ambito.ministerioIds);

    case 'propio':
      return eq(miembros.id, ambito.miembroId);

    case 'ninguno':
      // Condición imposible en vez de `undefined`: si esto devolviera
      // `undefined`, «no puede ver a nadie» se convertiría en «no filtres
      // nada», que es exactamente lo contrario.
      return sql`false`;
  }
}

/**
 * EXISTS correlacionado: ¿la fila de `miembros` sirve en alguno de estos
 * ministerios?
 *
 * Se compone con `inArray` en lugar de escribir `in ${ids}` a mano dentro de la
 * plantilla: Drizzle enlazaría el array entero como UN parámetro y el SQL
 * saldría inválido. `inArray` genera el `in ($1, $2, …)` correcto.
 */
function sirveEnAlgunMinisterio(ministerioIds: string[]) {
  return sql`exists (
    select 1 from ${ministerioMiembros}
    where ${ministerioMiembros.miembroId} = ${miembros.id}
      and ${ministerioMiembros.activo} = true
      and ${inArray(ministerioMiembros.ministerioId, ministerioIds)}
  )`;
}

export async function listarMiembros(
  ctx: UserContext,
  filtros: FiltrosMiembros = {},
): Promise<{ filas: FilaMiembro[]; total: number; pagina: number }> {
  const pagina = Math.max(1, filtros.pagina ?? 1);

  const condiciones = [
    // Redundante con la RLS, y a propósito: si algún día alguien llama a esta
    // función con `dbAdmin` por error, el filtro de iglesia sigue puesto.
    eq(miembros.iglesiaId, ctx.iglesia.id),
    // Las bajas no se listan salvo que se pidan expresamente.
    filtros.estado === 'baja' ? undefined : isNull(miembros.archivadoAt),
    condicionAmbito(ctx),
    filtros.estado ? eq(miembros.estado, filtros.estado) : undefined,
    filtros.busqueda
      ? or(
          ilike(miembros.nombre, `%${filtros.busqueda}%`),
          ilike(miembros.apellidos, `%${filtros.busqueda}%`),
          ilike(miembros.email, `%${filtros.busqueda}%`),
        )
      : undefined,
    filtros.ministerioId
      ? sirveEnAlgunMinisterio([filtros.ministerioId])
      : undefined,
  ].filter(Boolean);

  return withUser(ctx.user.id, async (tx) => {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(miembros)
      .where(and(...condiciones));

    const filas = await tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        email: miembros.email,
        telefono: miembros.telefono,
        estado: miembros.estado,
        fechaIngreso: miembros.fechaIngreso,
      })
      .from(miembros)
      .where(and(...condiciones))
      // Los nuevos primero: son la gente a la que hay que contactar esta
      // semana, y es lo que un pastor busca al abrir esta pantalla.
      .orderBy(desc(miembros.createdAt), asc(miembros.nombre))
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA);

    if (filas.length === 0) {
      return { filas: [], total: Number(total), pagina };
    }

    // Los ministerios de las 25 filas de esta página, en UNA consulta.
    // Pedirlos fila a fila serían 25 idas y vueltas por cada carga de pantalla:
    // es el N+1 clásico, y con 200 ms de latencia hasta eu-west-1 desde
    // Colombia se nota de sobra.
    const vinculos = await tx
      .select({
        miembroId: ministerioMiembros.miembroId,
        ministerioId: ministerios.id,
        ministerioNombre: ministerios.nombre,
      })
      .from(ministerioMiembros)
      .innerJoin(ministerios, eq(ministerios.id, ministerioMiembros.ministerioId))
      .where(
        and(
          inArray(
            ministerioMiembros.miembroId,
            filas.map((f) => f.id),
          ),
          eq(ministerioMiembros.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden));

    const porMiembro = new Map<string, { id: string; nombre: string }[]>();
    for (const v of vinculos) {
      const lista = porMiembro.get(v.miembroId) ?? [];
      lista.push({ id: v.ministerioId, nombre: v.ministerioNombre });
      porMiembro.set(v.miembroId, lista);
    }

    return {
      filas: filas.map((f) => ({
        ...f,
        ministerios: porMiembro.get(f.id) ?? [],
      })),
      total: Number(total),
      pagina,
    };
  });
}

export type FichaMiembro = FilaMiembro & {
  numeroMiembro: number | null;
  bautizado: boolean;
  fechaBautismo: string | null;
  /** Solo con el permiso `ver_datos_sensibles`. `null` significa «no puedes verlo». */
  sensibles: {
    fechaNacimiento: string | null;
    direccion: string | null;
    ciudad: string | null;
    estadoCivil: string | null;
    notas: string | null;
  } | null;
};

export async function obtenerMiembro(
  ctx: UserContext,
  miembroId: string,
): Promise<FichaMiembro | null> {
  const puedeSensibles = puedeVerDatosSensibles(ctx);

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        email: miembros.email,
        telefono: miembros.telefono,
        estado: miembros.estado,
        fechaIngreso: miembros.fechaIngreso,
        numeroMiembro: miembros.numeroMiembro,
        bautizado: miembros.bautizado,
        fechaBautismo: miembros.fechaBautismo,
        // Se seleccionan siempre en la consulta pero se descartan abajo si no
        // hay permiso. Traerlos y no enviarlos es distinto de enviarlos y
        // ocultarlos con CSS: lo segundo los deja en el HTML del navegador.
        fechaNacimiento: miembros.fechaNacimiento,
        direccion: miembros.direccion,
        ciudad: miembros.ciudad,
        estadoCivil: miembros.estadoCivil,
        notas: miembros.notas,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.id, miembroId),
          eq(miembros.iglesiaId, ctx.iglesia.id),
          condicionAmbito(ctx),
        ),
      )
      .limit(1);

    const m = filas[0];
    if (!m) return null;

    const vinculos = await tx
      .select({ id: ministerios.id, nombre: ministerios.nombre })
      .from(ministerioMiembros)
      .innerJoin(ministerios, eq(ministerios.id, ministerioMiembros.ministerioId))
      .where(
        and(
          eq(ministerioMiembros.miembroId, m.id),
          eq(ministerioMiembros.activo, true),
        ),
      )
      .orderBy(asc(ministerios.orden));

    return {
      id: m.id,
      nombre: m.nombre,
      apellidos: m.apellidos,
      email: m.email,
      telefono: m.telefono,
      estado: m.estado,
      fechaIngreso: m.fechaIngreso,
      numeroMiembro: m.numeroMiembro,
      bautizado: m.bautizado,
      fechaBautismo: m.fechaBautismo,
      ministerios: vinculos,
      sensibles: puedeSensibles
        ? {
            fechaNacimiento: m.fechaNacimiento,
            direccion: m.direccion,
            ciudad: m.ciudad,
            estadoCivil: m.estadoCivil,
            notas: m.notas,
          }
        : null,
    };
  });
}

/** Ministerios activos de la iglesia, para los filtros y los formularios. */
export async function listarMinisterios(ctx: UserContext) {
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
        ),
      )
      .orderBy(asc(ministerios.orden), asc(ministerios.nombre)),
  );
}

/** Cifras del encabezado: total y altas del mes en curso. */
export async function resumenMiembros(ctx: UserContext) {
  return withUser(ctx.user.id, async (tx) => {
    const [fila] = await tx
      .select({
        total: count(),
        nuevosDelMes: sql<number>`count(*) filter (
          where ${miembros.createdAt} >= date_trunc('month', now())
        )`,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
        ),
      );

    return {
      total: Number(fila?.total ?? 0),
      nuevosDelMes: Number(fila?.nuevosDelMes ?? 0),
    };
  });
}
