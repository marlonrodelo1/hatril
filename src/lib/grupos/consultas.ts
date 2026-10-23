import 'server-only';

import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
} from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  grupoGuias,
  grupoMiembros,
  grupoSemanas,
  grupos,
  miembros,
  ministerioMiembros,
  ministerios,
} from '@/lib/db/schema';
import type { EstadoSemanaGrupo, RolGrupo } from '@/lib/db/schema/grupos';
import type { UserContext } from '@/lib/auth/user-context';
import type { EstadoMiembro } from '@/lib/miembros/estados';
import { sumarDias } from '@/lib/agenda/horarios';
import {
  estadoDeLaReunion,
  fechaEnLaIglesia,
  lunesDe,
  type EstadoDeLaReunion,
} from './semanas';

/**
 * Consultas de los grupos.
 *
 * Todo por `withUser`, y aquí la RLS es por RELACIÓN (`0047`): el líder de una
 * célula recibe las filas de la suya y ninguna de la de al lado aunque la
 * pantalla se equivoque al pedirlas. El filtro por iglesia y ministerio de
 * cada consulta no es la seguridad; es para que el pastor, que lo ve todo, lea
 * solo lo que tiene delante.
 *
 * Los recuentos se hacen en TypeScript sobre filas ya acotadas, y no con
 * subconsultas en un `sql` de Drizzle: una columna interpolada ahí sale sin
 * cualificar (la trampa de `listarReuniones` en `ESTADO.md`).
 */

const nombreCompleto = (nombre: string, apellidos: string | null) =>
  [nombre, apellidos].filter(Boolean).join(' ');

export type SemanaGuardada = {
  semana: string;
  estado: EstadoSemanaGrupo;
  tema: string | null;
  asistentes: number | null;
  visitas: number | null;
};

export type GrupoDeLaRed = {
  id: string;
  nombre: string;
  zona: string | null;
  diaSemana: number;
  hora: string | null;
  codigo: string;
  /** El día en que se creó, en la zona de la iglesia. */
  alta: string;
  lider: { miembroId: string; nombre: string; enEquipo: boolean } | null;
  auxiliares: { miembroId: string; nombre: string; enEquipo: boolean }[];
  /** Todos los que están dentro, quien lo lleva incluido. */
  integrantes: number;
  /** La última reunión que ya tocó, y cómo quedó. */
  reunion: {
    semana: string;
    fecha: string;
    estado: EstadoDeLaReunion;
    asistentes: number | null;
    visitas: number | null;
  };
};

/**
 * Los grupos abiertos de una red, con quién los lleva, cuántos son y cómo
 * quedó su última reunión.
 *
 * Para el pastor y quien lidera la red: con otra sesión, la RLS devolvería solo
 * los grupos propios, y las cifras de la red saldrían cortas sin avisar. Por
 * eso la llaman pantallas que ya pasaron `puedeGestionarDesdeDentro`.
 */
export async function gruposDeLaRed(
  ctx: UserContext,
  ministerioId: string,
  hoy: string,
): Promise<GrupoDeLaRed[]> {
  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: grupos.id,
        nombre: grupos.nombre,
        zona: grupos.zona,
        diaSemana: grupos.diaSemana,
        hora: grupos.hora,
        codigo: grupos.codigo,
        createdAt: grupos.createdAt,
      })
      .from(grupos)
      .where(
        and(
          eq(grupos.iglesiaId, ctx.iglesia.id),
          eq(grupos.ministerioId, ministerioId),
          eq(grupos.activo, true),
        ),
      )
      .orderBy(asc(grupos.nombre));

    if (filas.length === 0) return [];
    const ids = filas.map((g) => g.id);

    const [gente, equipo, semanas] = await Promise.all([
      tx
        .select({
          grupoId: grupoMiembros.grupoId,
          miembroId: grupoMiembros.miembroId,
          rol: grupoMiembros.rolGrupo,
          nombre: miembros.nombre,
          apellidos: miembros.apellidos,
        })
        .from(grupoMiembros)
        .innerJoin(miembros, eq(miembros.id, grupoMiembros.miembroId))
        .where(and(inArray(grupoMiembros.grupoId, ids), eq(grupoMiembros.activo, true))),
      tx
        .select({ miembroId: ministerioMiembros.miembroId })
        .from(ministerioMiembros)
        .where(
          and(
            eq(ministerioMiembros.ministerioId, ministerioId),
            eq(ministerioMiembros.activo, true),
          ),
        ),
      // La semana que toca es esta o la anterior: con esas dos basta.
      tx
        .select({
          grupoId: grupoSemanas.grupoId,
          semana: grupoSemanas.semana,
          estado: grupoSemanas.estado,
          asistentes: grupoSemanas.asistentes,
          visitas: grupoSemanas.visitas,
        })
        .from(grupoSemanas)
        .where(
          and(
            inArray(grupoSemanas.grupoId, ids),
            gte(grupoSemanas.semana, sumarDias(lunesDe(hoy), -7)),
            lte(grupoSemanas.semana, lunesDe(hoy)),
          ),
        ),
    ]);

    const enEquipo = new Set(equipo.map((e) => e.miembroId));

    return filas.map((g) => {
      const suyos = gente.filter((p) => p.grupoId === g.id);
      const lider = suyos.find((p) => p.rol === 'lider');
      const alta = fechaEnLaIglesia(g.createdAt, ctx.iglesia.timezone);
      const r = estadoDeLaReunion({ diaSemana: g.diaSemana, hoy, alta, estado: null });
      const guardada = semanas.find((s) => s.grupoId === g.id && s.semana === r.semana);
      const reunion = estadoDeLaReunion({
        diaSemana: g.diaSemana,
        hoy,
        alta,
        estado: guardada?.estado ?? null,
      });

      return {
        id: g.id,
        nombre: g.nombre,
        zona: g.zona,
        diaSemana: g.diaSemana,
        hora: g.hora,
        codigo: g.codigo,
        alta,
        lider: lider
          ? {
              miembroId: lider.miembroId,
              nombre: nombreCompleto(lider.nombre, lider.apellidos),
              enEquipo: enEquipo.has(lider.miembroId),
            }
          : null,
        auxiliares: suyos
          .filter((p) => p.rol === 'auxiliar')
          .map((p) => ({
            miembroId: p.miembroId,
            nombre: nombreCompleto(p.nombre, p.apellidos),
            enEquipo: enEquipo.has(p.miembroId),
          })),
        integrantes: suyos.length,
        reunion: {
          ...reunion,
          asistentes: guardada?.asistentes ?? null,
          visitas: guardada?.visitas ?? null,
        },
      };
    });
  });
}

/** Lo que se cuenta de la red entera en la cabecera y en la portada. */
export type CuentaDeLaRed = {
  total: number;
  /** Con la última reunión dicha: con cifras o «no hubo». */
  reportados: number;
  sinReportar: number;
  noHubo: number;
  asistentes: number;
  visitas: number;
};

export function contarLaRed(lista: GrupoDeLaRed[]): CuentaDeLaRed {
  // Los que todavía no podían reportar no cuentan en ningún lado: ni como
  // reportados ni como pendientes.
  const cuentan = lista.filter((g) => g.reunion.estado !== 'sin_empezar');
  return {
    total: cuentan.length,
    reportados: cuentan.filter(
      (g) => g.reunion.estado === 'reportada' || g.reunion.estado === 'no_hubo',
    ).length,
    sinReportar: cuentan.filter((g) => g.reunion.estado === 'sin_reportar').length,
    noHubo: cuentan.filter((g) => g.reunion.estado === 'no_hubo').length,
    asistentes: cuentan.reduce((s, g) => s + (g.reunion.asistentes ?? 0), 0),
    visitas: cuentan.reduce((s, g) => s + (g.reunion.visitas ?? 0), 0),
  };
}

export type IntegranteDeGrupo = {
  filaId: string;
  miembroId: string;
  nombre: string;
  rol: RolGrupo;
  /** Para el líder y el auxiliar: si sigue en el equipo. Sin él no lleva nada. */
  enEquipo: boolean;
  desde: string | null;
};

export type GrupoDetalle = {
  id: string;
  ministerioId: string;
  nombre: string;
  zona: string | null;
  diaSemana: number;
  hora: string | null;
  codigo: string;
  alta: string;
  integrantes: IntegranteDeGrupo[];
};

const ORDEN_ROL: Record<RolGrupo, number> = { lider: 0, auxiliar: 1, participante: 2 };

/**
 * Un grupo abierto de esta red, con su gente.
 *
 * Lo que trae `integrantes` depende de quién pregunte, y lo decide la base: al
 * pastor, a la red y a quien lleva el grupo, todos; a un participante, él mismo
 * y quien lo lleva. Las pantallas que lo usan son de los primeros.
 */
export async function obtenerGrupo(
  ctx: UserContext,
  ministerioId: string,
  grupoId: string,
): Promise<GrupoDetalle | null> {
  return withUser(ctx.user.id, async (tx) => {
    const [g] = await tx
      .select({
        id: grupos.id,
        ministerioId: grupos.ministerioId,
        nombre: grupos.nombre,
        zona: grupos.zona,
        diaSemana: grupos.diaSemana,
        hora: grupos.hora,
        codigo: grupos.codigo,
        createdAt: grupos.createdAt,
      })
      .from(grupos)
      .where(
        and(
          eq(grupos.id, grupoId),
          eq(grupos.iglesiaId, ctx.iglesia.id),
          eq(grupos.ministerioId, ministerioId),
          eq(grupos.activo, true),
        ),
      )
      .limit(1);
    if (!g) return null;

    const [gente, equipo] = await Promise.all([
      tx
        .select({
          filaId: grupoMiembros.id,
          miembroId: grupoMiembros.miembroId,
          rol: grupoMiembros.rolGrupo,
          desde: grupoMiembros.desde,
          nombre: miembros.nombre,
          apellidos: miembros.apellidos,
        })
        .from(grupoMiembros)
        .innerJoin(miembros, eq(miembros.id, grupoMiembros.miembroId))
        .where(and(eq(grupoMiembros.grupoId, grupoId), eq(grupoMiembros.activo, true)))
        .orderBy(asc(miembros.nombre)),
      tx
        .select({ miembroId: ministerioMiembros.miembroId })
        .from(ministerioMiembros)
        .where(
          and(
            eq(ministerioMiembros.ministerioId, ministerioId),
            eq(ministerioMiembros.activo, true),
          ),
        ),
    ]);

    const enEquipo = new Set(equipo.map((e) => e.miembroId));

    return {
      id: g.id,
      ministerioId: g.ministerioId,
      nombre: g.nombre,
      zona: g.zona,
      diaSemana: g.diaSemana,
      hora: g.hora,
      codigo: g.codigo,
      alta: fechaEnLaIglesia(g.createdAt, ctx.iglesia.timezone),
      integrantes: gente
        .map((p) => ({
          filaId: p.filaId,
          miembroId: p.miembroId,
          nombre: nombreCompleto(p.nombre, p.apellidos),
          rol: p.rol,
          enEquipo: enEquipo.has(p.miembroId),
          desde: p.desde,
        }))
        .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol]),
    };
  });
}

/** Lo guardado de un grupo en estas semanas, por lunes. */
export async function semanasDelGrupo(
  ctx: UserContext,
  grupoId: string,
  desde: string,
  hasta: string,
): Promise<Map<string, SemanaGuardada>> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        semana: grupoSemanas.semana,
        estado: grupoSemanas.estado,
        tema: grupoSemanas.tema,
        asistentes: grupoSemanas.asistentes,
        visitas: grupoSemanas.visitas,
      })
      .from(grupoSemanas)
      .where(
        and(
          eq(grupoSemanas.iglesiaId, ctx.iglesia.id),
          eq(grupoSemanas.grupoId, grupoId),
          gte(grupoSemanas.semana, desde),
          lte(grupoSemanas.semana, hasta),
        ),
      ),
  );
  return new Map(filas.map((f) => [f.semana, f]));
}

/** La guía de la red en estas semanas, por lunes. */
export async function guiasDeLaRed(
  ctx: UserContext,
  ministerioId: string,
  desde: string,
  hasta: string,
): Promise<Map<string, string>> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ semana: grupoGuias.semana, tema: grupoGuias.tema })
      .from(grupoGuias)
      .where(
        and(
          eq(grupoGuias.iglesiaId, ctx.iglesia.id),
          eq(grupoGuias.ministerioId, ministerioId),
          gte(grupoGuias.semana, desde),
          lte(grupoGuias.semana, hasta),
        ),
      ),
  );
  return new Map(filas.map((f) => [f.semana, f.tema]));
}

export type MiGrupo = {
  grupoId: string;
  ministerioId: string;
  ministerioNombre: string;
  ministerioTipo: string;
  nombre: string;
  zona: string | null;
  diaSemana: number;
  hora: string | null;
  alta: string;
  rol: RolGrupo;
};

/**
 * Los grupos en los que está esta persona, con su papel en cada uno.
 *
 * Solo los abiertos y de ministerios activos: una célula de una red archivada
 * no le pide a nadie que reporte nada.
 */
export async function misGrupos(ctx: UserContext): Promise<MiGrupo[]> {
  if (!ctx.miembroId) return [];
  const miembroId = ctx.miembroId;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        grupoId: grupos.id,
        ministerioId: grupos.ministerioId,
        ministerioNombre: ministerios.nombre,
        ministerioTipo: ministerios.tipo,
        nombre: grupos.nombre,
        zona: grupos.zona,
        diaSemana: grupos.diaSemana,
        hora: grupos.hora,
        createdAt: grupos.createdAt,
        rol: grupoMiembros.rolGrupo,
      })
      .from(grupoMiembros)
      .innerJoin(grupos, eq(grupos.id, grupoMiembros.grupoId))
      .innerJoin(ministerios, eq(ministerios.id, grupos.ministerioId))
      .where(
        and(
          eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
          eq(grupoMiembros.miembroId, miembroId),
          eq(grupoMiembros.activo, true),
          eq(grupos.activo, true),
          eq(ministerios.activo, true),
        ),
      )
      .orderBy(asc(grupos.nombre)),
  );

  return filas.map(({ createdAt, ...f }) => ({
    ...f,
    alta: fechaEnLaIglesia(createdAt, ctx.iglesia.timezone),
  }));
}

/**
 * ¿Lleva esta persona este grupo desde la app?
 *
 * Lo mismo que `lleva_grupo()` en la base (`0047`): líder o auxiliar activo del
 * grupo Y en el equipo de su ministerio. `ctx.ministerioIds` es el equipo, ya
 * sin bajas ni ministerios apagados. Lo comprueban la guarda de las pantallas y
 * la de las actions; la base lo vuelve a decir por debajo.
 */
export async function llevaElGrupo(
  ctx: UserContext,
  ministerioId: string,
  grupoId: string,
): Promise<boolean> {
  if (!ctx.miembroId || !ctx.ministerioIds.includes(ministerioId)) return false;
  const miembroId = ctx.miembroId;

  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: grupoMiembros.id })
      .from(grupoMiembros)
      .innerJoin(grupos, eq(grupos.id, grupoMiembros.grupoId))
      .where(
        and(
          eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
          eq(grupoMiembros.ministerioId, ministerioId),
          eq(grupoMiembros.grupoId, grupoId),
          eq(grupoMiembros.miembroId, miembroId),
          eq(grupoMiembros.activo, true),
          inArray(grupoMiembros.rolGrupo, ['lider', 'auxiliar']),
          eq(grupos.activo, true),
        ),
      )
      .limit(1),
  );
  return Boolean(fila);
}

/**
 * Quién lleva un grupo, para quien va a él: nombre y papel, nada más.
 *
 * Es lo único de los demás que el participante ve, y la base no le deja ver
 * otra cosa (`grupo_miembros_select_relacion`).
 */
export async function quienLleva(
  ctx: UserContext,
  grupoId: string,
): Promise<{ nombre: string; rol: RolGrupo }[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
        rol: grupoMiembros.rolGrupo,
      })
      .from(grupoMiembros)
      .innerJoin(miembros, eq(miembros.id, grupoMiembros.miembroId))
      .where(
        and(
          eq(grupoMiembros.iglesiaId, ctx.iglesia.id),
          eq(grupoMiembros.grupoId, grupoId),
          eq(grupoMiembros.activo, true),
          ne(grupoMiembros.rolGrupo, 'participante'),
        ),
      ),
  );
  return filas
    .map((f) => ({ nombre: nombreCompleto(f.nombre, f.apellidos), rol: f.rol }))
    .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol]);
}

/**
 * Personas de la iglesia que se pueden sumar a este grupo como participantes.
 *
 * Fuera las que ya están en él y las que ya van a otra célula de la misma red
 * (`uq_grupo_participante_por_ministerio`): ofrecerlas sería ofrecer un error.
 * Las mismas reglas de fichas vivas que `candidatosParaMinisterio`, con su
 * tope de 300.
 */
export async function candidatosParaGrupo(
  ctx: UserContext,
  ministerioId: string,
  grupoId: string,
  busqueda?: string,
): Promise<{ id: string; nombre: string; estado: EstadoMiembro }[]> {
  return withUser(ctx.user.id, async (tx) => {
    const ocupados = await tx
      .select({ miembroId: grupoMiembros.miembroId })
      .from(grupoMiembros)
      .where(
        and(
          eq(grupoMiembros.ministerioId, ministerioId),
          eq(grupoMiembros.activo, true),
          or(
            eq(grupoMiembros.grupoId, grupoId),
            eq(grupoMiembros.rolGrupo, 'participante'),
          ),
        ),
      );
    const excluidos = [...new Set(ocupados.map((o) => o.miembroId))];

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
      .limit(300);

    return filas.map((f) => ({
      id: f.id,
      nombre: nombreCompleto(f.nombre, f.apellidos),
      estado: f.estado,
    }));
  });
}

/** El nombre de cada grupo, para la bandeja de solicitudes. Solo del pastor. */
export async function nombresDeGrupos(
  ctx: UserContext,
  ids: string[],
): Promise<Map<string, { nombre: string; activo: boolean; ministerio: string }>> {
  if (ids.length === 0) return new Map();
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: grupos.id,
        nombre: grupos.nombre,
        activo: grupos.activo,
        ministerio: ministerios.nombre,
      })
      .from(grupos)
      .innerJoin(ministerios, eq(ministerios.id, grupos.ministerioId))
      .where(and(eq(grupos.iglesiaId, ctx.iglesia.id), inArray(grupos.id, ids))),
  );
  return new Map(filas.map(({ id, ...f }) => [id, f]));
}
