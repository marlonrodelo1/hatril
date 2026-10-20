import 'server-only';

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db/with-tenant';
import { fondos, movimientos } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Lo que ve de la caja quien lleva un ministerio: su fondo, y nada más.
 *
 * EL `WHERE` ES LA ÚNICA BARRERA DENTRO DE LA IGLESIA
 * ---------------------------------------------------
 * La RLS de `movimientos` (`0020`) es por iglesia: cualquiera de la
 * congregación que alcance una consulta por `withUser` lee el libro entero. Lo
 * que separa el fondo de Alimentos del resto de la caja es que cada consulta de
 * este fichero sale de `fondos.ministerio_id` y filtra por ESE fondo. Por eso
 * vive aparte de `consultas.ts`, que es la caja entera y la usa quien la lleva:
 * aquí no hay una sola función que no reciba el ministerio.
 *
 * Y la guarda va antes: `puedeVerFondoDe` en la página y en la portada.
 *
 * LOS INGRESOS, SOLO EN TOTAL
 * ---------------------------
 * En una iglesia pequeña, «500.000 para alimentos el martes» dice quién lo dio.
 * El líder ve cuánto entró en el mes, nunca qué entró, cuándo ni con qué
 * concepto. Los gastos sí van uno a uno: es lo que necesita para saber en qué
 * se ha ido su dinero, y es él quien entrega los tiques.
 */

/** Cuántos gastos se pintan de un mes. Uno de reparto semanal pasa poco de diez. */
export const TOPE_GASTOS_DEL_FONDO = 200;

export interface GastoDelFondo {
  id: string;
  fecha: string;
  concepto: string;
  importe: string;
}

export interface CuentasDelFondo {
  fondo: { id: string; nombre: string };
  /** Todo el histórico, como `saldosPorFondo`: «cuánto hay», no «cuánto se movió». */
  saldo: string;
  entro: string;
  salio: string;
  gastos: GastoDelFondo[];
  /** Los del mes, aunque no se pinten todos. */
  totalGastos: number;
}

/**
 * Las cuentas del fondo vinculado a este ministerio en un rango, o `null` si no
 * tiene ninguno vivo.
 *
 * Tres consultas en la misma transacción: el fondo, las sumas en una pasada con
 * `filter` —en SQL, nunca en JavaScript (ver `consultas.ts`)— y los gastos.
 */
export async function cuentasDelFondo(
  ctx: UserContext,
  ministerioId: string,
  desde: string,
  hasta: string,
): Promise<CuentasDelFondo | null> {
  return withUser(ctx.user.id, async (tx) => {
    const [fondo] = await tx
      .select({ id: fondos.id, nombre: fondos.nombre })
      .from(fondos)
      .where(
        and(
          eq(fondos.ministerioId, ministerioId),
          eq(fondos.iglesiaId, ctx.iglesia.id),
          eq(fondos.activo, true),
        ),
      )
      .limit(1);

    if (!fondo) return null;

    const delFondo = and(
      eq(movimientos.iglesiaId, ctx.iglesia.id),
      eq(movimientos.fondoId, fondo.id),
    );

    const [sumas] = await tx
      .select({
        saldo: sql<string>`coalesce(sum(${movimientos.importeConSigno}), 0)::text`,
        entro: sql<string>`coalesce(sum(${movimientos.importe}) filter (where ${movimientos.tipo} = 'ingreso' and ${movimientos.fecha} between ${desde} and ${hasta}), 0)::text`,
        salio: sql<string>`coalesce(sum(${movimientos.importe}) filter (where ${movimientos.tipo} = 'gasto' and ${movimientos.fecha} between ${desde} and ${hasta}), 0)::text`,
        totalGastos: sql<number>`(count(*) filter (where ${movimientos.tipo} = 'gasto' and ${movimientos.fecha} between ${desde} and ${hasta}))::int`,
      })
      .from(movimientos)
      .where(delFondo);

    const gastos = await tx
      .select({
        id: movimientos.id,
        fecha: movimientos.fecha,
        concepto: movimientos.concepto,
        importe: movimientos.importe,
      })
      .from(movimientos)
      .where(
        and(
          delFondo,
          eq(movimientos.tipo, 'gasto'),
          gte(movimientos.fecha, desde),
          lte(movimientos.fecha, hasta),
        ),
      )
      .orderBy(desc(movimientos.fecha), desc(movimientos.id))
      .limit(TOPE_GASTOS_DEL_FONDO);

    return {
      fondo,
      saldo: sumas?.saldo ?? '0',
      entro: sumas?.entro ?? '0',
      salio: sumas?.salio ?? '0',
      gastos,
      totalGastos: sumas?.totalGastos ?? 0,
    };
  });
}
