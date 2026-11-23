import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Entrar en una célula con su enlace, y salir de ella, por quien ya es de la
 * iglesia (23-nov).
 *
 * Lo hacen dos funciones de la base, `unirse_a_grupo` y `salir_de_grupo`
 * (`security definer`, solo para `hatril_app`): `grupo_miembros` solo la
 * escriben el pastor y quien lleva la red, y la llave aquí es el código del
 * enlace, que una policy no puede ver. Las reglas y su porqué, en la cabecera
 * de su migración. Aquí solo se llaman con la sesión de quien pulsa.
 */

/** Lo que contesta `unirse_a_grupo`. */
export type ResultadoDeUnirse = 'dentro' | 'ya_estaba' | 'otra' | 'no_vale';

type Fila = Record<string, unknown>;
const primera = (filas: unknown): Fila | undefined =>
  (filas as { rows?: Fila[] }).rows?.[0] ?? (filas as Fila[])[0];

export async function unirseConElCodigo(ctx: UserContext, codigo: string): Promise<ResultadoDeUnirse> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx.execute(sql`select public.unirse_a_grupo(${codigo}) as resultado`),
  );
  const r = primera(filas)?.resultado;
  return r === 'dentro' || r === 'ya_estaba' || r === 'otra' ? r : 'no_vale';
}

/** `true` si salió; `false` si no iba a esa célula como participante. */
export async function salirDelGrupo(ctx: UserContext, grupoId: string): Promise<boolean> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx.execute(sql`select public.salir_de_grupo(${grupoId}::uuid) as salio`),
  );
  return primera(filas)?.salio === true;
}

/** El nombre de la ficha de quien pulsa, para el aviso a quien lleva la célula. */
export async function nombreDeMiFicha(ctx: UserContext): Promise<string | null> {
  if (!ctx.miembroId) return null;
  const miembroId = ctx.miembroId;
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ nombre: miembros.nombre, apellidos: miembros.apellidos })
      .from(miembros)
      .where(eq(miembros.id, miembroId))
      .limit(1),
  );
  return fila ? [fila.nombre, fila.apellidos].filter(Boolean).join(' ') : null;
}
