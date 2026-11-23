import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';

import { conSesion, endpointApp, errorApp } from '@/lib/api/app';
import { accionDeLaApp } from '@/lib/api/acciones-app';
import { CAMPO_ARGS, CAMPO_ID, PREFIJO_FORM, type RespuestaAccion } from '@/lib/app-api/accion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ejecuta una server action de la web para la app empaquetada.
 *
 * Qué actions y por qué esto no abre nada: `src/lib/api/acciones-app.ts`. El
 * formato del cuerpo: `src/lib/app-api/accion.ts`.
 *
 * La guarda de aquí es solo tener sesión: todas las de la lista la piden, y
 * cada una pone después la suya (iglesia, permiso, módulo). Un `notFound()` de
 * una action sale como 404 (`endpointApp`); un `redirect()`, como
 * `{ redirigir }`, que es a donde la web habría llevado a la persona.
 */
const MAX_ARGS = 6;

export const POST = endpointApp({ guarda: conSesion }, async ({ request }) => {
  let cuerpo: FormData;
  try {
    cuerpo = await request.formData();
  } catch {
    return errorApp('La petición no se entiende.', 400);
  }

  const id = cuerpo.get(CAMPO_ID);
  const accion = typeof id === 'string' ? accionDeLaApp(id) : null;
  if (!accion) return errorApp('Esto no existe.', 404);

  const args = leerArgumentos(cuerpo);
  if (!args) return errorApp('La petición no se entiende.', 400);

  try {
    const valor = await accion(...(args as never[]));
    const respuesta: RespuestaAccion = { valor: valor ?? null };
    return respuesta;
  } catch (error) {
    if (isRedirectError(error)) {
      const respuesta: RespuestaAccion = { redirigir: getURLFromRedirectError(error) };
      return respuesta;
    }
    throw error;
  }
});

/**
 * Los argumentos, con cada `FormData` rehecho a partir de sus campos. Solo
 * texto, números, sí/no, nulos y formularios: lo que pasa una action de
 * verdad. Cualquier otra cosa es una petición que no viene de la app.
 */
function leerArgumentos(cuerpo: FormData): unknown[] | null {
  let crudos: unknown;
  try {
    crudos = JSON.parse(String(cuerpo.get(CAMPO_ARGS) ?? '[]'));
  } catch {
    return null;
  }
  if (!Array.isArray(crudos) || crudos.length > MAX_ARGS) return null;

  const args: unknown[] = [];
  for (const a of crudos) {
    if (a === null || ['string', 'number', 'boolean'].includes(typeof a)) {
      args.push(a);
      continue;
    }
    const n = (a as { __fd?: unknown }).__fd;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= MAX_ARGS) return null;
    const prefijo = `${PREFIJO_FORM}${n}:`;
    const form = new FormData();
    for (const [clave, valor] of cuerpo.entries()) {
      if (clave.startsWith(prefijo)) form.append(clave.slice(prefijo.length), valor);
    }
    args.push(form);
  }
  return args;
}
