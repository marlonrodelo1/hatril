import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { notificaciones } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import type { TipoNotificacion } from './emitir';

/**
 * Leer los avisos propios. Todo por `withUser`: las policies de la `0017` son
 * las que garantizan que nadie ve los de otro, y la aplicación entra por la
 * puerta estrecha como en el resto del repo.
 */

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  datos: Record<string, string>;
  enlace: string | null;
  leida: boolean;
  createdAt: Date;
};

/** Una pantalla. Sin paginar todavía; cuando alguien llegue al fondo se verá. */
const LIMITE = 40;

/**
 * Los avisos de una persona, de TODAS sus iglesias.
 *
 * Sin filtrar por congregación a propósito, y no es un descuido: el aviso más
 * importante que emite este producto —«tu solicitud no ha salido adelante»— va a
 * alguien que en ese mismo instante ha dejado de pertenecer a la iglesia, porque
 * al rechazar se le borra la membresía. Filtrando por `iglesia_id` con su
 * contexto, ese aviso no se le enseñaría nunca.
 *
 * Quien está en dos congregaciones las ve mezcladas, y por eso los textos de
 * `textos.ts` llevan el nombre de la iglesia dentro cuando importa.
 *
 * Toma solo el `authUserId` y no el contexto entero: quien lo mira puede no
 * tener contexto de iglesia ninguno.
 */
export async function listarNotificaciones(
  authUserId: string,
): Promise<Notificacion[]> {
  const filas = await withUser(authUserId, (tx) =>
    tx
      .select({
        id: notificaciones.id,
        tipo: notificaciones.tipo,
        datos: notificaciones.datos,
        enlace: notificaciones.enlace,
        leidaAt: notificaciones.leidaAt,
        createdAt: notificaciones.createdAt,
      })
      .from(notificaciones)
      .orderBy(desc(notificaciones.createdAt))
      .limit(LIMITE),
  );

  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    datos: f.datos ?? {},
    enlace: f.enlace,
    leida: f.leidaAt !== null,
    createdAt: f.createdAt,
  }));
}

/**
 * Cuántos sin leer, para el punto rojo.
 *
 * Se pide en CADA carga del panel, así que va contra el índice parcial de la
 * `0016` —el que solo indexa las filas con `leida_at is null`— y no cuenta la
 * tabla entera. Y se corta en 99: nadie necesita saber si tiene 240 o 260, y sin
 * el corte una cuenta abandonada haría un recuento cada vez más caro para
 * pintar un número que no cambia de significado.
 */
export async function sinLeer(ctx: UserContext): Promise<number> {
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.iglesiaId, ctx.iglesia.id),
          isNull(notificaciones.leidaAt),
        ),
      )
      .limit(1),
  );

  return Math.min(fila?.n ?? 0, 99);
}
