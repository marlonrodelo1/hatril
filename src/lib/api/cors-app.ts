/**
 * Quién puede leer las respuestas de `/api/v1/app/*` desde un navegador.
 *
 * La app empaquetada no vive en hatril.com: su WebView sirve las pantallas
 * desde un origen local, y cada petición a la API es de otro origen. Sin estas
 * cabeceras el WebView la bloquea.
 *
 *   - `capacitor://localhost`: iOS.
 *   - `https://localhost`: Android (`androidScheme` por defecto en Capacitor 8).
 *   - `http://localhost:5173`: Vite en desarrollo. Solo fuera de producción.
 *
 * LISTA CERRADA, Y SIN `credentials`
 * ----------------------------------
 * La sesión viaja en `Authorization`, que el navegador nunca pone solo, así
 * que no hay cookies que permitir ni CSRF que temer. La lista existe para que
 * ninguna otra web pueda leer lo que conteste la API con un token que, por lo
 * que sea, tenga a mano.
 *
 * Sin `server-only`: lo usa también `src/proxy.ts` para contestar el
 * `OPTIONS` previo, que así no hay que acordarse de exportar en cada ruta.
 */
const ORIGENES_APP = new Set(['capacitor://localhost', 'https://localhost']);
const ORIGENES_DESARROLLO = new Set(['http://localhost:5173']);

export const PREFIJO_API_APP = '/api/v1/app/';

export function origenPermitido(origen: string | null): boolean {
  if (!origen) return false;
  if (ORIGENES_APP.has(origen)) return true;
  return process.env.NODE_ENV !== 'production' && ORIGENES_DESARROLLO.has(origen);
}

export function cabecerasCors(origen: string | null): Record<string, string> {
  if (!origenPermitido(origen)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origen!,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    // Server-Timing no es de las cabeceras que el navegador deja leer de serie.
    'Access-Control-Expose-Headers': 'Server-Timing',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** La respuesta al `OPTIONS` previo. Sin cuerpo y sin tocar la sesión. */
export function respuestaPreviaCors(origen: string | null): Response {
  return new Response(null, { status: 204, headers: cabecerasCors(origen) });
}
