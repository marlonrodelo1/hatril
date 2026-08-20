import 'server-only';

import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db/with-tenant';
import { miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Cuánta gente cuenta para el plan.
 *
 * QUÉ CUENTA, Y POR QUÉ ESO
 * -------------------------
 * Fichas **vivas**, sin archivar y sin las dadas de baja. Quien se fue de la
 * congregación no ocupa plaza: cobrar por él haría que el número de la factura
 * no cuadre con el que el pastor ve en su panel, y esa discrepancia es la clase
 * de cosa que acaba en una reclamación por algo que en realidad funciona bien.
 *
 * Consulta propia y no `resumenCongregacion()` (`src/lib/panel/inicio.ts:48`),
 * que además lanza el recuento de quién sirve y las altas del mes: dos viajes a
 * Irlanda de más para pintar un número.
 */
export async function miembrosQueCuentan(ctx: UserContext): Promise<number> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ total: sql<number>`count(*)` })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
          ne(miembros.estado, 'baja'),
        ),
      ),
  );

  return Number(filas[0]?.total ?? 0);
}

/**
 * ¿Se le ha quedado pequeño el plan?
 *
 * Devuelve `null` cuando no hay tope (plan Plus) o cuando aún cabe. El número
 * sale de `PLANES` en `src/lib/stripe/client.ts`, que es donde vive el catálogo.
 *
 * Esto **avisa**, no bloquea. Impedir dar de alta a la persona 401 castigaría a
 * la secretaria por una decisión de precio que no es suya, y le rompería el
 * trabajo del domingo. La conversación de subir de plan es con el pastor, y va
 * donde él la ve.
 */
export function excesoDeMiembros(
  cuentan: number,
  limite: number | null,
): { sobran: number; limite: number } | null {
  if (limite === null || cuentan <= limite) return null;
  return { sobran: cuentan - limite, limite };
}
