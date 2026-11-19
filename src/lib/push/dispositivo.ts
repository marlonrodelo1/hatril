import 'server-only';

import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { withUser } from '@/lib/db';
import { dispositivosPush } from '@/lib/db/schema';

/** La cookie con el token de este teléfono, para olvidarlo al salir. */
export const COOKIE_PUSH = 'hatril_push';

/**
 * Lo llama «Salir» antes de cerrar la sesión: este teléfono deja de recibir
 * los avisos de la cuenta. Sin esto, quien le deja el móvil a otro y sale
 * seguiría viendo en la pantalla bloqueada quién le comenta.
 *
 * Recibe la cuenta de la sesión que se está cerrando, no de un formulario, y
 * aun así la RLS solo le deja borrar un token de esa cuenta. Si falla, se
 * sale igual: no poder salir es peor que un aviso de más.
 */
export async function olvidarDispositivoDeEstaSesion(authUserId: string): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_PUSH)?.value;
  if (!token) return;

  try {
    await withUser(authUserId, (tx) =>
      tx
        .delete(dispositivosPush)
        .where(and(eq(dispositivosPush.token, token), eq(dispositivosPush.authUserId, authUserId))),
    );
  } catch (err) {
    console.error('[push] no se pudo olvidar el teléfono al salir', err);
  } finally {
    almacen.delete(COOKIE_PUSH);
  }
}
