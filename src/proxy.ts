import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';
import { resolverSlugPorDominio } from '@/lib/dominios/iglesias';

/**
 * El middleware de Next 16, que ahora se llama `proxy`.
 *
 * Solo puede haber un `proxy.ts` por proyecto, así que este fichero es el
 * repartidor: cada responsabilidad vive en su módulo y aquí se ordenan.
 *
 * EL ORDEN NO ES ARBITRARIO
 * -------------------------
 * 1. `/.well-known/` sale ANTES QUE NADA, sin cookies y sin redirecciones.
 *    Google y Apple exigen servir ahí los ficheros de verificación de dominio
 *    tal cual; una redirección o una cookie de sesión por medio y la
 *    verificación falla, con el agravante de que Android cachea el resultado
 *    negativo. Hace falta para los App Links de la v2, y se deja puesto ya
 *    porque el día que se necesite nadie se acordará de por qué falla.
 *
 * 2. El dominio propio de una iglesia se resuelve antes de tocar la sesión: es
 *    una reescritura de host y no depende de quién sea quien pide.
 *
 * 3. El refresco de sesión, al final.
 *
 * ESTO NO AUTORIZA NADA
 * ---------------------
 * Ver la cabecera de `@/lib/supabase/middleware`. El proxy es una comprobación
 * optimista para ahorrar renders; quien decide son los guards de cada página y
 * las policies de RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/.well-known/')) {
    return NextResponse.next();
  }

  /*
   * Las rutas de máquina salen aquí, antes de resolver el dominio.
   *
   * NO ES UNA OPTIMIZACIÓN, ES UN ARREGLO. La resolución de dominio de abajo
   * mira la cabecera `Host`, y el webhook de Stripe llega con el `Host` que
   * tenga configurado el endpoint. Si ese host resolviera a una iglesia con
   * dominio propio, la petición se reescribiría a `/i/[slug]/api/stripe/webhook`
   * —que no existe—, Stripe recibiría un 404, reintentaría durante tres días y
   * se rendiría. Y nadie vería un solo error en los logs de la aplicación,
   * porque la aplicación nunca se enteró.
   *
   * Y de paso se salta `updateSession()`, que tocaría cookies de Supabase en una
   * petición server-to-server donde no hay sesión ninguna.
   *
   * Esto no abre nada: el proxy no autoriza (ver la cabecera de este fichero y
   * `RUTAS_PRIVADAS` en `@/lib/supabase/middleware`, donde `/api` ni siquiera
   * figura). Cada handler bajo `/api` lleva su propio guard: `requirePermisoApi`,
   * `requireApiToken`, o —en el webhook— la firma HMAC de Stripe.
   */
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const slug = await resolverSlugPorDominio(host);

  if (slug && !pathname.startsWith('/i/')) {
    // Reescritura y no redirección: quien entra por el dominio de su iglesia
    // debe seguir viéndolo en la barra del navegador. Gonper redirige a su
    // dominio principal, que para un salón da igual pero para una congregación
    // que ha pagado su dominio es justo lo que no quiere.
    const url = request.nextUrl.clone();
    url.pathname = `/i/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos de Next y los ficheros de imagen. Sin este
     * filtro, el proxy correría también para cada icono y cada fuente, y con él
     * la consulta de dominios y el refresco de sesión.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
