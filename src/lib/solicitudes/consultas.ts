import 'server-only';

import { and, asc, count, eq } from 'drizzle-orm';

import { withUser, dbAdmin } from '@/lib/db';
import { iglesias, solicitudesIngreso } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

export type SolicitudPendiente = {
  id: string;
  authUserId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  createdAt: Date;
};

export async function listarSolicitudesPendientes(
  ctx: UserContext,
): Promise<SolicitudPendiente[]> {
  return withUser(ctx.user.id, (tx) =>
    tx
      .select({
        id: solicitudesIngreso.id,
        authUserId: solicitudesIngreso.authUserId,
        nombre: solicitudesIngreso.nombre,
        email: solicitudesIngreso.email,
        telefono: solicitudesIngreso.telefono,
        mensaje: solicitudesIngreso.mensaje,
        createdAt: solicitudesIngreso.createdAt,
      })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      )
      // Las más antiguas primero: lo que no se quiere es que alguien lleve tres
      // semanas esperando mientras se atienden las de ayer.
      .orderBy(asc(solicitudesIngreso.createdAt)),
  );
}

/**
 * Cuántas hay sin revisar. Alimenta el contador del menú.
 *
 * Se ejecuta en CADA render del panel, así que es una consulta de un solo
 * número sobre un índice `(iglesia_id, estado)`.
 */
export async function contarSolicitudesPendientes(
  ctx: UserContext,
): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ total: count() })
      .from(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.iglesiaId, ctx.iglesia.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      ),
  );

  return Number(fila?.total ?? 0);
}

/**
 * La solicitud viva de una persona, con el nombre de la iglesia.
 *
 * Para la pantalla de «tu solicitud está en revisión». Va por `dbAdmin` porque
 * quien pregunta todavía no pertenece a ninguna iglesia: con `withUser`, la
 * policy `solicitudes_select_propia` sí la dejaría ver su fila, pero el JOIN
 * con `iglesias` no devolvería nada —`hatril_app` solo ve iglesias a las que
 * pertenece o que están en el directorio—, y la pantalla saldría sin nombre.
 *
 * Se filtra por `auth_user_id`, así que solo devuelve lo suyo.
 */
export async function solicitudDeUsuario(authUserId: string) {
  const filas = await dbAdmin
    .select({
      id: solicitudesIngreso.id,
      estado: solicitudesIngreso.estado,
      motivoRechazo: solicitudesIngreso.motivoRechazo,
      createdAt: solicitudesIngreso.createdAt,
      iglesiaNombre: iglesias.nombre,
      iglesiaSlug: iglesias.slug,
      iglesiaCiudad: iglesias.ciudad,
    })
    .from(solicitudesIngreso)
    .innerJoin(iglesias, eq(iglesias.id, solicitudesIngreso.iglesiaId))
    .where(eq(solicitudesIngreso.authUserId, authUserId))
    .orderBy(asc(solicitudesIngreso.createdAt))
    .limit(1);

  return filas[0] ?? null;
}
