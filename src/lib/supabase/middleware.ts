import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresco de la sesión de Supabase en cada petición, y redirección de las
 * rutas privadas.
 *
 * Lo llama `src/proxy.ts`, que en Next 16 es lo que antes era el middleware.
 *
 * ESTO NO ES LA AUTORIZACIÓN
 * --------------------------
 * La documentación de Next lo dice sin rodeos sobre el proxy: *«no debe usarse
 * como solución de gestión de sesión ni de autorización»*, solo para
 * comprobaciones optimistas. Y hay motivo concreto: Next 16.2 arrastraba varios
 * CVE de bypass de proxy —por rutas de segment-prefetch, por inyección en
 * parámetros dinámicos, por i18n—. Es decir, esta redirección SE PUEDE SALTAR.
 *
 * Lo que hay aquí ahorra un render a quien no ha iniciado sesión. Quien decide
 * de verdad es el guard de cada página o acción (`requireIglesia`,
 * `requirePastor`) y, por debajo, las policies de RLS. Si esto se saltara
 * entero, lo peor que pasa es que se llegue a una página que redirige igual y
 * a una consulta que devuelve cero filas.
 */

const RUTAS_PRIVADAS = ['/panel', '/mi', '/admin', '/suscripcion'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` y no `getSession()`: el segundo se cree la cookie sin
  // validarla contra el servidor de auth. Aquí da igual porque no decide nada,
  // pero la costumbre importa: en cuanto alguien copie este bloque a un sitio
  // donde SÍ decida, la diferencia es una sesión falsificable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPrivada = RUTAS_PRIVADAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );

  if (!user && esPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = '/acceso';
    // Para devolver a la persona donde iba después de identificarse. Solo se
    // guarda la ruta, nunca la URL entera: con el origen dentro, esto sería un
    // redirector abierto que sirve para llevar a alguien a otro sitio desde un
    // enlace que parece nuestro.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
