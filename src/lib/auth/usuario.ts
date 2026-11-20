import 'server-only';

import { headers } from 'next/headers';
import { createClient as clienteSupabase } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { cachePorPeticion, medir } from '@/lib/peticion';

/**
 * Quién está pidiendo esta página, validado contra Supabase Auth. UNA vez por
 * render.
 *
 * POR QUÉ EXISTE (19-nov)
 * -----------------------
 * Cada `supabase.auth.getUser()` es una petición HTTP al servidor de Auth, en
 * Irlanda: 174 ms medidos desde Canarias. Una pestaña de `/mi` lo pedía dos y
 * tres veces —`getCurrentUserContext`, la página para pasarle `user` a la
 * cabecera, el guard— y las tres en serie. Con `cache()` de React, la primera
 * pregunta y las demás reciben la misma respuesta dentro del mismo render.
 *
 * Sigue siendo `getUser()` y no `getClaims()`: esto es lo que decide qué datos
 * se leen, y `getUser()` comprueba además que la sesión no se haya cerrado en
 * el servidor.
 *
 * Solo `getCurrentUserContext` pasa por aquí de momento. Las páginas de `/mi`
 * y el proxy (`lib/supabase/middleware.ts`) siguen llamando a `getUser()` por
 * su cuenta.
 *
 * Y ES LA ÚNICA PUERTA DE LA APP EMPAQUETADA (19-nov)
 * --------------------------------------------------
 * La app del teléfono no lleva cookies: manda la sesión en
 * `Authorization: Bearer <token de Supabase>` (`docs/app-nativa/plan-spa.md`).
 * El token se lee AQUÍ y en ningún otro sitio, así que todo lo de abajo
 * —`getCurrentUserContext`, `requireIglesia`, `withUser`— es el mismo código
 * para la web y para la app. Gonper hizo un contexto gemelo para su app
 * (`salon-bearer.ts`); dos contextos acaban divergiendo, y la puerta que
 * diverge es la que deja pasar.
 *
 * Si llega la cabecera, cuenta SOLO ella: un token malo es «sin sesión»,
 * aunque haya cookie. Y no abre nada que la cookie no abriera ya: es la misma
 * sesión de Supabase, validada igual. Lo que no llega por aquí es `/admin`,
 * que pregunta por su cuenta (`getCurrentSuperAdmin`) y solo mira la cookie.
 *
 * `cachePorPeticion` y no `cache()`: en un route handler `cache()` no memoiza,
 * y cada guarda de la API volvería a preguntar a Auth (`src/lib/peticion.ts`).
 */
export const usuarioActual = cachePorPeticion(async function usuarioActual() {
  const token = tokenBearer((await headers()).get('authorization'));

  if (token !== undefined) {
    if (!token) return null;
    const {
      data: { user },
    } = await medir('auth', () => clienteSinSesion().auth.getUser(token));
    return user;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * `undefined` si no hay cabecera, y la cadena vacía si la hay pero no es un
 * Bearer: esa es una petición que quiso identificarse y no supo, no una de la
 * web con su cookie.
 */
function tokenBearer(cabecera: string | null): string | undefined {
  if (cabecera === null) return undefined;
  return /^Bearer\s+(\S+)$/i.exec(cabecera.trim())?.[1] ?? '';
}

/** Sin almacenamiento: solo valida el token que le pasan. */
function clienteSinSesion() {
  return clienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
