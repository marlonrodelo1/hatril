import 'server-only';

import type { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';
// Los mismos internos de Next que ya usa `enLaApp()`. Si cambian de sitio,
// falla el build: se nota, no abre nada.
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import {
  getAccessFallbackHTTPStatus,
  isHTTPAccessFallbackError,
} from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import { usuarioActual } from '@/lib/auth/usuario';
import { requireIglesia } from '@/lib/auth/guard-panel';
import type { UserContext } from '@/lib/auth/user-context';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { captureException } from '@/lib/observability';
import { enUnaPeticion, tiemposDeLaPeticion } from '@/lib/peticion';
import { cabecerasCors } from './cors-app';
import { loQueNoViaja } from './viaja-por-json';

/**
 * El envoltorio de TODO endpoint de la app empaquetada (`/api/v1/app/*`).
 *
 * Plan entero en `docs/app-nativa/plan-spa.md` §2. Lo corto: el teléfono no
 * lee la base; pide los datos aquí con su token, y aquí corren las mismas
 * guardas que en la web.
 *
 * LA GUARDA ES OBLIGATORIA, TAMBIÉN EN LO PÚBLICO
 * -----------------------------------------------
 * Sin `guarda` no compila. Una ruta pública pone `publica` y lo dice; así, al
 * leerla, no se confunde una puerta abierta a propósito con una olvidada. Y
 * `npm run test:puertas:app` falla con cualquier `route.ts` de aquí que no
 * esté en su lista.
 *
 * LAS GUARDAS SON LAS DE LA WEB, SIN TRADUCIR
 * ------------------------------------------
 * `requireIglesia`, `exigirConsentimientoAlDia`, `requireMinisterioEnLaApp`…
 * hacen `redirect()` o `notFound()` al fallar. En un route handler eso sería
 * un 307 a una página HTML, y la app no sabría qué hacer con ella. Aquí se
 * atrapan y salen como JSON `{ error, ir }`:
 *
 *   - `redirect('/acceso')`                 → 401
 *   - cualquier otro `redirect()`           → 403, con el `?error=` como mensaje
 *   - `notFound()`, `forbidden()`…          → su código
 *
 * Es el mismo truco que `enLaApp()` (`ministerios/en-la-app/acciones.ts`), y
 * por lo mismo: así la lista de quién entra dónde sigue siendo UNA. Escribir
 * guardas propias para la API sería tener dos, y la que se quede atrás es la
 * que deja pasar.
 *
 * Y UNA MEMORIA POR PETICIÓN
 * --------------------------
 * `cache()` de React no memoiza en un route handler (ver `src/lib/peticion.ts`).
 * Sin `enUnaPeticion`, cada guarda volvería a pedir la sesión a Auth.
 */

export type Guarda<C> = () => Promise<C>;

/** Ruta pública: sin sesión. Se escribe para que se lea. */
export const publica: Guarda<null> = async () => null;

/** Con sesión, tenga o no iglesia. La de las pantallas de antes de entrar. */
export const conSesion: Guarda<User> = async () => {
  const user = await usuarioActual();
  if (!user) redirect('/acceso');
  return user;
};

/**
 * Un error que el manejador decide él: la misma forma `{ error, ir }` que los
 * cortes de las guardas, para que la app los trate igual.
 */
export function errorApp(error: string, status = 400, ir?: string): Response {
  return Response.json(ir ? { error, ir } : { error }, { status });
}

/** Hecho, sin nada que contar. */
export function sinContenido(): Response {
  return new Response(null, { status: 204 });
}

/** Lo que Next pasa a un route handler. Sin segmentos dinámicos, `params` vale `{}`. */
/**
 * La del área del miembro: la que ponen las pantallas de `/mi` que leen datos
 * de la iglesia (comunidad, devocional, agenda): tener iglesia y la política
 * aceptada en su versión de ahora. `/mi/avisos` no la lleva, a propósito (ver
 * `exigirConsentimientoAlDia`).
 */
export const guardaMiembro: Guarda<UserContext> = async () => {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);
  return ctx;
};

type Contexto = { params: Promise<unknown> };

type Manejador<C, E> = (args: {
  ctx: C;
  entrada: E;
  params: Record<string, string>;
  request: NextRequest;
}) => Promise<unknown>;

export function endpointApp<C, E = undefined>(
  opciones: { guarda: Guarda<C>; entrada?: z.ZodType<E> },
  manejador: Manejador<C, E>,
): (request: NextRequest, contexto: Contexto) => Promise<Response> {
  return async function (request, contexto) {
    const inicio = performance.now();
    const origen = request.headers.get('origin');

    const responder = (cuerpo: unknown, status: number): Response => {
      // Fuera de producción, lo que JSON no sabe llevar (un `Set`, un
      // componente) es un 500 aquí y no una pantalla rota en el teléfono
      // (`viaja-por-json.ts`). Se lanza dentro del `try` de abajo.
      if (process.env.NODE_ENV !== 'production' && !(cuerpo instanceof Response)) {
        const mal = loQueNoViaja(cuerpo);
        if (mal) throw new Error(`No viaja por JSON a la app: ${mal}`);
      }
      // Un manejador puede devolver su propia `Response` (un 201, un 204);
      // lleva las mismas cabeceras que las demás.
      const r = cuerpo instanceof Response ? cuerpo : Response.json(cuerpo ?? null, { status });
      for (const [k, v] of Object.entries(cabecerasCors(origen))) r.headers.set(k, v);
      // Son datos de una persona: ni el WebView ni nada por el medio los guarda.
      r.headers.set('Cache-Control', 'no-store');
      // Para medir de dónde sale el tiempo de cada pantalla (plan, fase 0):
      // los tramos que se midieron con `medir()`, y el total.
      r.headers.set(
        'Server-Timing',
        [...tiemposDeLaPeticion(), `total;dur=${Math.round(performance.now() - inicio)}`].join(', '),
      );
      return r;
    };

    return enUnaPeticion(async () => {
      try {
        const ctx = await opciones.guarda();

        let entrada = undefined as E;
        if (opciones.entrada) {
          const crudo = await leerEntrada(request);
          if (crudo === LECTURA_FALLIDA) {
            return responder({ error: 'La petición no se entiende.' }, 400);
          }
          const parsed = opciones.entrada.safeParse(crudo);
          if (!parsed.success) {
            return responder(
              { error: 'Revisa los datos.', detalles: parsed.error.flatten().fieldErrors },
              400,
            );
          }
          entrada = parsed.data;
        }

        const params = await leerParams(contexto);
        return responder(await manejador({ ctx, entrada, params, request }), 200);
      } catch (error) {
        const traducido = traducirCorte(error);
        if (traducido) return responder(traducido.cuerpo, traducido.status);
        await captureException(error, { endpoint: request.nextUrl.pathname });
        return responder({ error: 'Algo ha fallado. Inténtalo de nuevo.' }, 500);
      }
    });
  };
}

/** Lo que dice cada destino cuando la guarda no explica nada más. */
const MENSAJE_POR_DESTINO: Record<string, string> = {
  '/acceso': 'Tu sesión ha caducado. Vuelve a entrar.',
  '/mi': 'No perteneces a ninguna iglesia todavía.',
  '/acepta': 'Antes de seguir, tienes que aceptar la política de privacidad.',
  '/suscripcion': 'Tu iglesia tiene la suscripción en pausa.',
  '/cuenta-en-baja': 'Pediste borrar tu cuenta.',
};

function traducirCorte(
  error: unknown,
): { cuerpo: { error: string; ir?: string }; status: number } | null {
  if (isRedirectError(error)) {
    const destino = new URL(getURLFromRedirectError(error), 'http://hatril.invalid');
    const ir = destino.pathname;
    const mensaje =
      destino.searchParams.get('error') ??
      MENSAJE_POR_DESTINO[ir] ??
      'No tienes acceso a esto.';
    return { cuerpo: { error: mensaje, ir }, status: ir === '/acceso' ? 401 : 403 };
  }
  if (isHTTPAccessFallbackError(error)) {
    const status = getAccessFallbackHTTPStatus(error);
    const mensaje =
      status === 404 ? 'Esto no existe.' : status === 401 ? 'Vuelve a entrar.' : 'No tienes acceso a esto.';
    return { cuerpo: { error: mensaje }, status };
  }
  return null;
}

const LECTURA_FALLIDA = Symbol('lectura fallida');

/**
 * GET, de la query; lo demás, del cuerpo JSON. DELETE también del cuerpo: lo
 * que va en la dirección acaba en los registros de cualquier proxy, y un
 * token de push no tiene por qué estar ahí.
 */
async function leerEntrada(request: NextRequest): Promise<unknown> {
  if (request.method === 'GET') {
    return Object.fromEntries(request.nextUrl.searchParams);
  }
  try {
    return await request.json();
  } catch {
    return LECTURA_FALLIDA;
  }
}

/** Los segmentos dinámicos, ya como texto. Cada endpoint valida los suyos. */
async function leerParams(contexto: Contexto | undefined): Promise<Record<string, string>> {
  const crudos = await contexto?.params;
  const params: Record<string, string> = {};
  if (!crudos || typeof crudos !== 'object') return params;
  for (const [k, v] of Object.entries(crudos)) {
    if (typeof v === 'string') params[k] = v;
  }
  return params;
}
