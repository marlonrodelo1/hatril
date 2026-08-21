import 'server-only';

import { eq } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

export type Donativos = {
  cuenta: string;
  titular: string | null;
};

/**
 * A dónde manda una iglesia sus ofrendas.
 *
 * Consulta aparte y no dos columnas más en `UserContext`, que se pide en CADA
 * carga del panel: esto lo mira una persona una vez al mes, desde una sola
 * pantalla. El contexto está deliberadamente flaco.
 *
 * Devuelve `null` si esa congregación no ha puesto ninguna cuenta, y de ahí sale
 * la decisión de producto: **el botón de Donar no se pinta**. Un botón que al
 * pulsarlo dice «tu iglesia todavía no ha configurado esto» es peor que no
 * tenerlo — le pasa el problema al miembro, que no puede hacer nada al respecto.
 *
 * HATRIL NO COBRA NADA POR CUENTA DE NADIE
 * ----------------------------------------
 * Esto solo enseña un número de cuenta que la iglesia ya publica en su web. No
 * hay pasarela, no hay comisión y no pasa dinero por aquí, que es exactamente lo
 * que `/privacidad` §3 promete. El día que llegue Stripe será para cobrar la
 * suscripción de la iglesia, no las ofrendas de su gente.
 */
export async function donativosDeMiIglesia(
  ctx: UserContext,
): Promise<Donativos | null> {
  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({
        cuenta: iglesias.cuentaDonativos,
        titular: iglesias.titularDonativos,
      })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );

  const d = filas[0];
  if (!d?.cuenta?.trim()) return null;

  return { cuenta: d.cuenta.trim(), titular: d.titular?.trim() || null };
}
