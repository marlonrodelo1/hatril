import 'server-only';

import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { withUser } from '@/lib/db/with-tenant';
import { arqueos, cajas, fondos, miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Las consultas del arqueo del culto. Todo por `withUser`, como el resto de la
 * caja (`consultas.ts` cuenta por qué ni una vez `dbAdmin`).
 *
 * Lo que se enseña de las dos personas es su nombre, y solo a quien lleva la
 * caja: es la misma categoría que «con quién lo registró», que ya declaran los
 * términos. Sin su ficha —la persona ejerció la supresión— sale sin nombre, y
 * el arqueo sigue valiendo: el uuid no tiene FK a propósito (`finanzas.ts`).
 */

export interface ArqueoListado {
  id: string;
  fecha: string;
  totalDiezmos: string;
  totalOfrendas: string;
  /** La suma, en SQL: los importes no se suman en JavaScript (`consultas.ts`). */
  total: string;
  fondoNombre: string | null;
  cajaNombre: string | null;
  contadoPorId: string;
  contadoPor: string | null;
  confirmadoPor: string | null;
  confirmadoAt: Date | null;
}

const contador = alias(miembros, 'contador');
const confirmador = alias(miembros, 'confirmador');

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/**
 * El arqueo con sus nombres: el fondo, la caja y las dos personas. Sin
 * `where`, que pone cada consulta.
 *
 * Las personas, con la iglesia en el `on`: el uuid no tiene FK, y que una ficha
 * de otra congregación tuviera ese id no puede poner aquí su nombre.
 */
function seleccion(tx: Tx) {
  return tx
    .select({
      id: arqueos.id,
      fecha: arqueos.fecha,
      totalDiezmos: arqueos.totalDiezmos,
      totalOfrendas: arqueos.totalOfrendas,
      total: sql<string>`(${arqueos.totalDiezmos} + ${arqueos.totalOfrendas})::text`,
      fondoNombre: fondos.nombre,
      cajaNombre: cajas.nombre,
      contadoPorId: arqueos.contadoPorMiembroId,
      contadoPor: contador.nombre,
      confirmadoPor: confirmador.nombre,
      confirmadoAt: arqueos.confirmadoAt,
    })
    .from(arqueos)
    .leftJoin(fondos, eq(fondos.id, arqueos.fondoId))
    .leftJoin(cajas, eq(cajas.id, arqueos.cajaId))
    .leftJoin(
      contador,
      and(
        eq(contador.id, arqueos.contadoPorMiembroId),
        eq(contador.iglesiaId, arqueos.iglesiaId),
      ),
    )
    .leftJoin(
      confirmador,
      and(
        eq(confirmador.id, arqueos.confirmadoPorMiembroId),
        eq(confirmador.iglesiaId, arqueos.iglesiaId),
      ),
    )
    .$dynamic();
}

/** Cuántos confirmados se pintan debajo. El libro tiene el resto. */
const RECIENTES = 20;

/**
 * Los que esperan confirmación —todos, son pocos: uno o dos por domingo— y los
 * últimos confirmados.
 */
export async function listarArqueos(ctx: UserContext): Promise<{
  pendientes: ArqueoListado[];
  confirmados: ArqueoListado[];
}> {
  return withUser(ctx.user.id, async (tx) => {
    const [pendientes, confirmados] = await Promise.all([
      seleccion(tx)
        .where(
          and(eq(arqueos.iglesiaId, ctx.iglesia.id), isNull(arqueos.confirmadoAt)),
        )
        .orderBy(asc(arqueos.fecha), asc(arqueos.createdAt)),
      seleccion(tx)
        .where(
          and(
            eq(arqueos.iglesiaId, ctx.iglesia.id),
            isNotNull(arqueos.confirmadoAt),
          ),
        )
        .orderBy(desc(arqueos.fecha), desc(arqueos.confirmadoAt))
        .limit(RECIENTES),
    ]);

    return { pendientes, confirmados };
  });
}

/** Para el aviso de la pantalla de Finanzas: «1 arqueo espera confirmación». */
export async function contarArqueosPendientes(ctx: UserContext): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ n: count() })
      .from(arqueos)
      .where(
        and(eq(arqueos.iglesiaId, ctx.iglesia.id), isNull(arqueos.confirmadoAt)),
      ),
  );
  return fila?.n ?? 0;
}

/**
 * El arqueo del que sale un ingreso, para su ficha en el libro: quién lo contó
 * y quién lo confirmó. `null` si el arqueo no es de esta iglesia, que HT129 ya
 * impide.
 */
export async function arqueoDeUnIngreso(
  ctx: UserContext,
  arqueoId: string,
): Promise<ArqueoListado | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    seleccion(tx)
      .where(and(eq(arqueos.id, arqueoId), eq(arqueos.iglesiaId, ctx.iglesia.id)))
      .limit(1),
  );
  return filas[0] ?? null;
}
