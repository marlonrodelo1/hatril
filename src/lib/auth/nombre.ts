import type { User } from '@supabase/supabase-js';

/**
 * Cómo se llama quien está usando el producto ahora mismo.
 *
 * Sale de `user_metadata` y no de su ficha de miembro: hay cuentas sin ficha
 * —quien acaba de pedir entrar en una iglesia— y pedir la ficha obligaría a una
 * consulta más para pintar una palabra en una cabecera.
 *
 * La cascada estaba copiada en cinco sitios (`panel/layout.tsx`, `mi/page.tsx`,
 * `mi/comunidad/page.tsx` y su `actions.ts`, `solicitar/[slug]/page.tsx`) con
 * tres textos de reserva distintos. Aquí es uno.
 *
 * OJO: ESTE NOMBRE PUEDE DIVERGIR DEL DE LA FICHA
 * -----------------------------------------------
 * `miembros.nombre` y `user_metadata.nombre` nacen iguales al registrarse y
 * nada los mantenía sincronizados: editar la ficha desde Miembros dejaba la
 * cabecera mostrando el nombre viejo para siempre. La pantalla de cuenta
 * (`/panel/cuenta`) escribe en los dos por eso.
 */
export function nombreDeLaCuenta(user: User, reserva = 'Tu cuenta'): string {
  const guardado = user.user_metadata?.nombre;
  if (typeof guardado === 'string' && guardado.trim()) return guardado.trim();

  return user.email?.split('@')[0] ?? reserva;
}
