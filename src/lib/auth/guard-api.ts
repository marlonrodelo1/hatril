import 'server-only';

import {
  getCurrentUserContext,
  type UserContext,
} from '@/lib/auth/user-context';
import { esPastor, puede, type Permiso } from '@/lib/auth/permisos';

/**
 * Guard para route handlers.
 *
 * POR QUÉ NO VALE EL DEL LAYOUT
 * -----------------------------
 * Un `route.ts` colgado de `/panel/finanzas/` NO queda cubierto por
 * `finanzas/layout.tsx`: los route handlers no participan en layouts. Lo dice
 * la documentación de Next que trae este repo, en
 * `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`,
 * y su guía de autenticación manda tratarlos con las mismas consideraciones que
 * un endpoint público.
 *
 * `src/proxy.ts` tampoco sirve: el propio CLAUDE.md dice que es comprobación
 * optimista, no autorización.
 *
 * DEVUELVE `Response`, NO `redirect()`
 * ------------------------------------
 * Un `redirect()` desde un endpoint que sirve un fichero le entrega al navegador
 * una página HTML con nombre de CSV. La persona abre el descargado en Excel y ve
 * markup, que es un fallo muchísimo más confuso que un 403 limpio.
 */

export type ResultadoGuard =
  | { ok: true; ctx: UserContext }
  | { ok: false; respuesta: Response };

const SIN_SESION = new Response('No has iniciado sesión.', {
  status: 401,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
});

const SIN_PERMISO = new Response('No tienes acceso a esto.', {
  status: 403,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
});

/**
 * Exige sesión con iglesia activa y un permiso concreto. El pastor pasa siempre.
 *
 * Hoy devuelve 403 a quien no puede. Cuando exista lo nominativo habrá que
 * plantearse un 404 en esas rutas concretas: con datos del art. 9, que la
 * respuesta distinga «existe pero no puedes» de «no existe» ya es información.
 */
export async function requirePermisoApi(
  permiso: Permiso,
): Promise<ResultadoGuard> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { ok: false, respuesta: SIN_SESION };
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    return { ok: false, respuesta: SIN_PERMISO };
  }
  return { ok: true, ctx };
}
