import { cookies } from 'next/headers';

/**
 * "Modo app": marca que la sesión del panel se abrió desde la app del negocio
 * (gonper-socio) a través del puente `/auth/puente`. Sirve para que el panel web
 * esconda precios y botones de compra mientras se ve dentro del flujo de la app
 * —la app no vende nada (requisito de las tiendas)—. Es SOLO un flag de UI; la
 * auth real es la sesión Supabase del dueño creada por verifyOtp.
 *
 * Primera defensa: la lista cerrada de rutas del puente (`puente-rutas.ts`) ya
 * excluye cualquier pantalla con precios. Esta marca es la segunda.
 */
export const COOKIE_MODO_APP = 'gonper_modo_app';

/** ¿La sesión actual se abrió desde la app por el puente? */
export async function enModoApp(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_MODO_APP)?.value === '1';
}
