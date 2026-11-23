import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';

import { GOOGLE } from '@/lib/auth/google';
import { captureException } from '@/lib/observability/sentry';

/**
 * Entrar con Google y con Apple.
 *
 * DÓNDE VA CADA UNO, Y POR QUÉ
 * ----------------------------
 * - **Google en la web**: el flujo de siempre de Supabase (`signInWithOAuth`),
 *   que lleva a Google y vuelve por `/auth/callback`.
 * - **Google y Apple dentro de la app**: la ventana nativa del teléfono
 *   (`@capgo/capacitor-social-login`) devuelve un token de identidad y el
 *   servidor lo canjea con `signInWithIdToken`. Google no deja iniciar sesión
 *   dentro de un WebView —responde «403 disallowed_useragent»—, y la app es
 *   justo eso: hatril.com metido en un WebView.
 * - **Apple solo en el iPhone.** Es lo que pide Apple (guía 4.8: si hay Google,
 *   tiene que haber Apple), y en el iPhone basta con decirle a Supabase el
 *   bundle `app.hatril`. En la web o en Android haría falta un Services ID y una
 *   clave secreta que caduca cada seis meses, y no lo pide nadie.
 *
 * Los identificadores de cliente de Google están en `lib/auth/google.ts`, en el
 * repo, y el porqué está allí. Sin el web, el botón de Google no sale, en lugar
 * de salir y fallar.
 */

const CLIENTE_GOOGLE = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

export type ConfigGoogle = {
  /** El cliente «Aplicación web»: la web, y la audiencia del token en Android. */
  web: string;
  /** El cliente «iOS» y su primer build. Sin él, en el iPhone no se ofrece Google. */
  ios: { cliente: string; desdeBuild: number } | null;
};

export function configGoogle(): ConfigGoogle | null {
  if (!CLIENTE_GOOGLE.test(GOOGLE.web)) return null;
  return {
    web: GOOGLE.web,
    ios: CLIENTE_GOOGLE.test(GOOGLE.ios.cliente)
      ? { cliente: GOOGLE.ios.cliente, desdeBuild: GOOGLE.ios.desdeBuild }
      : null,
  };
}

/**
 * El nombre que pintan las cabeceras sale de `user_metadata.nombre`
 * (`lib/auth/nombre.ts`), y una cuenta que nace con Google o Apple no lo trae:
 * Google lo deja en `full_name`, y Apple no lo pone en el token —lo da la
 * ventana del iPhone una sola vez, la primera, y por eso llega como
 * `sugerido`—. Sin esto la cabecera diría la parte del correo antes de la
 * arroba, y con Apple «Ocultar mi correo» eso es una ristra de letras.
 *
 * Solo se escribe si no había nombre: quien ya tenía cuenta con contraseña y
 * entra con Google por primera vez conserva el suyo.
 */
export async function asegurarNombre(
  supabase: SupabaseClient,
  user: User,
  sugerido?: string | null,
): Promise<void> {
  const actual = user.user_metadata?.nombre;
  if (typeof actual === 'string' && actual.trim()) return;

  const candidato = [sugerido, user.user_metadata?.full_name, user.user_metadata?.name]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find((v) => v.length >= 2);
  if (!candidato) return;

  const { error } = await supabase.auth.updateUser({
    data: { nombre: candidato.slice(0, 120) },
  });
  // No es motivo para no dejarle entrar: el nombre se cambia en Mi cuenta.
  if (error) await captureException(error, { action: 'acceso_social_nombre' });
}
