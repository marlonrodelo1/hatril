import 'server-only';

import {
  getCurrentUserContext,
  type UserContext,
} from '@/lib/auth/user-context';
import { esPastor, puede, type Permiso } from '@/lib/auth/permisos';
import { motivoFueraDelPanel } from '@/lib/auth/guard-panel';

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

/*
 * Funciones y no constantes. Eran dos `Response` creadas una vez para todo el
 * proceso, y el cuerpo de una `Response` solo se puede leer una vez: desde el
 * segundo rechazo, los 401 y 403 llegaban vacíos. Lo cazó `test:puertas`.
 */
function sinSesion(): Response {
  return new Response('No has iniciado sesión.', {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function sinPermiso(): Response {
  return new Response('No tienes acceso a esto.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

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
  if (!ctx) return { ok: false, respuesta: sinSesion() };
  // Las puertas del panel —ser del equipo, el consentimiento al día y la
  // suscripción no bloqueada— también, y aquí y no en cada ruta: ningún layout
  // las pone por un `route.ts`, y una exportación nueva las hereda sin
  // acordarse. Con 403 y no con redirect, por lo de arriba.
  if (await motivoFueraDelPanel(ctx)) {
    return { ok: false, respuesta: sinPermiso() };
  }
  if (!esPastor(ctx) && !puede(ctx, permiso)) {
    return { ok: false, respuesta: sinPermiso() };
  }
  return { ok: true, ctx };
}
