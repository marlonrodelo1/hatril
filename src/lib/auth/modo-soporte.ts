import { cookies } from 'next/headers';

/**
 * "Modo soporte": cuando un super admin entra al panel de un salón
 * (impersonación), gestori.es marca esta cookie para pintar un banner que deja
 * claro que estás operando como soporte. Es SOLO un flag de UI — la auth real
 * es la sesión Supabase del dueño creada por verifyOtp en /auth/impersonar.
 */
export const COOKIE_MODO_SOPORTE = 'gonper_modo_soporte';

/**
 * Si la sesión actual está en modo soporte, devuelve el nombre del salón
 * (cadena vacía si no se guardó nombre). Si no, devuelve null.
 */
export async function leerModoSoporte(): Promise<string | null> {
  const store = await cookies();
  const valor = store.get(COOKIE_MODO_SOPORTE)?.value;
  if (!valor) return null;
  return valor === '1' ? '' : valor;
}
