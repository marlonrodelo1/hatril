import 'server-only';

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db/with-tenant';
import { cajas, fondos, movimientos } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Las consultas de la caja.
 *
 * TODO PASA POR `withUser`. Nada de `dbAdmin` aquí dentro, ni una vez: `dbAdmin`
 * salta la RLS, y en finanzas eso significa que un fallo de `where` deja de ser
 * un listado raro y pasa a ser el libro de otra congregación. La única excepción
 * admisible en el futuro será el cron de purga por plazos de conservación, y
 * tendrá que decirlo en un comentario para que nadie amplíe la excepción.
 *
 * LOS TOTALES SE SUMAN EN SQL
 * ---------------------------
 * Nunca en JavaScript. Los importes salen de Postgres como cadena a propósito
 * (ver `src/lib/format/dinero.ts`) y convertirlos a `number` para sumarlos es
 * cómo aparecen los descuadres de un céntimo. `sum()` sobre `numeric` es
 * decimal exacto.
 */

export interface Saldo {
  id: string;
  nombre: string;
  saldo: string;
}

export interface ResumenMes {
  entro: string;
  salio: string;
  neto: string;
  etiqueta: string;
  desde: string;
  hasta: string;
}

export interface MovimientoListado {
  id: string;
  tipo: 'ingreso' | 'gasto';
  fecha: string;
  importe: string;
  importeConSigno: string;
  concepto: string;
  fondoNombre: string | null;
  cajaNombre: string | null;
  metodoPago: string;
  tipoIngreso: string | null;
}

/**
 * Cuánto entró y cuánto salió en un rango.
 *
 * Una sola pasada con `filter`, no dos consultas: es el número que va en
 * `/panel/hoy`, y ahí se paga en cada carga del panel de quien tiene el permiso.
 *
 * `coalesce` porque `sum()` sobre cero filas devuelve NULL, no cero — una
 * iglesia que activa finanzas y todavía no ha apuntado nada vería «—» donde
 * debería ver «$ 0».
 */
export async function resumen(
  ctx: UserContext,
  desde: string,
  hasta: string,
  etiqueta: string,
): Promise<ResumenMes> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        entro: sql<string>`coalesce(sum(${movimientos.importe}) filter (where ${movimientos.tipo} = 'ingreso'), 0)::text`,
        salio: sql<string>`coalesce(sum(${movimientos.importe}) filter (where ${movimientos.tipo} = 'gasto'), 0)::text`,
        neto: sql<string>`coalesce(sum(${movimientos.importeConSigno}), 0)::text`,
      })
      .from(movimientos)
      .where(
        and(
          eq(movimientos.iglesiaId, ctx.iglesia.id),
          gte(movimientos.fecha, desde),
          lte(movimientos.fecha, hasta),
        ),
      ),
  );

  const f = filas[0];
  return {
    entro: f?.entro ?? '0',
    salio: f?.salio ?? '0',
    neto: f?.neto ?? '0',
    etiqueta,
    desde,
    hasta,
  };
}

/**
 * Saldo por fondo, con TODO el histórico.
 *
 * Sin rango de fechas a propósito, y es la diferencia que más confunde: el
 * resumen de arriba contesta «cuánto se movió este mes» y esto contesta «cuánto
 * hay». Un fondo de construcción con 28 millones acumulados en dos años enseña
 * 28, no lo que entró en agosto.
 *
 * `left join` para que un fondo recién creado salga con saldo cero en vez de
 * desaparecer del listado, que es lo que haría dudar de si se guardó.
 */
export async function saldosPorFondo(ctx: UserContext): Promise<Saldo[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: fondos.id,
        nombre: fondos.nombre,
        saldo: sql<string>`coalesce(sum(${movimientos.importeConSigno}), 0)::text`,
      })
      .from(fondos)
      .leftJoin(movimientos, eq(movimientos.fondoId, fondos.id))
      .where(and(eq(fondos.iglesiaId, ctx.iglesia.id), eq(fondos.activo, true)))
      .groupBy(fondos.id, fondos.nombre, fondos.orden)
      .orderBy(asc(fondos.orden), asc(fondos.nombre)),
  );
}

/** Lo mismo por caja: dónde está el dinero, no de quién es. */
export async function saldosPorCaja(ctx: UserContext): Promise<Saldo[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: cajas.id,
        nombre: cajas.nombre,
        saldo: sql<string>`coalesce(sum(${movimientos.importeConSigno}), 0)::text`,
      })
      .from(cajas)
      .leftJoin(movimientos, eq(movimientos.cajaId, cajas.id))
      .where(and(eq(cajas.iglesiaId, ctx.iglesia.id), eq(cajas.activo, true)))
      .groupBy(cajas.id, cajas.nombre)
      .orderBy(asc(cajas.nombre)),
  );
}

/** El libro, con los últimos arriba. */
export async function libro(
  ctx: UserContext,
  filtros: { desde?: string; hasta?: string; fondoId?: string } = {},
  limite = 50,
): Promise<MovimientoListado[]> {
  const condiciones = [eq(movimientos.iglesiaId, ctx.iglesia.id)];
  if (filtros.desde) condiciones.push(gte(movimientos.fecha, filtros.desde));
  if (filtros.hasta) condiciones.push(lte(movimientos.fecha, filtros.hasta));
  if (filtros.fondoId) condiciones.push(eq(movimientos.fondoId, filtros.fondoId));

  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: movimientos.id,
        tipo: movimientos.tipo,
        fecha: movimientos.fecha,
        importe: movimientos.importe,
        importeConSigno: movimientos.importeConSigno,
        concepto: movimientos.concepto,
        fondoNombre: fondos.nombre,
        cajaNombre: cajas.nombre,
        metodoPago: movimientos.metodoPago,
        tipoIngreso: movimientos.tipoIngreso,
      })
      .from(movimientos)
      .leftJoin(fondos, eq(fondos.id, movimientos.fondoId))
      .leftJoin(cajas, eq(cajas.id, movimientos.cajaId))
      .where(and(...condiciones))
      // `id` de desempate: dos movimientos del mismo día sin él salen en orden
      // arbitrario y la lista «baila» entre recargas.
      .orderBy(desc(movimientos.fecha), desc(movimientos.id))
      .limit(limite),
  ) as Promise<MovimientoListado[]>;
}

/** Un movimiento concreto, para su ficha. */
export async function movimiento(ctx: UserContext, id: string) {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select()
      .from(movimientos)
      .where(
        and(eq(movimientos.id, id), eq(movimientos.iglesiaId, ctx.iglesia.id)),
      )
      .limit(1),
  );
  return filas[0] ?? null;
}

/** Los fondos y cajas activos, para los desplegables del formulario. */
export async function opciones(ctx: UserContext) {
  return withUser(ctx.user.id, async (tx) => {
    const [listaFondos, listaCajas] = await Promise.all([
      tx
        .select({
          id: fondos.id,
          nombre: fondos.nombre,
          esGeneral: fondos.esGeneral,
        })
        .from(fondos)
        .where(
          and(eq(fondos.iglesiaId, ctx.iglesia.id), eq(fondos.activo, true)),
        )
        .orderBy(asc(fondos.orden), asc(fondos.nombre)),
      tx
        .select({ id: cajas.id, nombre: cajas.nombre, tipo: cajas.tipo })
        .from(cajas)
        .where(
          and(eq(cajas.iglesiaId, ctx.iglesia.id), eq(cajas.activo, true)),
        )
        .orderBy(asc(cajas.nombre)),
    ]);
    return { fondos: listaFondos, cajas: listaCajas };
  });
}

/**
 * ¿Ha activado ya las finanzas esta iglesia?
 *
 * Sin fondo ni caja, el formulario de alta no se puede enviar —los dos son
 * `notNull`—, así que la primera pantalla tiene que ser la de activar y no un
 * formulario roto. Se pregunta por la existencia de un fondo, que es lo que
 * siembra la activación.
 */
export async function estaActivado(ctx: UserContext): Promise<boolean> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ id: fondos.id })
      .from(fondos)
      .where(eq(fondos.iglesiaId, ctx.iglesia.id))
      .limit(1),
  );
  return filas.length > 0;
}
