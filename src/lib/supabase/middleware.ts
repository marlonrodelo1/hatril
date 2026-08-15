import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cookie de tracking de partner referidor. Si la URL trae `?ref=xxx`
 * (con xxx siendo un slug válido a-z 0-9 -, 3..50 chars), guardamos el
 * código en una cookie httpOnly de 30 días. Al hacer signup, las
 * actions de auth leen esta cookie y enlazan `salones.partner_id`
 * resolviendo `xxx` → fila `partners.codigo_ref` activa.
 *
 * Reglas:
 *   - Si ya hay cookie → NO se sobrescribe (gana el primer referido).
 *   - Si el valor del query es inválido → se ignora silenciosamente.
 *   - No es httpOnly del todo: server-side se lee; el JS del cliente
 *     no necesita acceder así que la marcamos httpOnly por seguridad.
 */
const PARTNER_REF_COOKIE = 'gnp_ref';
const PARTNER_REF_REGEX = /^[a-z0-9-]{3,50}$/;
const PARTNER_REF_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 días

function applyPartnerRefCookie(
  request: NextRequest,
  response: NextResponse,
): void {
  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref) return;
  if (!PARTNER_REF_REGEX.test(ref)) return;
  if (request.cookies.get(PARTNER_REF_COOKIE)) return;
  response.cookies.set(PARTNER_REF_COOKIE, ref, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: PARTNER_REF_MAX_AGE_S,
    path: '/',
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proteger rutas /panel/*
  if (!user && request.nextUrl.pathname.startsWith('/panel')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    applyPartnerRefCookie(request, redirect);
    return redirect;
  }

  // Proteger rutas autenticadas de partner. La landing /partner y
  // /partner/registro son públicas; cualquier ruta más profunda
  // requiere sesión.
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/partner/') &&
    request.nextUrl.pathname !== '/partner/registro' &&
    !request.nextUrl.pathname.startsWith('/partner/registro/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    const redirect = NextResponse.redirect(url);
    applyPartnerRefCookie(request, redirect);
    return redirect;
  }

  applyPartnerRefCookie(request, supabaseResponse);
  return supabaseResponse;
}
