import { type NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aterrizaje de los enlaces que Supabase manda por correo: confirmar la cuenta
 * y recuperar la contraseña.
 *
 * `verifyOtp` canjea el token por una sesión. A partir de ahí, `/reset-password`
 * puede llamar a `updateUser({ password })`, que es lo único que le da permiso
 * para cambiarla.
 *
 * `next` se valida como ruta interna. Sin esa comprobación, un enlace de
 * recuperación con `?next=https://otrositio` sería un redirector abierto — y
 * uno especialmente creíble, porque el correo lo manda Supabase de verdad.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');

  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/panel/hoy';

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL(
        '/acceso?error=' + encodeURIComponent('Ese enlace no es válido.'),
        request.url,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(
      new URL(
        '/acceso?error=' +
          encodeURIComponent(
            'El enlace ha caducado o ya se usó. Pide otro desde «La he olvidado».',
          ),
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
