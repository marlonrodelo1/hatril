import 'server-only';

import { cookies } from 'next/headers';

import { olvidarTelefono } from './telefonos';

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
    // La misma que usa la API de la app al salir (`/api/v1/app/push`).
    await olvidarTelefono(authUserId, token);
  } catch (err) {
    console.error('[push] no se pudo olvidar el teléfono al salir', err);
  } finally {
    almacen.delete(COOKIE_PUSH);
  }
}
