import 'server-only';

import { and, asc, eq, isNull } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * A quién se le puede asignar un devocional.
 *
 * Toda la congregación viva, no solo quien tiene cuenta: el pastor puede
 * repartir el turno a alguien que aún no ha entrado nunca al panel, y ese día
 * queda apuntado en el calendario igual. Cuando esa persona reciba su acceso, se
 * lo encontrará esperando.
 *
 * Se excluyen las bajas y las fichas archivadas, que es lo que hace el resto del
 * producto.
 */
export async function listarMiembrosParaAutor(
  ctx: UserContext,
): Promise<{ id: string; nombre: string }[]> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: miembros.id,
        nombre: miembros.nombre,
        apellidos: miembros.apellidos,
      })
      .from(miembros)
      .where(
        and(
          eq(miembros.iglesiaId, ctx.iglesia.id),
          isNull(miembros.archivadoAt),
        ),
      )
      .orderBy(asc(miembros.nombre)),
  );

  return filas.map((f) => ({
    id: f.id,
    nombre: [f.nombre, f.apellidos].filter(Boolean).join(' '),
  }));
}
