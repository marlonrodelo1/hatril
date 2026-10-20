import 'server-only';

import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, max } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import {
  repartoBeneficiarios,
  repartoEntregas,
  repartoJornadas,
} from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Consultas del reparto.
 *
 * Por `withUser` como todo, y aquí además la RLS es por EQUIPO (`0042`): quien
 * no sirve en este ministerio ni es pastor recibe cero filas aunque se
 * equivoque el guard. El filtro por iglesia y ministerio de cada consulta no es
 * la seguridad —eso es la policy—, es para que el pastor, que ve los repartos
 * de todos los equipos, lea solo el que tiene delante.
 *
 * Los recuentos agregados van en consultas aparte y no en subconsultas por
 * fila: una columna interpolada en un `sql` de Drizzle sale sin cualificar (la
 * trampa de `listarReuniones` en ESTADO.md).
 */

export type Jornada = { id: string; fecha: string; sinInscribir: number };

/** El reparto de un día, o null si ese día no se empezó. */
export async function jornadaDelDia(
  ctx: UserContext,
  ministerioId: string,
  fecha: string,
): Promise<Jornada | null> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: repartoJornadas.id,
        fecha: repartoJornadas.fecha,
        sinInscribir: repartoJornadas.sinInscribir,
      })
      .from(repartoJornadas)
      .where(
        and(
          eq(repartoJornadas.iglesiaId, ctx.iglesia.id),
          eq(repartoJornadas.ministerioId, ministerioId),
          eq(repartoJornadas.fecha, fecha),
        ),
      )
      .limit(1),
  );
  return fila ?? null;
}

/** Cuántos hogares hay en el padrón sin dar de baja. */
export async function contarInscritos(
  ctx: UserContext,
  ministerioId: string,
): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ n: count() })
      .from(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
          isNull(repartoBeneficiarios.bajaAt),
        ),
      ),
  );
  return fila?.n ?? 0;
}

export type EnLaPuerta = {
  entregaId: string;
  beneficiarioId: string | null;
  numero: number | null;
  nombre: string | null;
  personasHogar: number;
  entregado: boolean;
  llegoAt: Date;
  entregadoAt: Date | null;
};

/**
 * Quién ha venido a este reparto, por orden de llegada.
 *
 * Una fila sin persona (`beneficiarioId` null) es alguien a quien se borró del
 * padrón después de entregarle: se sigue contando, sin nombre.
 */
export async function quienHaVenido(
  ctx: UserContext,
  jornadaId: string,
): Promise<EnLaPuerta[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        entregaId: repartoEntregas.id,
        beneficiarioId: repartoEntregas.beneficiarioId,
        numero: repartoBeneficiarios.numero,
        nombre: repartoBeneficiarios.nombre,
        personasHogar: repartoEntregas.personasHogar,
        entregado: repartoEntregas.entregado,
        llegoAt: repartoEntregas.createdAt,
        entregadoAt: repartoEntregas.entregadoAt,
      })
      .from(repartoEntregas)
      .leftJoin(
        repartoBeneficiarios,
        eq(repartoBeneficiarios.id, repartoEntregas.beneficiarioId),
      )
      .where(
        and(
          eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
          eq(repartoEntregas.jornadaId, jornadaId),
        ),
      )
      .orderBy(asc(repartoEntregas.createdAt)),
  );
}

export type Encontrado = {
  id: string;
  numero: number;
  nombre: string;
  personasHogar: number;
  deBaja: boolean;
};

/**
 * Buscar en la puerta: por número si son solo cifras (con o sin «#»), y si no,
 * por un trozo del nombre. Las bajas salen también, marcadas: quien se mudó y
 * vuelve no tiene por qué apuntarse otra vez con otro número.
 */
export async function buscarEnElPadron(
  ctx: UserContext,
  ministerioId: string,
  texto: string,
): Promise<Encontrado[]> {
  const limpio = texto.trim().replace(/^#/, '');
  if (!limpio) return [];
  const numero = /^\d{1,6}$/.test(limpio) ? Number(limpio) : null;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: repartoBeneficiarios.id,
        numero: repartoBeneficiarios.numero,
        nombre: repartoBeneficiarios.nombre,
        personasHogar: repartoBeneficiarios.personasHogar,
        bajaAt: repartoBeneficiarios.bajaAt,
      })
      .from(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
          numero !== null
            ? eq(repartoBeneficiarios.numero, numero)
            : ilike(repartoBeneficiarios.nombre, `%${escaparLike(limpio)}%`),
        ),
      )
      .orderBy(asc(repartoBeneficiarios.numero))
      .limit(20),
  );

  return filas.map(({ bajaAt, ...f }) => ({ ...f, deBaja: bajaAt !== null }));
}

/** Un `%` o un `_` escritos en el buscador son letras, no comodines. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type EnElPadron = {
  id: string;
  numero: number;
  nombre: string;
  personasHogar: number;
  telefono: string | null;
  bajaAt: Date | null;
  /** El último reparto al que vino, o null si todavía no ha venido. */
  ultimaVez: string | null;
  veces: number;
};

/** El padrón, por número. */
export async function listarPadron(
  ctx: UserContext,
  ministerioId: string,
  opciones: { busqueda?: string; bajas?: boolean },
): Promise<EnElPadron[]> {
  const { busqueda, bajas = false } = opciones;

  return withUser(ctx.user.id, async (tx) => {
    const filas = await tx
      .select({
        id: repartoBeneficiarios.id,
        numero: repartoBeneficiarios.numero,
        nombre: repartoBeneficiarios.nombre,
        personasHogar: repartoBeneficiarios.personasHogar,
        telefono: repartoBeneficiarios.telefono,
        bajaAt: repartoBeneficiarios.bajaAt,
      })
      .from(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
          bajas
            ? isNotNull(repartoBeneficiarios.bajaAt)
            : isNull(repartoBeneficiarios.bajaAt),
          busqueda
            ? /^#?\d{1,6}$/.test(busqueda)
              ? eq(repartoBeneficiarios.numero, Number(busqueda.replace('#', '')))
              : ilike(repartoBeneficiarios.nombre, `%${escaparLike(busqueda)}%`)
            : undefined,
        ),
      )
      .orderBy(asc(repartoBeneficiarios.numero));

    if (filas.length === 0) return [];

    const visitas = await tx
      .select({
        beneficiarioId: repartoEntregas.beneficiarioId,
        ultimaVez: max(repartoJornadas.fecha),
        veces: count(),
      })
      .from(repartoEntregas)
      .innerJoin(repartoJornadas, eq(repartoJornadas.id, repartoEntregas.jornadaId))
      .where(
        and(
          eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
          inArray(
            repartoEntregas.beneficiarioId,
            filas.map((f) => f.id),
          ),
        ),
      )
      .groupBy(repartoEntregas.beneficiarioId);

    const porId = new Map(visitas.map((v) => [v.beneficiarioId, v]));
    return filas.map((f) => ({
      ...f,
      ultimaVez: porId.get(f.id)?.ultimaVez ?? null,
      veces: porId.get(f.id)?.veces ?? 0,
    }));
  });
}

export type FichaDelPadron = EnElPadron & {
  consentimientoVersion: string;
  consentimientoAt: Date;
  createdAt: Date;
};

/** Una persona del padrón, o null si no es de este equipo. */
export async function obtenerBeneficiario(
  ctx: UserContext,
  ministerioId: string,
  beneficiarioId: string,
): Promise<FichaDelPadron | null> {
  return withUser(ctx.user.id, async (tx) => {
    const [fila] = await tx
      .select({
        id: repartoBeneficiarios.id,
        numero: repartoBeneficiarios.numero,
        nombre: repartoBeneficiarios.nombre,
        personasHogar: repartoBeneficiarios.personasHogar,
        telefono: repartoBeneficiarios.telefono,
        bajaAt: repartoBeneficiarios.bajaAt,
        consentimientoVersion: repartoBeneficiarios.consentimientoVersion,
        consentimientoAt: repartoBeneficiarios.consentimientoAt,
        createdAt: repartoBeneficiarios.createdAt,
      })
      .from(repartoBeneficiarios)
      .where(
        and(
          eq(repartoBeneficiarios.id, beneficiarioId),
          eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
          eq(repartoBeneficiarios.ministerioId, ministerioId),
        ),
      )
      .limit(1);

    if (!fila) return null;

    const [visitas] = await tx
      .select({ ultimaVez: max(repartoJornadas.fecha), veces: count() })
      .from(repartoEntregas)
      .innerJoin(repartoJornadas, eq(repartoJornadas.id, repartoEntregas.jornadaId))
      .where(
        and(
          eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
          eq(repartoEntregas.beneficiarioId, beneficiarioId),
        ),
      );

    return {
      ...fila,
      ultimaVez: visitas?.ultimaVez ?? null,
      veces: visitas?.veces ?? 0,
    };
  });
}

/**
 * Quién lleva más de un año sin venir: su último reparto es anterior a `corte`,
 * o no ha venido nunca y se apuntó antes de esa fecha.
 *
 * Es lo que el aviso de la puerta promete («si pasa un año sin que vengas, lo
 * borramos») y lo que el padrón ofrece borrar de una vez. No hay ninguna tarea
 * automática que lo haga: como las listas de los eventos, lo cumple un botón.
 *
 * Devuelve ids y no un número para que borrar use EXACTAMENTE la lista que la
 * pantalla contó, en la misma transacción que el borrado.
 */
export async function sinVenirDesde(
  ctx: UserContext,
  ministerioId: string,
  corte: string,
): Promise<string[]> {
  return withUser(ctx.user.id, (tx) => idsSinVenirDesde(tx, ctx, ministerioId, corte));
}

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/** Lo mismo, dentro de una transacción abierta (para el borrado). */
export async function idsSinVenirDesde(
  tx: Tx,
  ctx: UserContext,
  ministerioId: string,
  corte: string,
): Promise<string[]> {
  const todos = await tx
    .select({ id: repartoBeneficiarios.id, createdAt: repartoBeneficiarios.createdAt })
    .from(repartoBeneficiarios)
    .where(
      and(
        eq(repartoBeneficiarios.iglesiaId, ctx.iglesia.id),
        eq(repartoBeneficiarios.ministerioId, ministerioId),
      ),
    );
  if (todos.length === 0) return [];

  const ultimas = await tx
    .select({ beneficiarioId: repartoEntregas.beneficiarioId, ultima: max(repartoJornadas.fecha) })
    .from(repartoEntregas)
    .innerJoin(repartoJornadas, eq(repartoJornadas.id, repartoEntregas.jornadaId))
    .where(
      and(
        eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
        eq(repartoEntregas.ministerioId, ministerioId),
        isNotNull(repartoEntregas.beneficiarioId),
      ),
    )
    .groupBy(repartoEntregas.beneficiarioId);

  const ultimaDe = new Map(ultimas.map((u) => [u.beneficiarioId, u.ultima]));

  return todos
    .filter((b) => {
      const ultima = ultimaDe.get(b.id);
      // Las fechas `date` llegan como `YYYY-MM-DD` y se comparan como cadenas.
      // El alta es un instante: se compara su día en UTC, que como mucho
      // adelanta o retrasa un día un plazo de un año.
      return ultima ? ultima < corte : b.createdAt.toISOString().slice(0, 10) < corte;
    })
    .map((b) => b.id);
}

export type DiaDelHistorial = {
  jornadaId: string;
  fecha: string;
  vinieron: number;
  entregados: number;
  sinInscribir: number;
  /** Suma de las personas de los hogares a los que se entregó. */
  personas: number;
};

export type Historial = {
  dias: DiaDelHistorial[];
  total: {
    repartos: number;
    /** Entregas hechas, contando las de quien no quiso apuntarse. */
    entregas: number;
    sinInscribir: number;
    /** Hogares distintos con número. Quien no se apuntó no se puede contar dos veces ni una. */
    hogares: number;
    /** Personas de esos hogares, cada hogar una vez. */
    personas: number;
  };
};

/**
 * El historial de un mes: una fila por reparto y el total, que es lo que pide
 * el pastor o el banco de alimentos.
 *
 * Se agrega aquí y no en SQL. Un mes son unos pocos repartos y unos cientos de
 * filas, y contar los hogares distintos con su tamaño necesita mirar a la vez
 * qué persona es y cuántas había en su casa ESE día. Las filas cuya persona se
 * borró del padrón cuentan como entrega y como personas del día, y no como
 * hogar del mes: sin saber quién era, no se sabe si ya se contó.
 */
export async function historialDelMes(
  ctx: UserContext,
  ministerioId: string,
  desde: string,
  hasta: string,
): Promise<Historial> {
  return withUser(ctx.user.id, async (tx) => {
    const jornadas = await tx
      .select({
        id: repartoJornadas.id,
        fecha: repartoJornadas.fecha,
        sinInscribir: repartoJornadas.sinInscribir,
      })
      .from(repartoJornadas)
      .where(
        and(
          eq(repartoJornadas.iglesiaId, ctx.iglesia.id),
          eq(repartoJornadas.ministerioId, ministerioId),
          gte(repartoJornadas.fecha, desde),
          lte(repartoJornadas.fecha, hasta),
        ),
      )
      .orderBy(desc(repartoJornadas.fecha));

    const vacio: Historial = {
      dias: [],
      total: { repartos: 0, entregas: 0, sinInscribir: 0, hogares: 0, personas: 0 },
    };
    if (jornadas.length === 0) return vacio;

    const entregas = await tx
      .select({
        jornadaId: repartoEntregas.jornadaId,
        beneficiarioId: repartoEntregas.beneficiarioId,
        personasHogar: repartoEntregas.personasHogar,
        entregado: repartoEntregas.entregado,
      })
      .from(repartoEntregas)
      .where(
        and(
          eq(repartoEntregas.iglesiaId, ctx.iglesia.id),
          inArray(
            repartoEntregas.jornadaId,
            jornadas.map((j) => j.id),
          ),
        ),
      );

    const hogares = new Map<string, number>();
    const dias = jornadas.map((j) => {
      const deEse = entregas.filter((e) => e.jornadaId === j.id);
      const hechas = deEse.filter((e) => e.entregado);
      for (const e of hechas) {
        if (!e.beneficiarioId) continue;
        // Si el hogar cambió de tamaño a lo largo del mes, cuenta el mayor.
        hogares.set(e.beneficiarioId, Math.max(hogares.get(e.beneficiarioId) ?? 0, e.personasHogar));
      }
      return {
        jornadaId: j.id,
        fecha: j.fecha,
        vinieron: deEse.length + j.sinInscribir,
        entregados: hechas.length + j.sinInscribir,
        sinInscribir: j.sinInscribir,
        personas: hechas.reduce((s, e) => s + e.personasHogar, 0),
      };
    });

    const sinInscribir = dias.reduce((s, d) => s + d.sinInscribir, 0);
    return {
      dias,
      total: {
        repartos: dias.length,
        entregas: dias.reduce((s, d) => s + d.entregados, 0),
        sinInscribir,
        hogares: hogares.size,
        personas: [...hogares.values()].reduce((s, n) => s + n, 0),
      },
    };
  });
}
